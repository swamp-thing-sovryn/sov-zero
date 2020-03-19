pragma solidity ^0.5.11;

import "./Interfaces/ICDPManager.sol";
import "./Interfaces/IPool.sol";
import "./Interfaces/ICLVToken.sol";
import "./Interfaces/IPriceFeed.sol";
import "./Interfaces/ISortedCDPs.sol";
import "./Interfaces/IPoolManager.sol";
import "./DeciMath.sol";
import "./ABDKMath64x64.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/ownership/Ownable.sol";
import "@nomiclabs/buidler/console.sol";

contract CDPManager is Ownable, ICDPManager {
    using SafeMath for uint;

    uint constant public MCR = 1100000000000000000; // Minimal collateral ratio.
    uint constant public  CCR = 1500000000000000000; // Critical system collateral ratio. If the total system collateral (TCR) falls below the CCR, Recovery Mode is triggered.
    uint constant public MIN_COLL_IN_USD = 20000000000000000000;
    enum Status { nonExistent, active, closed }
    
    // --- Events --- 
    event PoolManagerAddressChanged(address _newPoolManagerAddress);
    event ActivePoolAddressChanged(address _activePoolAddress);
    event DefaultPoolAddressChanged(address _defaultPoolAddress);
    event PriceFeedAddressChanged(address  _newPriceFeedAddress);
    event CLVTokenAddressChanged(address _newCLVTokenAddress);
    event SortedCDPsAddressChanged(address _sortedCDPsAddress);

    event CDPCreated(address indexed _user, uint arrayIndex);
    event CDPUpdated(address indexed _user, uint _debt, uint _coll);
    event CDPClosed(address indexed _user);

    event CollateralAdded(address indexed _user, uint _amountAdded);
    event CollateralWithdrawn(address indexed _user, uint _amountWithdrawn);
    event CLVWithdrawn(address indexed _user, uint _amountWithdrawn);
    event CLVRepayed(address indexed _user, uint _amountRepayed);
    event CollateralRedeemed(address indexed _user, uint exchangedCLV, uint redeemedETH);

    // --- Connected contract declarations ---
    IPoolManager poolManager;
    address public poolManagerAddress;

    IPool activePool;
    address public activePoolAddress;

    IPool defaultPool;
    address public defaultPoolAddress;

    ICLVToken CLV; 
    address public clvTokenAddress;

    IPriceFeed priceFeed;
    address public priceFeedAddress;

    // A doubly linked list of CDPs, sorted by their sorted by their collateral ratios
    ISortedCDPs sortedCDPs;
    address public sortedCDPsAddress;

    // --- Data structures ---

    // Store the necessary data for a Collateralized Debt Position (CDP)
    struct CDP {
        uint debt;
        uint coll;
        uint stake;
        Status status;
        uint arrayIndex;
    }
    
    bool public recoveryMode;

    mapping (address => CDP) public CDPs;

    uint public totalStakes; 

    // snapshot of the value of totalStakes immediately after the last liquidation
    uint public totalStakesSnapshot;  

    // snapshot of the total collateral in ActivePool and DefaultPool, immediately after the last liquidation.
    uint public totalCollateralSnapshot;    

    /* L_ETH and L_CLVDebt track the sums of accumulated liquidation rewards per unit staked. During it's lifetime, each stake earns:

    An ETH gain of ( stake * [L_ETH - L_ETH(0)] )
    A CLVDebt gain  of ( stake * [L_CLVDebt - L_CLVDebt(0)] )
    
    Where L_ETH(0) and L_CLVDebt(0) are snapshots of L_ETH and L_CLVDebt for the active CDP taken at the instant the stake was made */
    uint public L_ETH;     
    uint public L_CLVDebt;    

    // maps addresses with active CDPs to their RewardSnapshot
    mapping (address => RewardSnapshot) public rewardSnapshots;  

    // object containing the ETH and CLV snapshots for a given active CDP
    struct RewardSnapshot { uint ETH; uint CLVDebt;}   

    //array of all active CDP addresses - used to compute “approx hint” for list insertion
    address[] CDPOwners;

    // --- Modifiers ---

    modifier onlyPoolManager {
        require(_msgSender() == poolManagerAddress, "CDPManager: Only the poolManager is authorized");
        _;
    }

    // --- Dependency setters --- 

    function setPoolManager(address _poolManagerAddress) public onlyOwner {
        poolManagerAddress = _poolManagerAddress;
        poolManager = IPoolManager(_poolManagerAddress);
        emit PoolManagerAddressChanged(_poolManagerAddress);
    }

    function setActivePool(address _activePoolAddress) public onlyOwner {
        activePoolAddress = _activePoolAddress;
        activePool = IPool(_activePoolAddress);
        emit ActivePoolAddressChanged(_activePoolAddress);
    }

    function setDefaultPool(address _defaultPoolAddress) public onlyOwner {
        defaultPoolAddress = _defaultPoolAddress;
        defaultPool = IPool(_defaultPoolAddress);
        emit DefaultPoolAddressChanged(_defaultPoolAddress);
    }

    function setPriceFeed(address _priceFeedAddress) public onlyOwner {
        priceFeedAddress = _priceFeedAddress;
        priceFeed = IPriceFeed(priceFeedAddress);
        emit PriceFeedAddressChanged(_priceFeedAddress);
    }

    function setCLVToken(address _clvTokenAddress) public onlyOwner {
        clvTokenAddress = _clvTokenAddress;
        CLV = ICLVToken(_clvTokenAddress);
        emit CLVTokenAddressChanged(_clvTokenAddress);
    }

    function setSortedCDPs(address _sortedCDPsAddress) public onlyOwner {
        sortedCDPsAddress = _sortedCDPsAddress;
        sortedCDPs = ISortedCDPs(_sortedCDPsAddress);
        emit SortedCDPsAddressChanged(_sortedCDPsAddress);
    }

    // --- Getters ---
    
    function getCDPOwnersCount() public view returns(uint) {
        return CDPOwners.length;
    }
    
    // function get_L_ETH() public view returns(uint) {
    //     return ABDKMath64x64.toUInt(ABDKMath64x64.mul(L_ETH, 1e18));
    // }

    // function get_L_CLVDebt() public view returns(uint) {
    //     return ABDKMath64x64.toUInt(ABDKMath64x64.mul(L_CLVDebt, 1e18));
    // }

    // --- CDP Operations ---

    function openLoan(uint _CLVAmount, address _hint) public payable returns (bool) {
        // console.log("openLoan func start");
        // console.log("00. gas left: %s", gasleft());
        uint price = priceFeed.getPrice(); // 3460 gas
        // console.log("01. gas left: %s", gasleft());
        bool recoveryMode = checkTCRAndSetRecoveryMode(price); // 26500 gas
        // console.log("02. gas left: %s", gasleft());
        
        address user = _msgSender(); // 28 gas
        // console.log("03. gas left: %s", gasleft());
        
        require(CDPs[user].status != Status.active, "CDPManager: Borrower already has an active CDP"); // 943 gas
        // console.log("04. gas left: %s", gasleft());
        require(recoveryMode == false || _CLVAmount == 0, "CDPManager: Debt issuance is not permitted during Recovery Mode"); // 840 gas
        // console.log("05. gas left: %s", gasleft());
        require(getUSDValue(msg.value, price) >= MIN_COLL_IN_USD, 
                "CDPManager: Dollar value of collateral deposit must equal or exceed the minimum");  // 543 gas
        // console.log("06. gas left: %s", gasleft());
        uint ICR = computeICR(msg.value, _CLVAmount, price);  // 574 gas
        // console.log("07. gas left: %s", gasleft());
        require(ICR >= MCR, "CDPManager: ICR of prospective loan must be >= than the MCR"); // 19 gas(!)
        // console.log("08. gas left: %s", gasleft());

        uint newTCR = getNewTCR(msg.value, _CLVAmount, price);  // 25700 gas
        // console.log("09. gas left: %s", gasleft());
        require (newTCR >= CCR, "CDPManager: opening a loan that would result in a TCR < CCR is not permitted");  // 10 gas
        // console.log("10. gas left: %s", gasleft());

        // Update loan properties
        CDPs[user].status = Status.active;  // 21000 gas
        // console.log("11. gas left: %s", gasleft());
        CDPs[user].coll = msg.value;  // 20100 gas
        // console.log("12. gas left: %s", gasleft());
        CDPs[user].debt = _CLVAmount; // 20100 gas
        // console.log("13. gas left: %s", gasleft());
        
        updateRewardSnapshots(user); // 3300 gas
        // console.log("14. gas left: %s", gasleft());
        updateStakeAndTotalStakes(user); // 30500 gas
        // console.log("15. gas left: %s", gasleft());

        sortedCDPs.insert(user, ICR, price, _hint, _hint); // 94000 gas
        // console.log("16. gas left: %s", gasleft());

        /* push the owner's address to the CDP owners list, and record 
        the corresponding array index on the CDP struct */
        CDPs[user].arrayIndex = CDPOwners.push(user) - 1; // 46800 gas
        // console.log("17. gas left: %s", gasleft());

        // Move the ether to the activePool, and mint CLV to the borrower
        poolManager.addColl.value(msg.value)(); // 25500 gas
        // console.log("18. gas left: %s", gasleft());
        poolManager.withdrawCLV(user, _CLVAmount); // 50500 gas
        // console.log("19. gas left: %s", gasleft());

        checkTCRAndSetRecoveryMode(price); // 26500 gas
        // console.log("20. gas left: %s", gasleft());
        emit CDPUpdated(user, 
                        _CLVAmount, 
                        msg.value
                        // CDPs[user].stake,
                        // CDPs[user].arrayIndex
                        ); // 3400 gas
        // console.log("21. gas left: %s", gasleft());
        // console.log("openLoan func end");
        return true;
    }

    // Send ETH as collateral to a CDP
    function addColl(address _user, address _hint) public payable returns (bool) {
        // console.log("00. gas left: %s", gasleft());
        bool isFirstCollDeposit;
        // console.log("01. gas left: %s", gasleft());
        uint price = priceFeed.getPrice();
        // console.log("02. gas left: %s", gasleft());

        Status status = CDPs[_user].status;
         // console.log("03. gas left: %s", gasleft());
        // if (CDPs[_user].status == Status.nonExistent || CDPs[_user].status == Status.closed ) {
        if (status == Status.nonExistent || status == Status.closed ) {
             // console.log("04. gas left: %s", gasleft());
            require(getUSDValue(msg.value, price) >= MIN_COLL_IN_USD, 
                    "CDPManager: Dollar value of collateral deposit must equal or exceed the minimum");
            // console.log("05. gas left: %s", gasleft());
            isFirstCollDeposit = true; 
            // console.log("06. gas left: %s", gasleft());
            CDPs[_user].status = Status.active;
            // console.log("07. gas left: %s", gasleft());
        } 

        // CDPs[_user].status = Status.active;
        // console.log("08. gas left: %s", gasleft());
        

        applyPendingRewards(_user);
        // console.log("09. gas left: %s", gasleft());

        // Update the CDP's coll and stake
        
        // CDPs[_user].coll = (CDPs[_user].coll).add(msg.value);
        // console.log("10. gas left: %s", gasleft());
        uint newColl = (CDPs[_user].coll).add(msg.value);
        CDPs[_user].coll = newColl;

        updateStakeAndTotalStakes(_user);
        // console.log("11. gas left: %s", gasleft());

        uint newICR = getCurrentICR(_user, price);
        // console.log("12. gas left: %s", gasleft());

        if (isFirstCollDeposit) {
            // console.log("13. gas left: %s", gasleft());
            sortedCDPs.insert(_user, newICR, price, _hint, _hint);
            // console.log("14. gas left: %s", gasleft());
             /* push the owner's address to the CDP owners list, and record 
            the corresponding array index on the CDP struct */
            CDPs[_user].arrayIndex = CDPOwners.push(_user) - 1;
            // console.log("15. gas left: %s", gasleft());
            emit CDPCreated(_user, CDPs[_user].arrayIndex);
            // console.log("16. gas left: %s", gasleft());
        } else {
            sortedCDPs.reInsert(_user, newICR, price, _hint, _hint);
            // console.log("17. gas left: %s", gasleft());
        }

        // Send the received collateral to PoolManager, to forward to ActivePool
        // console.log("00. gas left: %s", gasleft());
        poolManager.addColl.value(msg.value)();
        // console.log("18. gas left: %s", gasleft());

        checkTCRAndSetRecoveryMode(price);
        // console.log("19. gas left: %s", gasleft());
        // emit CollateralAdded(_user, msg.value);
        emit CDPUpdated(_user, 
                        CDPs[_user].debt, 
                        newColl
                        // CDPs[_user].stake,
                        // CDPs[_user].arrayIndex
                        );
        // console.log("20. gas left: %s", gasleft());
        return true;
    }
    
    // Withdraw ETH collateral from a CDP
    // TODO: Check re-entrancy protection
    function withdrawColl(uint _amount, address _hint) public returns (bool) {
        uint price = priceFeed.getPrice();
        checkTCRAndSetRecoveryMode(price);

        address user = _msgSender();
        require(CDPs[user].status == Status.active, "CDPManager: CDP does not exist or is closed");
       
        applyPendingRewards(user);
        uint coll = CDPs[user].coll;
        require(coll >= _amount, "CDPManager: Insufficient balance for ETH withdrawal");
        
        uint newColl = coll.sub(_amount);
        require(getUSDValue(newColl, price) >= MIN_COLL_IN_USD  || newColl == 0, 
                "CDPManager: Remaining collateral must have $USD value >= 20, or be zero");

        // console.log("00. gas left: %s", gasleft());
        uint newICR = getNewICRfromCollDecrease(user, _amount, price);  // 6100 gas
        // console.log("01. gas left: %s", gasleft());
        require(recoveryMode == false, "CDPManager: Collateral withdrawal is not permitted during Recovery Mode");
        require(newICR >= MCR, "CDPManager: Insufficient collateral ratio for ETH withdrawal");
        
        // Update the CDP's coll and stake
        CDPs[user].coll = newColl;
        updateStakeAndTotalStakes(user);

        if (newColl == 0) { 
            //  console.log("00. gas left: %s", gasleft());
             closeCDP(user);  // gives gas refund
            //  console.log("01. gas left: %s", gasleft());
        }  else { 
        // Update CDP's position in sortedCDPs
        sortedCDPs.reInsert(user, newICR, price, _hint, _hint);

        // emit CollateralWithdrawn(user, _amount);
        emit CDPUpdated(user, 
                        CDPs[user].debt, 
                        newColl
                        // CDPs[user].stake,
                        // CDPs[user].arrayIndex
                        ); 
        }
         // Remove _amount ETH from ActivePool and send it to the user
        poolManager.withdrawColl(user, _amount);

        return true;
    }
    
    // Withdraw CLV tokens from a CDP: mint new CLV to the owner, and increase the debt accordingly
    function withdrawCLV(uint _amount, address _hint) public returns (bool) {
        uint price = priceFeed.getPrice();
        bool recoveryMode = checkTCRAndSetRecoveryMode(price);

        address user = _msgSender();
        
        require(CDPs[user].status == Status.active, "CDPManager: CDP does not exist or is closed");
        require(_amount > 0, "CDPManager: Amount to withdraw must be larger than 0");
        
        applyPendingRewards(user);

        uint newTCR = getNewTCR(0, _amount, price);
        uint newICR = getNewICRfromDebtIncrease(user, _amount, price);
        
        require(recoveryMode == false, "CDPManager: Debt issuance is not permitted during Recovery Mode");
        require(newTCR >= CCR, "CDPManager: a CLV withdrawal that would result in TCR < CCR is not permitted");
        require(newICR >= MCR, "CDPManager: Insufficient collateral ratio for CLV withdrawal");
        
        // Increase the CDP's debt
        uint newDebt = (CDPs[user].debt).add(_amount);
        CDPs[user].debt = newDebt;

        // Update CDP's position in sortedCDPs
        sortedCDPs.reInsert(user, newICR, price, _hint, _hint);

        // Mint the given amount of CLV to the owner's address and add them to the ActivePool
        poolManager.withdrawCLV(user, _amount);
        
        // emit CLVWithdrawn(user, _amount);
        emit CDPUpdated(user, 
                        newDebt, 
                        CDPs[user].coll  
                        // CDPs[user].stake,
                        // CDPs[user].arrayIndex
                        ); 
        return true; 
    }
    
    // Repay CLV tokens to a CDP: Burn the repaid CLV tokens, and reduce the debt accordingly
    function repayCLV(uint _amount, address _hint) public returns (bool) {
        uint price = priceFeed.getPrice();
        address user = _msgSender();
        
        require(CDPs[user].status == Status.active, "CDPManager: CDP does not exist or is closed");
        require(_amount > 0, "CDPManager: Repaid amount must be larger than 0");
       
       applyPendingRewards(user);

        uint debt = CDPs[user].debt;
        require(_amount <= debt, "CDPManager: Repaid amount is larger than current debt");
        // require(CLV.balanceOf(user) >= _amount, "CDPManager: Sender has insufficient CLV balance");
        // TODO: Maybe allow foreign accounts to repay loans
        
        // Update the CDP's debt
        uint newDebt = debt.sub(_amount);
        CDPs[user].debt  = newDebt;

        uint newICR = getCurrentICR(user, price);
        
        // Update CDP's position in sortedCDPs
        sortedCDPs.reInsert(user, newICR, price, _hint, _hint);

        // Burn the received amount of CLV from the user's balance, and remove it from the ActivePool
        poolManager.repayCLV(user, _amount);

        checkTCRAndSetRecoveryMode(price);

        // emit CLVRepayed(user, _amount);
        emit CDPUpdated(user, 
                        newDebt, 
                        CDPs[user].coll 
                        // CDPs[user].stake,
                        // CDPs[user].arrayIndex
                        ); 
        return true;
    }

    // --- CDP Liquidation functions ---

    // Closes the CDP of the specified user if its individual collateral ratio is lower than the minimum collateral ratio.
    // TODO: Left public for initial testing. Make internal.
    function liquidate(address _user) public returns (bool) {
        uint price = priceFeed.getPrice();
        bool recoveryMode = checkTCRAndSetRecoveryMode(price);

        require(CDPs[_user].status == Status.active, "CDPManager: CDP does not exist or is already closed");
        
        if (recoveryMode == true) {
            liquidateRecoveryMode(_user, price);
        } else if (recoveryMode == false) {
            liquidateNormalMode(_user, price);
        }  
    }
   
    function liquidateNormalMode(address _user, uint price) internal returns (bool) {
        // console.log("00. gas left: %s", gasleft());
        // uint ICR = getCurrentICR(_user, price); // 6600 gas
        // console.log("01. gas left: %s", gasleft());

        // If ICR < MCR, check whether ETH gains from the Stability Pool would bring the ICR above the MCR
        // if (ICR < MCR) {
            // console.log("0a. gas left: %s", gasleft());
            // poolManager.withdrawFromSPtoCDP(_user); // 57000 gas (no SP deposit) / 735000 gas (SP deposit)
            // console.log("0b. gas left: %s", gasleft());
            // ICR = getCurrentICR(_user, price); // 6600 gas
            // console.log("0c. gas left: %s", gasleft());

        uint ICR = getNewICRFromPendingSPGain(_user, price);

            // If applying the ETH gain would keep the CDP active, don't liquidate 
        if (ICR > MCR) { return false; }
       
        // console.log("02. gas left: %s", gasleft());
        
        // if (ICR > MCR) { 
        //     return false; 
        // } 
        // console.log("03. gas left: %s", gasleft());
        // Apply the CDP's rewards and remove stake
        applyPendingRewards(_user); // 1800 gas
        // console.log("04. gas left: %s", gasleft());
        removeStake(_user); // 3600 gas
        // console.log("05. gas left: %s", gasleft());

        // Offset as much debt & collateral as possible against the StabilityPool and save the returned remainders
        uint[2] memory remainder = poolManager.offset(CDPs[_user].debt, CDPs[_user].coll);  // 89500 gas
        // console.log("06. gas left: %s", gasleft());
        uint CLVDebtRemainder = remainder[0];
        // console.log("07. gas left: %s", gasleft());
        uint ETHRemainder = remainder[1];
        // console.log("08. gas left: %s", gasleft());
        redistributeCollAndDebt(ETHRemainder, CLVDebtRemainder);
        // console.log("09. gas left: %s", gasleft());
        closeCDP(_user); // 61000 gas
        // console.log("10. gas left: %s", gasleft());
        updateSystemSnapshots(); // 23000 gas
        // console.log("11. gas left: %s", gasleft());
        return true;
    }

    function liquidateRecoveryMode(address _user, uint price) internal returns (bool) {
        // Withdraw any Stability Pool gains to the CDP
        // poolManager.withdrawFromSPtoCDP(_user);
        
        // uint ICR = getCurrentICR(_user, price);

        uint ICR = getNewICRFromPendingSPGain(_user, price);

        // If ICR <= 100%, redistribute the CDP across all active CDPs
        if (ICR <= 1000000000000000000) {
            applyPendingRewards(_user);
            removeStake(_user);

            // Redistribute entire coll and debt 
            uint entireColl = CDPs[_user].coll;
            uint entireDebt = CDPs[_user].debt;
            redistributeCollAndDebt(entireColl, entireDebt);

            closeCDP(_user);
            updateSystemSnapshots();

        // if 100% < ICR < MCR, offset as much as possible, and redistribute the remainder
        } else if ((ICR > 1000000000000000000) && (ICR < MCR)) {
            applyPendingRewards(_user);
            removeStake(_user);
            
            // Offset as much debt & collateral as possible against the StabilityPool and save the returned remainders
            uint[2] memory remainder = poolManager.offset(CDPs[_user].debt, CDPs[_user].coll);
            uint CLVDebtRemainder = remainder[0];
            uint ETHRemainder = remainder[1];

            redistributeCollAndDebt(ETHRemainder, CLVDebtRemainder);
    
            closeCDP(_user);
            updateSystemSnapshots();

        // If CDP has the lowest ICR and there is CLV in the Stability Pool, only offset it as much as possible (no redistribution)
        } else if ((_user == sortedCDPs.getLast()) && (poolManager.getStabilityPoolCLV() != 0)) {
            applyPendingRewards(_user);
            removeStake(_user);

            // Offset as much debt & collateral as possible against the StabilityPool and save the returned remainders
            uint[2] memory remainder = poolManager.offset(CDPs[_user].debt, CDPs[_user].coll);
            uint CLVDebtRemainder = remainder[0];
            uint ETHRemainder = remainder[1];

            // Close the CDP and update snapshots if the CDP was completely offset against CLV in Stability Pool
            if (CLVDebtRemainder == 0) {
                closeCDP(_user);
                updateSystemSnapshots();
            }

            // If loan can not be entirely offset, leave the CDP active, with a reduced coll and debt, and corresponding new stake.
            if (CLVDebtRemainder > 0) {
                // Update system snapshots, excluding the reduced collateral that remains in the CDP
                updateSystemSnapshots_excludeCollRemainder(ETHRemainder);
                
                // Give the loan a new reduced coll and debt, then update stake and totalStakes
                CDPs[_user].coll = ETHRemainder;
                CDPs[_user].debt = CLVDebtRemainder;
                updateStakeAndTotalStakes(_user);
               
                uint newICR = getCurrentICR(_user, price);
                // TODO: use getApproxHint() here? Analyze gas usage and find size of list at which getApproxHint() is a net gas-saver
                sortedCDPs.reInsert(_user, newICR, price, _user, _user);

                emit CDPUpdated(_user, 
                    CDPs[_user].debt, 
                    CDPs[_user].coll
                    // CDPs[_user].stake,
                    // CDPs[_user].arrayIndex
                    );
            }
        } 
        checkTCRAndSetRecoveryMode(price);
    }

    // Closes a maximum number of n multiple under-collateralized CDPs, starting from the one with the lowest collateral ratio
    // TODO: Should  be synchronized with PriceFeed and called every time the price is updated
    function liquidateCDPs(uint n) public returns (bool) {  
        uint price = priceFeed.getPrice();
        bool recoveryMode = checkTCRAndSetRecoveryMode(price);

        if (recoveryMode == true) {
            uint i;
            while (i < n) {
                address user = sortedCDPs.getLast();
                uint collRatio = getCurrentICR(user, price);
                // attempt to close CDP
                liquidate(user);
                /* Break loop if the system has left recovery mode and all active CDPs are 
                above the MCR, or if the loop reaches the first CDP in the sorted list  */
                if ((recoveryMode == false && collRatio >= MCR) || (user == sortedCDPs.getFirst())) { break; }
                i++;
            }
            return true;

        } else if (recoveryMode == false) {
            uint i;
            while (i < n) {
                address user = sortedCDPs.getLast();
                uint collRatio = getCurrentICR(user, price);

                // Close CDPs if it is under-collateralized
                if (collRatio < MCR) {
                    liquidate(user);
                } else break;
                
                // Break loop if you reach the first CDP in the sorted list 
                if (user == sortedCDPs.getFirst()) { break ;}
                i++;
            }       
        }
        return true;
    }
            
    /* Send _amount CLV to the system and redeem the corresponding amount of collateral from as many CDPs as are needed to fill the redemption
     request.  Applies pending rewards to a CDP before reducing its debt and coll.
    
    Note that if _amount is very large, this function can run out of gas. This can be easily avoided by splitting the total _amount
    in appropriate chunks and calling the function multiple times.
    
    TODO: Maybe also use the default pool for redemptions
    TODO: Levy a redemption fee (and maybe also impose a rate limit on redemptions) */
    function redeemCollateral(uint _CLVamount, address _hint) public returns (bool) {
        // require(CLV.balanceOf(_msgSender()) >= _CLVamount, "CDPManager: Sender has insufficient balance"); // *** 7300 gas
        uint exchangedCLV;
        uint redeemedETH;
        uint price = priceFeed.getPrice(); // 3500 gas
        // console.log("02. gas left: %s", gasleft());
        // Loop through the CDPs starting from the one with lowest collateral ratio until _amount of CLV is exchanged for collateral
        while (exchangedCLV < _CLVamount) {
            // console.log("exchanged CLV is %s", exchangedCLV);
            // console.log("redeemed ETH is %s", redeemedETH);
            address currentCDPuser = sortedCDPs.getLast();  // 3500 gas (for 10 CDPs in list)
            // console.log("currentCDPUser is %s", currentCDPuser);
            // console.log("03. gas left: %s", gasleft());
            // uint collRatio = getCurrentICR(currentCDPuser, price); // *** 14500 gas
            // console.log("04. gas left: %s", gasleft());
            // uint price = priceFeed.getPrice(); // 3500 gas
            // console.log("05. gas left: %s", gasleft());
            // uint activeDebt = poolManager.getActiveDebt(); // *** 6100 gas
            // console.log("06. gas left: %s", gasleft());

            // Break the loop if there is no more active debt to cancel with the received CLV
            // if (poolManager.getActiveDebt() == 0) break;
            if (activePool.getCLV() == 0) break;   
            
            // Close CDPs along the way that turn out to be under-collateralized
            if (getCurrentICR(currentCDPuser, price) < MCR) {
                liquidate(currentCDPuser);
            }
            else {
                applyPendingRewards(currentCDPuser); // *** 46000 gas (no rewards!)
                // console.log("07. gas left: %s", gasleft());

                // Determine the remaining amount (lot) to be redeemed, capped by the entire debt of the current CDP 
                uint CLVLot = DeciMath.getMin(_CLVamount.sub(exchangedCLV), CDPs[currentCDPuser].debt); // 1200 gas
                // console.log("CLVLot in loop is is %s", CLVLot);
                // console.log("08. gas left: %s", gasleft());
                // uint ETHLot = DeciMath.accurateMulDiv(CLVLot, 1e18, price); // 1950 gas
                // console.log("09. gas left: %s", gasleft());
                uint ETHLot = uint(ABDKMath64x64.divu(CLVLot, uint(ABDKMath64x64.divu(price, 1e18))));
                // console.log("ETHLot in loop is is %s", ETHLot);
                // Decrease the debt and collateral of the current CDP according to the lot and corresponding ETH to send
                uint newDebt = (CDPs[currentCDPuser].debt).sub(CLVLot);
                CDPs[currentCDPuser].debt = newDebt; // 6200 gas
                // console.log("new debt is %s", newDebt);
                // console.log("10. gas left: %s", gasleft());
                uint newColl = (CDPs[currentCDPuser].coll).sub(ETHLot);
                CDPs[currentCDPuser].coll = newColl; // 6200 gas
                // console.log("new coll is %s", newColl);
                // console.log("11. gas left: %s", gasleft());
                // console.log("new ICR is %s", getCurrentICR(currentCDPuser, price));
                // uint newCollRatio = getCurrentICR(currentCDPuser, price); // *** 14500 gas
                // console.log("12. gas left: %s", gasleft());
                // Burn the calculated lot of CLV and send the corresponding ETH to _msgSender()
                poolManager.redeemCollateral(_msgSender(), CLVLot, ETHLot); // *** 57000 gas
                // console.log("13. gas left: %s", gasleft());
                // Update the sortedCDPs list and the redeemed amount
                sortedCDPs.reInsert(currentCDPuser, getCurrentICR(currentCDPuser, price), price, _hint, _hint); // *** 62000 gas
                // console.log("14. gas left: %s", gasleft());
                emit CDPUpdated(
                                currentCDPuser, 
                                newDebt, 
                                newColl
                                // CDPs[currentCDPuser].stake,
                                // CDPs[currentCDPuser].arrayIndex
                                ); // *** 5600 gas
                // console.log("15. gas left: %s", gasleft()); 

                exchangedCLV = exchangedCLV.add(CLVLot);  // 102 gas
                // console.log("exchanged CLV is %s", exchangedCLV);
                 
                // console.log("16. gas left: %s", gasleft());
                redeemedETH = redeemedETH.add(ETHLot); // 106 gas
                // console.log("17. gas left: %s", gasleft());
                // console.log("redeemed ETH is %s", redeemedETH);
                // console.log("CLV Amount is %s", _CLVamount);
            }
        }

        // emit CollateralRedeemed(_msgSender(), exchangedCLV, redeemedETH); // *** 1800 gas
        // console.log("18. gas left: %s", gasleft());
    } 

    // --- Helper functions ---

     /* getApproxHint() - return address of a CDP that is, on average, (length / numTrials) positions away in the 
    sortedCDPs list from the correct insert position of the CDP to be inserted. 
    
    Note: The output address is worst-case O(n) positions away from the correct insert position, however, the function 
    is probabilistic. Input can be tuned to guarantee results to a high degree of confidence, e.g:

    Submitting numTrials = k * sqrt(length), with k = 15 makes it very, very likely that the ouput address will 
    be <= sqrt(length) positions away from the correct insert position.
   
    Note on the use of block.timestamp for random number generation: it is known to be gameable by miners. However, no value 
    transmission depends on getApproxHint() - it is only used to generate hints for efficient list traversal. In this case, 
    there is no profitable exploit.
    */
    function getApproxHint(uint CR, uint numTrials) public view returns(address) {
        require (CDPOwners.length >= 1, "CDPManager: sortedList must not be empty");
        uint price = priceFeed.getPrice();
        address hintAddress = sortedCDPs.getLast();
        uint closestICR = getCurrentICR(hintAddress, price);
        uint diff = getAbsoluteDifference(CR, closestICR);
        uint i = 1;

        while (i < numTrials) {
            uint arrayIndex = getRandomArrayIndex(block.timestamp.add(i), CDPOwners.length);
            address currentAddress = CDPOwners[arrayIndex];
            uint currentICR = getCurrentICR(currentAddress, price);

            // check if abs(current - CR) > abs(closest - CR), and update closest if current is closer
            uint currentDiff = getAbsoluteDifference(currentICR, CR);

            if (currentDiff < diff) {
                closestICR = currentICR;
                diff = currentDiff;
                hintAddress = currentAddress;
            }
            i++;
        }
    return hintAddress;
}

    function getAbsoluteDifference(uint a, uint b) internal view returns(uint) {
        if (a >= b) {
            return a.sub(b);
        } else if (a < b) {
            return b.sub(a);
        }
    }

    // Convert input to pseudo-random uint in range [0, arrayLength - 1]
    function getRandomArrayIndex(uint input, uint _arrayLength) internal view returns(uint) {
        uint randomIndex = uint256(keccak256(abi.encodePacked(input))) % (_arrayLength);
        return randomIndex;
   }

    // Return the current collateral ratio (ICR) of a given CDP. Takes pending coll/debt rewards into account.
    function getCurrentICR(address _user, uint _price) public view returns(uint) {
        // console.log("00. gas left: %s", gasleft());

        uint pendingETHReward = computePendingETHReward(_user); // 3700 gas (no rewards!)  ABDK: 3100
        // console.log("01. /gas left: %s", gasleft());
        uint pendingCLVDebtReward = computePendingCLVDebtReward(_user);  // 3700 gas (no rewards!).  ABDK: 3100
        // console.log("02. gas left: %s", gasleft());
        uint currentETH = CDPs[_user].coll.add(pendingETHReward); // 1000 gas
        // console.log("03. gas left: %s", gasleft());
        uint currentCLVDebt = CDPs[_user].debt.add(pendingCLVDebtReward);  // 988 gas
        // console.log("04. gas left: %s", gasleft());
        // console.log("getCurrentICR::currentETH is %s", currentETH);
        // console.log("getCurrentICR::currentCLVDebt is %s", currentCLVDebt);
        // console.log("getCurrentICR::price is %s", _price);
        uint ICR = computeICR(currentETH, currentCLVDebt, _price);  // 3500-5000 gas - low/high depends on zero/non-zero debt. ABDK: 100-500
        // console.log("05. gas left: %s", gasleft());
        return ICR;
    }

    /* Compute the new collateral ratio, considering the collateral to be removed. Takes pending coll/debt 
    rewards into account. */
    function getNewICRfromCollDecrease(address _user, uint _collDecrease, uint _price) view internal returns(uint) {
        uint pendingETHReward = computePendingETHReward(_user);
        uint pendingCLVDebtReward = computePendingCLVDebtReward(_user);

        uint currentETH = CDPs[_user].coll.add(pendingETHReward);
        uint currentCLVDebt = CDPs[_user].debt.add(pendingCLVDebtReward);

        uint newColl = currentETH.sub(_collDecrease);
        
        return computeICR(newColl, currentCLVDebt, _price);
    }

    /* Compute the new collateral ratio, considering the debt to be added.Takes pending coll/debt rewards into account. */
    function getNewICRfromDebtIncrease(address _user, uint _debtIncrease, uint _price) view internal returns(uint) {
        uint pendingETHReward = computePendingETHReward(_user);
        uint pendingCLVDebtReward = computePendingCLVDebtReward(_user);

        uint currentETH = CDPs[_user].coll.add(pendingETHReward);
        uint currentCLVDebt = CDPs[_user].debt.add(pendingCLVDebtReward);

        uint newCLVDebt = currentCLVDebt.add(_debtIncrease);

        return computeICR(currentETH, newCLVDebt, _price);
    } 

    function getNewICRFromPendingSPGain(address _user, uint price) internal returns (uint) {
        // Get rewards from direct distributions
        uint pendingETHReward = computePendingETHReward(_user);
        uint pendingCLVDebtReward = computePendingCLVDebtReward(_user);

        // Get ETH Gain from StabilityPool deposit
        uint ETHGainFromSP = poolManager.getCurrentETHGain(_user);
        
        uint newColl = CDPs[_user].coll.add(pendingETHReward).add(ETHGainFromSP);
        uint newCLVDebt = CDPs[_user].debt.add(pendingCLVDebtReward);

        uint newICR = computeICR(newColl, newCLVDebt, price);
        return newICR;
    }

    function computeICR(uint _coll, uint _debt, uint _price) view internal returns(uint) {
        // console.log("computeICR func start");
        // console.log("00. gas left: %s", gasleft());
        // uint price = priceFeed.getPrice(); // 3579 gas
        // console.log("01. gas left: %s", gasleft());

        // console.log("computeICR::coll is %s", _coll);
        // console.log("computeICR::debt is %s", _debt);
        // console.log("computeICR::price is %s", _price);

        // Check if the total debt is higher than 0, to avoid division by 0
        if (_debt > 0) {
            // console.log("02. gas left: %s", gasleft());
            // uint ratio = DeciMath.div_toDuint(_coll, _debt); // 1000 gas
            // console.log("03. gas left: %s", gasleft());
            // uint newCollRatio = DeciMath.decMul(_price, ratio); // 460 gas
             // console.log("04. gas left: %s", gasleft());

            uint newCollRatio = ABDKMath64x64.mulu(ABDKMath64x64.divu(_coll, _debt), _price);
           
            return newCollRatio;
        }
        // Return the maximal value for uint256 if the CDP has a debt of 0
        else {
            // console.log("05. gas left: %s", gasleft());
            return 2**256 - 1; 
            // console.log("06. gas left: %s", gasleft());
        }
        // console.log("SortedCDPs.insert func end");
    }

    // Add the user's coll and debt rewards earned from liquidations, to their CDP
    function applyPendingRewards(address _user) internal returns(bool) {
        // console.log("00. gas left: %s", gasleft());
        if (rewardSnapshots[_user].ETH == L_ETH) { return false; }
        require(CDPs[_user].status == Status.active, "CDPManager: user must have an active CDP");  // 2866 gas (no rewards)

        // console.log("01. gas left: %s", gasleft());
        // Compute pending rewards
        uint pendingETHReward = computePendingETHReward(_user); // 5530 gas  (no rewards)
        // console.log("02. gas left: %s", gasleft());
        uint pendingCLVDebtReward = computePendingCLVDebtReward(_user);  // 5540 gas  (no rewards)
        // console.log("03. gas left: %s", gasleft());

        // Apply pending rewards
        CDPs[_user].coll = CDPs[_user].coll.add(pendingETHReward);  // 3800 gas (no rewards)
        // console.log("04. gas left: %s", gasleft());
        CDPs[_user].debt = CDPs[_user].debt.add(pendingCLVDebtReward); // 3800 gas (no rewards)
        // console.log("05. gas left: %s", gasleft());

        // Tell PM to transfer from DefaultPool to ActivePool when user claims rewards.
        poolManager.applyPendingRewards(pendingCLVDebtReward, pendingETHReward);  // 33000 gas (no rewards)
        // console.log("06. gas left: %s", gasleft());

        updateRewardSnapshots(_user); // 5259 (no rewards)
        // console.log("07. gas left: %s", gasleft());
        return true;
    }

    // Update user's snapshots of L_ETH and L_CLVDebt to reflect the current values
    function updateRewardSnapshots(address _user) internal returns(bool) {
        // console.log("00. gas left: %s", gasleft());
        rewardSnapshots[_user].ETH = L_ETH; // 1700 gas (no rewards)
        // console.log("01. gas left: %s", gasleft());
        rewardSnapshots[_user].CLVDebt = L_CLVDebt; // 1700 gas (no rewards)
        // console.log("02. gas left: %s", gasleft());
        return true;
    }

    // Get the user's pending accumulated ETH reward, earned by its stake
    function computePendingETHReward(address _user) internal view returns(uint) {
        uint snapshotETH = rewardSnapshots[_user].ETH; // 913 gas (no reward)
        uint rewardPerUnitStaked = L_ETH.sub(snapshotETH); 
        
        if ( rewardPerUnitStaked == 0 ) { return 0; }
       
        // console.log("0. gas left: %s", gasleft());
        uint stake = CDPs[_user].stake;  // 950 gas (no reward)
        // // console.log("1. gas left: %s", gasleft());
        
        // // console.log("2. gas left: %s", gasleft()); 
        // uint rewardPerUnitStaked = L_ETH.sub(snapshotETH); // 998 (no reward)
        // // console.log("3. gas left: %s", gasleft()); 
        // uint pendingETHReward = DeciMath.mul_uintByDuint(stake, rewardPerUnitStaked); // 1000 gas (no reward)
        // // console.log("4. gas left: %s", gasleft());// console.log("0. gas left: %s", gasleft());

        uint pendingETHReward = ABDKMath64x64.mulu(ABDKMath64x64.divu(rewardPerUnitStaked, 1e18), stake);
        return pendingETHReward;
    }

     // Get the user's pending accumulated CLV reward, earned by its stake
    function computePendingCLVDebtReward(address _user) internal view returns(uint) {
        uint snapshotCLVDebt = rewardSnapshots[_user].CLVDebt;  // 900 gas
        uint rewardPerUnitStaked = L_CLVDebt.sub(snapshotCLVDebt); 
       
        if ( rewardPerUnitStaked == 0 ) { return 0; }
       
        // console.log("00. gas left: %s", gasleft());
        uint stake =  CDPs[_user].stake;  // 900 gas
        // // console.log("01. gas left: %s", gasleft());
        
        // // console.log("02. gas left: %s", gasleft());

        // uint rewardPerUnitStaked = L_CLVDebt.sub(snapshotCLVDebt);  // 900 gas
        // // console.log("03. gas left: %s", gasleft());
        // uint pendingCLVDebtReward = DeciMath.mul_uintByDuint(stake, rewardPerUnitStaked);  // 900 gas
        // // console.log("04. gas left: %s", gasleft());

        uint pendingCLVDebtReward = ABDKMath64x64.mulu(ABDKMath64x64.divu(rewardPerUnitStaked, 1e18), stake);
        return pendingCLVDebtReward;
    }

    // Remove use's stake from the totalStakes sum, and set their stake to 0
    function removeStake(address _user) internal returns (bool) {
        uint stake = CDPs[_user].stake;
        totalStakes = totalStakes.sub(stake);
        CDPs[_user].stake = 0;
    }

    // Update user's stake based on their latest collateral value
    function updateStakeAndTotalStakes(address _user) internal returns(bool) {
        // console.log("updateStakeAndTotalStakes func start");
        // console.log("00. gas left: %s", gasleft());
        // uint oldStake = CDPs[_user].stake; // 930 gas
        // console.log("01. gas left: %s", gasleft());
        // totalStakes = totalStakes.sub(oldStake);  // 1800 gas
        // console.log("02. gas left: %s", gasleft());
        // uint newStake = computeNewStake(CDPs[_user].coll); // 1800 gas
        // console.log("03. gas left: %s", gasleft());

        // CDPs[_user].stake = newStake;  // 20100 gas 
        // console.log("04. gas left: %s", gasleft());
        // totalStakes = totalStakes.add(newStake);  // 6000 gas
        // console.log("05. gas left: %s", gasleft());
        // console.log("updateStakeAndTotalStakes func end");

        uint newStake = computeNewStake(CDPs[_user].coll); 
        uint oldStake = CDPs[_user].stake;
        CDPs[_user].stake = newStake;
        totalStakes = totalStakes.sub(oldStake).add(newStake);

        return true;
    }

    function computeNewStake(uint _coll) internal view returns (uint) {
        uint stake;
        if (totalCollateralSnapshot == 0) {
            stake = _coll;
        } else {
            // uint ratio = DeciMath.div_toDuint(totalStakesSnapshot, totalCollateralSnapshot);
            // stake = DeciMath.mul_uintByDuint(_coll, ratio);
            stake = ABDKMath64x64.mulu(ABDKMath64x64.divu(totalStakesSnapshot, totalCollateralSnapshot), _coll);
        }
     return stake;
    }

    function redistributeCollAndDebt(uint _coll, uint _debt) internal returns (bool) {
        if (_debt > 0) {
            if (totalStakes > 0) {
                /*If debt could not be offset entirely, add the coll and debt rewards-per-unit-staked 
                to the running totals. */
                // uint ETHRewardPerUnitStaked = DeciMath.div_toDuint(_coll, totalStakes);
                // uint CLVDebtRewardPerUnitStaked = DeciMath.div_toDuint(_debt, totalStakes);

                uint ETHRewardPerUnitStaked = ABDKMath64x64.mulu(ABDKMath64x64.divu(_coll, totalStakes), 1e18);
                uint CLVDebtRewardPerUnitStaked = ABDKMath64x64.mulu(ABDKMath64x64.divu(_debt, totalStakes), 1e18);
                
                // L_ETH = L_ETH.add(ETHRewardPerUnitStaked);
                // L_CLVDebt = L_CLVDebt.add(CLVDebtRewardPerUnitStaked);

                L_ETH = L_ETH.add(ETHRewardPerUnitStaked);
                L_CLVDebt = L_CLVDebt.add(CLVDebtRewardPerUnitStaked);
            }
            // Transfer coll and debt from ActivePool to DefaultPool
            poolManager.liquidate(_debt, _coll);
        } 
    }

    function closeCDP(address _user) internal returns (bool) {
        CDPs[_user].status = Status.closed;
        CDPs[_user].coll = 0;
        CDPs[_user].debt = 0;
        // console.log("00. gas left: %s", gasleft());
        sortedCDPs.remove(_user);
        // console.log("01. gas left: %s", gasleft());
        removeCDPOwner(_user);
        // console.log("02. gas left: %s", gasleft());

        return true;
    }

    // Update the snapshots of system stakes & system collateral
    function updateSystemSnapshots() internal returns (bool) {
        totalStakesSnapshot = totalStakes;

        /* The total collateral snapshot is the sum of all active collateral and all pending rewards
       (ActivePool ETH + DefaultPool ETH), immediately after the liquidation occurs. */
        uint activeColl = activePool.getETH();
        uint liquidatedColl = defaultPool.getETH();
        totalCollateralSnapshot = activeColl.add(liquidatedColl);

        return true;
    }

    // Updates snapshots of system stakes and system collateral, excluding a given collateral remainder from the calculation
     function updateSystemSnapshots_excludeCollRemainder(uint _collRemainder) internal returns (bool) {
        totalStakesSnapshot = totalStakes;

        uint activeColl = activePool.getETH();
        uint liquidatedColl = defaultPool.getETH();
        totalCollateralSnapshot = activeColl.sub(_collRemainder).add(liquidatedColl);

        return true;
    }
  
     /* Remove a CDP owner from the CDPOwners array, preserving array length but not order. Deleting owner 'B' does the following: 
    [A B C D E] => [A E C D], and updates E's CDP struct to point to its new array index. */
    function removeCDPOwner(address _user) internal returns(bool) {
        require(CDPs[_user].status == Status.closed, "CDPManager: CDP is still active");

        uint index = CDPs[_user].arrayIndex;   
        address addressToMove = CDPOwners[CDPOwners.length - 1];
       
        CDPOwners[index] = addressToMove;   
        CDPs[addressToMove].arrayIndex = index;   
        CDPOwners.length--;  
    }

    // Get the dollar value of collateral, as a duint
    function getUSDValue(uint _coll, uint _price) internal view returns (uint) {
        // return DeciMath.decMul(_price, _coll);
        // console.log("00. gas left: %s", gasleft());
        uint usdValue = ABDKMath64x64.mulu(ABDKMath64x64.divu(_price, 1000000000000000000), _coll);  // 500 gas
        // console.log("01. gas left: %s", gasleft());
        return usdValue;
    }

    function getNewTCR(uint _collIncrease, uint _debtIncrease, uint _price) public view returns (uint) {
    //    console.log("getNewTCR func start");
        // uint activeColl = poolManager.getActiveColl();
        // uint activeDebt = poolManager.getActiveDebt();
        // uint liquidatedColl = poolManager.getLiquidatedColl();
        // uint closedDebt = poolManager.getClosedDebt();

        uint activeColl = activePool.getETH();
        uint activeDebt = activePool.getCLV();
        uint liquidatedColl = defaultPool.getETH();
        uint closedDebt = defaultPool.getCLV();

        uint totalCollateral = activeColl.add(liquidatedColl).add(_collIncrease);
        uint newTotalDebt = activeDebt.add(closedDebt).add(_debtIncrease);

        uint newTCR = computeICR(totalCollateral, newTotalDebt, _price);
        // console.log("getNewTCR func end");
        return newTCR;
    }

    function checkTCRAndSetRecoveryMode(uint _price) public returns (bool){
        // console.log("checkTCRAndSet... func start");
        // console.log("00. gas left: %s", gasleft());
        // uint activeColl = poolManager.getActiveColl(); // 6200 gas
        // console.log("01. gas left: %s", gasleft());
        // uint activeDebt = poolManager.getActiveDebt(); // 6150 gas
        // console.log("02. gas left: %s", gasleft());
        // uint liquidatedColl = poolManager.getLiquidatedColl(); // 6150 gas
        // console.log("03. gas left: %s", gasleft());
        // uint closedDebt = poolManager.getClosedDebt(); // 6150 gas
        // console.log("04. gas left: %s", gasleft());

        uint activeColl = activePool.getETH();
        uint activeDebt = activePool.getCLV();
        uint liquidatedColl = defaultPool.getETH();
        uint closedDebt = defaultPool.getCLV();

        uint totalCollateral  = activeColl.add(liquidatedColl); // 86 gas
        // console.log("05. gas left: %s", gasleft());
        uint totalDebt = activeDebt.add(closedDebt); // 90 gas
        // console.log("06. gas left: %s", gasleft());

        uint TCR = computeICR(totalCollateral, totalDebt, _price); // 575 gas
        // console.log("07. gas left: %s", gasleft());
        
        /* if TCR falls below 150%, trigger recovery mode. If TCR rises above 150%, 
        disable recovery mode */
        bool recoveryModeInMem;

        if ((TCR < 1500000000000000000) && (recoveryMode == false)) {
            recoveryMode = true;
            recoveryModeInMem = true;
        } else if ((TCR >= 1500000000000000000) && (recoveryMode == true)) {
            recoveryMode = false;
            recoveryModeInMem = false;
        }
        // console.log("08. gas left: %s", gasleft());  // 900 gas
        // console.log("checkTCRAndSet... func end");
        return recoveryModeInMem;
    }
}