// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "./Interfaces/IBorrowerOperations.sol";
import "./Interfaces/ITroveManager.sol";
import "./Interfaces/IZSUSDToken.sol";
import "./Interfaces/ICollSurplusPool.sol";
import "./Interfaces/ISortedTroves.sol";
import "./Interfaces/IZEROStaking.sol";
import "./Interfaces/IFeeDistributor.sol";
import "./Interfaces/IApproveAndCall.sol";
import "./Dependencies/LiquityBase.sol";
import "./Dependencies/CheckContract.sol";
import "./Dependencies/console.sol";
import "./BorrowerOperationsStorage.sol";

contract BorrowerOperations is LiquityBase, BorrowerOperationsStorage, CheckContract, IBorrowerOperations, IApproveAndCall {
    /* --- Variable container structs  ---

    Used to hold, return and assign variables inside a function, in order to avoid the error:
    "CompilerError: Stack too deep". */

     struct LocalVariables_adjustTrove {
        uint price;
        uint collChange;
        uint netDebtChange;
        bool isCollIncrease;
        uint debt;
        uint coll;
        uint oldICR;
        uint newICR;
        uint newTCR;
        uint ZSUSDFee;
        uint newDebt;
        uint newColl;
        uint stake;
        uint newNICR;
        bool isRecoveryMode;
    }

    struct LocalVariables_openTrove {
        uint price;
        uint ZSUSDFee;
        uint netDebt;
        uint compositeDebt;
        uint ICR;
        uint NICR;
        uint stake;
        uint arrayIndex;
    }

    struct ContractsCache {
        ITroveManager troveManager;
        IActivePool activePool;
        IZSUSDToken zsusdToken;
    }

    enum BorrowerOperation {
        openTrove,
        closeTrove,
        adjustTrove
    }
    
    event SOVTokenAddressChanged(address _sovTokenAddress);
    event FeeDistributorAddressChanged(address _feeDistributorAddress);
    event TroveManagerAddressChanged(address _newTroveManagerAddress);
    event ActivePoolAddressChanged(address _activePoolAddress);
    event DefaultPoolAddressChanged(address _defaultPoolAddress);
    event StabilityPoolAddressChanged(address _stabilityPoolAddress);
    event GasPoolAddressChanged(address _gasPoolAddress);
    event CollSurplusPoolAddressChanged(address _collSurplusPoolAddress);
    event PriceFeedAddressChanged(address  _newPriceFeedAddress);
    event SortedTrovesAddressChanged(address _sortedTrovesAddress);
    event ZSUSDTokenAddressChanged(address _zsusdTokenAddress);
    event ZEROStakingAddressChanged(address _zeroStakingAddress);

    event TroveCreated(address indexed _borrower, uint arrayIndex);
    event TroveUpdated(address indexed _borrower, uint _debt, uint _coll, uint stake, BorrowerOperation operation);
    event ZSUSDBorrowingFeePaid(address indexed _borrower, uint _ZSUSDFee);
    
    // --- Dependency setters ---

    function setAddresses(
        address _sovTokenAddress,
        address _feeDistributorAddress,
        address _liquityBaseParamsAddress,
        address _troveManagerAddress,
        address _activePoolAddress,
        address _defaultPoolAddress,
        address _stabilityPoolAddress,
        address _gasPoolAddress,
        address _collSurplusPoolAddress,
        address _priceFeedAddress,
        address _sortedTrovesAddress,
        address _zsusdTokenAddress,
        address _zeroStakingAddress
    )
        external
        override
        onlyOwner
    {
        // This makes impossible to open a trove with zero withdrawn ZSUSD
        assert(MIN_NET_DEBT > 0);

        checkContract(_sovTokenAddress);
        checkContract(_feeDistributorAddress);
        checkContract(_liquityBaseParamsAddress);
        checkContract(_troveManagerAddress);
        checkContract(_activePoolAddress);
        checkContract(_defaultPoolAddress);
        checkContract(_stabilityPoolAddress);
        checkContract(_gasPoolAddress);
        checkContract(_collSurplusPoolAddress);
        checkContract(_priceFeedAddress);
        checkContract(_sortedTrovesAddress);
        checkContract(_zsusdTokenAddress);
        checkContract(_zeroStakingAddress);

        sovToken = IERC20(_sovTokenAddress);
        feeDistributor = IFeeDistributor (_feeDistributorAddress);
        liquityBaseParams = ILiquityBaseParams(_liquityBaseParamsAddress);
        troveManager = ITroveManager(_troveManagerAddress);
        activePool = IActivePool(_activePoolAddress);
        defaultPool = IDefaultPool(_defaultPoolAddress);
        stabilityPoolAddress = _stabilityPoolAddress;
        gasPoolAddress = _gasPoolAddress;
        collSurplusPool = ICollSurplusPool(_collSurplusPoolAddress);
        priceFeed = IPriceFeed(_priceFeedAddress);
        sortedTroves = ISortedTroves(_sortedTrovesAddress);
        zsusdToken = IZSUSDToken(_zsusdTokenAddress);
        zeroStakingAddress = _zeroStakingAddress;
        zeroStaking = IZEROStaking(_zeroStakingAddress);

        emit SOVTokenAddressChanged(_sovTokenAddress);
        emit FeeDistributorAddressChanged(_feeDistributorAddress);
        emit TroveManagerAddressChanged(_troveManagerAddress);
        emit ActivePoolAddressChanged(_activePoolAddress);
        emit DefaultPoolAddressChanged(_defaultPoolAddress);
        emit StabilityPoolAddressChanged(_stabilityPoolAddress);
        emit GasPoolAddressChanged(_gasPoolAddress);
        emit CollSurplusPoolAddressChanged(_collSurplusPoolAddress);
        emit PriceFeedAddressChanged(_priceFeedAddress);
        emit SortedTrovesAddressChanged(_sortedTrovesAddress);
        emit ZSUSDTokenAddressChanged(_zsusdTokenAddress);
        emit ZEROStakingAddressChanged(_zeroStakingAddress);
    }

    function setMassetAddress(address _massetAddress) onlyOwner external {
        masset = IMasset(_massetAddress);
    }

	function receiveApproval(
		address _sender,
		uint256 _amount,
		address _token,
		bytes calldata _data
	) external override {
        require(msg.sender == address(sovToken), "Only SOV token can call this contract");
        (bool success, bytes memory returndata) = address(this).call(_data);
        require(success, string(returndata));
    }

    function openTroveFrom(address _owner, uint _maxFeePercentage, uint _ZSUSDAmount, address _upperHint, address _lowerHint, uint _amount) external override {
        _openTrove(_maxFeePercentage, _ZSUSDAmount, _upperHint, _lowerHint, _owner, _amount, _owner);
    }

    function openTrove(uint _maxFeePercentage, uint _ZSUSDAmount, address _upperHint, address _lowerHint, uint _amount) external override {
        _openTrove(_maxFeePercentage, _ZSUSDAmount, _upperHint, _lowerHint, msg.sender, _amount, msg.sender);
    }

    // --- Borrower Trove Operations ---
    function _openTrove(uint _maxFeePercentage, uint _ZSUSDAmount, address _upperHint, address _lowerHint, address _sender, uint256 value, address _tokensRecipient) internal {
        ContractsCache memory contractsCache = ContractsCache(troveManager, activePool, zsusdToken);
        LocalVariables_openTrove memory vars;

        vars.price = priceFeed.fetchPrice();
        bool isRecoveryMode = _checkRecoveryMode(vars.price);

        _requireValidMaxFeePercentage(_maxFeePercentage, isRecoveryMode);
        _requireTroveisNotActive(contractsCache.troveManager, _sender);

        vars.ZSUSDFee;
        vars.netDebt = _ZSUSDAmount;

        if (!isRecoveryMode) {
            vars.ZSUSDFee = _triggerBorrowingFee(contractsCache.troveManager, contractsCache.zsusdToken, _ZSUSDAmount, _maxFeePercentage);
            vars.netDebt = vars.netDebt.add(vars.ZSUSDFee);
        }
        _requireAtLeastMinNetDebt(vars.netDebt);

        // ICR is based on the composite debt, i.e. the requested ZSUSD amount + ZSUSD borrowing fee + ZSUSD gas comp.
        vars.compositeDebt = _getCompositeDebt(vars.netDebt);
        assert(vars.compositeDebt > 0);
        
        vars.ICR = LiquityMath._computeCR(value, vars.compositeDebt, vars.price);
        vars.NICR = LiquityMath._computeNominalCR(value, vars.compositeDebt);

        if (isRecoveryMode) {
            _requireICRisAboveCCR(vars.ICR);
        } else {
            _requireICRisAboveMCR(vars.ICR);
            uint newTCR = _getNewTCRFromTroveChange(value, true, vars.compositeDebt, true, vars.price);  // bools: coll increase, debt increase
            _requireNewTCRisAboveCCR(newTCR); 
        }

        // Set the trove struct's properties
        contractsCache.troveManager.setTroveStatus(_sender, 1);
        contractsCache.troveManager.increaseTroveColl(_sender, value);
        contractsCache.troveManager.increaseTroveDebt(_sender, vars.compositeDebt);

        contractsCache.troveManager.updateTroveRewardSnapshots(_sender);
        vars.stake = contractsCache.troveManager.updateStakeAndTotalStakes(_sender);

        sortedTroves.insert(_sender, vars.NICR, _upperHint, _lowerHint);
        vars.arrayIndex = contractsCache.troveManager.addTroveOwnerToArray(_sender);
        emit TroveCreated(_sender, vars.arrayIndex);

        // Move the SOV to the Active Pool, and mint the ZSUSDAmount to the borrower
        _activePoolAddColl(_sender, contractsCache.activePool, value);
        _withdrawZSUSD(contractsCache.activePool, contractsCache.zsusdToken, _tokensRecipient, _ZSUSDAmount, vars.netDebt);
        // Move the ZSUSD gas compensation to the Gas Pool
        _withdrawZSUSD(contractsCache.activePool, contractsCache.zsusdToken, gasPoolAddress, ZSUSD_GAS_COMPENSATION, ZSUSD_GAS_COMPENSATION);

        emit TroveUpdated(_sender, vars.compositeDebt, value, vars.stake, BorrowerOperation.openTrove);
        emit ZSUSDBorrowingFeePaid(_sender, vars.ZSUSDFee);
    }

    /// Send SOV as collateral to a trove
    function addCollFrom(address _troveOwner, address _upperHint, address _lowerHint, uint _amount) external override {
        _adjustSenderTrove(_troveOwner, 0, 0, false, _upperHint, _lowerHint, 0, _troveOwner, _amount, _troveOwner);
    }

    function addColl(address _upperHint, address _lowerHint, uint _amount) external override {
        _adjustTrove(msg.sender, 0, 0, false, _upperHint, _lowerHint, 0, _amount);
    }

    /// Send SOV as collateral to a trove. Called by only the Stability Pool.
    function moveSOVGainToTrove(address _borrower, address _upperHint, address _lowerHint, uint _amount) external override {
        _requireCallerIsStabilityPool();
        _adjustTrove(_borrower, 0, 0, false, _upperHint, _lowerHint, 0, _amount);
    }

    /// Withdraw SOV collateral from a trove
    function withdrawColl(uint _collWithdrawal, address _upperHint, address _lowerHint) external override {
        _adjustTrove(msg.sender, _collWithdrawal, 0, false, _upperHint, _lowerHint, 0, 0);
    }

    /// Withdraw ZSUSD tokens from a trove: mint new ZSUSD tokens to the owner, and increase the trove's debt accordingly
    function withdrawZSUSD(uint _maxFeePercentage, uint _ZSUSDAmount, address _upperHint, address _lowerHint) external override {
        _adjustTrove(msg.sender, 0, _ZSUSDAmount, true, _upperHint, _lowerHint, _maxFeePercentage, 0);
    }

    /// Repay ZSUSD tokens to a Trove: Burn the repaid ZSUSD tokens, and reduce the trove's debt accordingly
    function repayZSUSD(uint _ZSUSDAmount, address _upperHint, address _lowerHint) external override {
        _adjustTrove(msg.sender, 0, _ZSUSDAmount, false, _upperHint, _lowerHint, 0, 0);
    }

    function adjustTrove(uint _maxFeePercentage, uint _collWithdrawal, uint _ZSUSDChange, bool _isDebtIncrease, address _upperHint, address _lowerHint, uint _amount) external override {
        _adjustTrove(msg.sender, _collWithdrawal, _ZSUSDChange, _isDebtIncrease, _upperHint, _lowerHint, _maxFeePercentage, _amount);
    }

    function _adjustTrove(address _borrower, uint _collWithdrawal, uint _ZSUSDChange, bool _isDebtIncrease, address _upperHint, address _lowerHint, uint _maxFeePercentage, uint _amount) internal {
        _adjustSenderTrove(_borrower, _collWithdrawal, _ZSUSDChange, _isDebtIncrease, _upperHint, _lowerHint, _maxFeePercentage, msg.sender, _amount, msg.sender);
    }

    /**
    * _adjustTrove(): Alongside a debt change, this function can perform either a collateral top-up or a collateral withdrawal. 
    *
    * It therefore expects either a positive value, or a positive _collWithdrawal argument.
    *
    * If both are positive, it will revert.
    */
    function _adjustSenderTrove(address _borrower, uint _collWithdrawal, uint _ZSUSDChange, bool _isDebtIncrease, address _upperHint, address _lowerHint, uint _maxFeePercentage, address _sender, uint256 _value, address _tokensRecipient) internal {
        ContractsCache memory contractsCache = ContractsCache(troveManager, activePool, zsusdToken);
        LocalVariables_adjustTrove memory vars;

        vars.price = priceFeed.fetchPrice();
        vars.isRecoveryMode = _checkRecoveryMode(vars.price);

        if (_isDebtIncrease) {
            _requireValidMaxFeePercentage(_maxFeePercentage, vars.isRecoveryMode);
            _requireNonZeroDebtChange(_ZSUSDChange);
        }
        _requireSingularCollChange(_value, _collWithdrawal);
        _requireNonZeroAdjustment(_value, _collWithdrawal, _ZSUSDChange);
        _requireTroveisActive(contractsCache.troveManager, _borrower);

        // Confirm the operation is either a borrower adjusting their own trove, or a pure SOV transfer from the Stability Pool to a trove
        assert(_sender == _borrower || (_sender == stabilityPoolAddress && _value > 0 && _ZSUSDChange == 0));

        contractsCache.troveManager.applyPendingRewards(_borrower);

        // Get the collChange based on whether or not SOV was sent in the transaction
        (vars.collChange, vars.isCollIncrease) = _getCollChange(_value, _collWithdrawal);

        vars.netDebtChange = _ZSUSDChange;

        // If the adjustment incorporates a debt increase and system is in Normal Mode, then trigger a borrowing fee
        if (_isDebtIncrease && !vars.isRecoveryMode) { 
            vars.ZSUSDFee = _triggerBorrowingFee(contractsCache.troveManager, contractsCache.zsusdToken, _ZSUSDChange, _maxFeePercentage);
            vars.netDebtChange = vars.netDebtChange.add(vars.ZSUSDFee); // The raw debt change includes the fee
        }

        vars.debt = contractsCache.troveManager.getTroveDebt(_borrower);
        vars.coll = contractsCache.troveManager.getTroveColl(_borrower);
        
        // Get the trove's old ICR before the adjustment, and what its new ICR will be after the adjustment
        vars.oldICR = LiquityMath._computeCR(vars.coll, vars.debt, vars.price);
        vars.newICR = _getNewICRFromTroveChange(vars.coll, vars.debt, vars.collChange, vars.isCollIncrease, vars.netDebtChange, _isDebtIncrease, vars.price);
        assert(_collWithdrawal <= vars.coll); 

        // Check the adjustment satisfies all conditions for the current system mode
        _requireValidAdjustmentInCurrentMode(vars.isRecoveryMode, _collWithdrawal, _isDebtIncrease, vars);
            
        // When the adjustment is a debt repayment, check it's a valid amount and that the caller has enough ZSUSD
        if (!_isDebtIncrease && _ZSUSDChange > 0) {
            _requireAtLeastMinNetDebt(_getNetDebt(vars.debt).sub(vars.netDebtChange));
            _requireValidZSUSDRepayment(vars.debt, vars.netDebtChange);
            _requireSufficientZSUSDBalance(contractsCache.zsusdToken, _borrower, vars.netDebtChange);
        }

        (vars.newColl, vars.newDebt) = _updateTroveFromAdjustment(contractsCache.troveManager, _borrower, vars.collChange, vars.isCollIncrease, vars.netDebtChange, _isDebtIncrease);
        vars.stake = contractsCache.troveManager.updateStakeAndTotalStakes(_borrower);

        // Re-insert trove in to the sorted list
        vars.newNICR = _getNewNominalICRFromTroveChange(vars.coll, vars.debt, vars.collChange, vars.isCollIncrease, vars.netDebtChange, _isDebtIncrease);
        sortedTroves.reInsert(_borrower, vars.newNICR, _upperHint, _lowerHint);

        emit TroveUpdated(_borrower, vars.newDebt, vars.newColl, vars.stake, BorrowerOperation.adjustTrove);
        emit ZSUSDBorrowingFeePaid(_sender,  vars.ZSUSDFee);

        // Use the unmodified _ZSUSDChange here, as we don't send the fee to the user
        _moveTokensAndSOVfromAdjustment(
            contractsCache.activePool,
            contractsCache.zsusdToken,
            _sender,
            vars.collChange,
            vars.isCollIncrease,
            _ZSUSDChange,
            _isDebtIncrease,
            vars.netDebtChange,
            _tokensRecipient
        );
    }

    function closeTrove() external override {
        _closeTrove();
    }

    function _closeTrove() internal {
        ITroveManager troveManagerCached = troveManager;
        IActivePool activePoolCached = activePool;
        IZSUSDToken zsusdTokenCached = zsusdToken;

        _requireTroveisActive(troveManagerCached, msg.sender);
        uint price = priceFeed.fetchPrice();
        _requireNotInRecoveryMode(price);

        troveManagerCached.applyPendingRewards(msg.sender);

        uint coll = troveManagerCached.getTroveColl(msg.sender);
        uint debt = troveManagerCached.getTroveDebt(msg.sender);

        _requireSufficientZSUSDBalance(zsusdTokenCached, msg.sender, debt.sub(ZSUSD_GAS_COMPENSATION));

        uint newTCR = _getNewTCRFromTroveChange(coll, false, debt, false, price);
        _requireNewTCRisAboveCCR(newTCR);

        troveManagerCached.removeStake(msg.sender);
        troveManagerCached.closeTrove(msg.sender);

        emit TroveUpdated(msg.sender, 0, 0, 0, BorrowerOperation.closeTrove);

        // Burn the repaid ZSUSD from the user's balance and the gas compensation from the Gas Pool
        _repayZSUSD(activePoolCached, zsusdTokenCached, msg.sender, debt.sub(ZSUSD_GAS_COMPENSATION));
        _repayZSUSD(activePoolCached, zsusdTokenCached, gasPoolAddress, ZSUSD_GAS_COMPENSATION);

        // Send the collateral back to the user
        activePoolCached.sendSOV(msg.sender, coll);
    }

    /**
     * Claim remaining collateral from a redemption or from a liquidation with ICR > MCR in Recovery Mode
     */
    function claimCollateral() external override {
        // send SOV from CollSurplus Pool to owner
        collSurplusPool.claimColl(msg.sender);
    }

    // --- Helper functions ---

    function _triggerBorrowingFee(ITroveManager _troveManager, IZSUSDToken _zsusdToken, uint _ZSUSDAmount, uint _maxFeePercentage) internal returns (uint) {
        _troveManager.decayBaseRateFromBorrowing(); // decay the baseRate state variable
        uint ZSUSDFee = _troveManager.getBorrowingFee(_ZSUSDAmount);

        _requireUserAcceptsFee(ZSUSDFee, _ZSUSDAmount, _maxFeePercentage);
        _zsusdToken.mint(address(feeDistributor), ZSUSDFee);
        feeDistributor.distributeFees();

        return ZSUSDFee;
    }

    function _getUSDValue(uint _coll, uint _price) internal pure returns (uint) {
        uint usdValue = _price.mul(_coll).div(DECIMAL_PRECISION);

        return usdValue;
    }

    function _getCollChange(
        uint _collReceived,
        uint _requestedCollWithdrawal
    )
        internal
        pure
        returns(uint collChange, bool isCollIncrease)
    {
        if (_collReceived != 0) {
            collChange = _collReceived;
            isCollIncrease = true;
        } else {
            collChange = _requestedCollWithdrawal;
        }
    }

    /// Update trove's coll and debt based on whether they increase or decrease
    function _updateTroveFromAdjustment
    (
        ITroveManager _troveManager,
        address _borrower,
        uint _collChange,
        bool _isCollIncrease,
        uint _debtChange,
        bool _isDebtIncrease
    )
        internal
        returns (uint, uint)
    {
        uint newColl = (_isCollIncrease) ? _troveManager.increaseTroveColl(_borrower, _collChange)
                                        : _troveManager.decreaseTroveColl(_borrower, _collChange);
        uint newDebt = (_isDebtIncrease) ? _troveManager.increaseTroveDebt(_borrower, _debtChange)
                                        : _troveManager.decreaseTroveDebt(_borrower, _debtChange);

        return (newColl, newDebt);
    }

    function _moveTokensAndSOVfromAdjustment
    (
        IActivePool _activePool,
        IZSUSDToken _zsusdToken,
        address _borrower,
        uint _collChange,
        bool _isCollIncrease,
        uint _ZSUSDChange,
        bool _isDebtIncrease,
        uint _netDebtChange,
        address _tokensRecipient
    )
        internal
    {
        if (_isDebtIncrease) {
            _withdrawZSUSD(_activePool, _zsusdToken, _tokensRecipient, _ZSUSDChange, _netDebtChange);
        } else {
            _repayZSUSD(_activePool, _zsusdToken, _borrower, _ZSUSDChange);
        }

        if (_isCollIncrease) {
            _activePoolAddColl(_borrower, _activePool, _collChange);
        } else {
            _activePool.sendSOV(_borrower, _collChange);
        }
    }

    /// Send SOV to Active Pool
    function _activePoolAddColl(address _sender, IActivePool _activePool, uint _amount) internal {
        sovToken.transferFrom(_sender, address(_activePool), _amount);
    }

    /// Issue the specified amount of ZSUSD to _account and increases the total active debt (_netDebtIncrease potentially includes a ZSUSDFee)
    function _withdrawZSUSD(IActivePool _activePool, IZSUSDToken _zsusdToken, address _account, uint _ZSUSDAmount, uint _netDebtIncrease) internal {
        _activePool.increaseZSUSDDebt(_netDebtIncrease);
        _zsusdToken.mint(_account, _ZSUSDAmount);
    }

    /// Burn the specified amount of ZSUSD from _account and decreases the total active debt
    function _repayZSUSD(IActivePool _activePool, IZSUSDToken _zsusdToken, address _account, uint _ZSUSD) internal {
        _activePool.decreaseZSUSDDebt(_ZSUSD);
        _zsusdToken.burn(_account, _ZSUSD);
    }

    // --- 'Require' wrapper functions ---

    function _requireSingularCollChange(uint _amount, uint _collWithdrawal) internal view {
        require(_amount == 0 || _collWithdrawal == 0, "BorrowerOperations: Cannot withdraw and add coll");
    }

    function _requireCallerIsBorrower(address _borrower) internal view {
        require(msg.sender == _borrower, "BorrowerOps: Caller must be the borrower for a withdrawal");
    }

    function _requireNonZeroAdjustment(uint _amount, uint _collWithdrawal, uint _ZSUSDChange) internal view {
        require(_amount!= 0 || _collWithdrawal != 0 || _ZSUSDChange != 0, "BorrowerOps: There must be either a collateral change or a debt change");
    }

    function _requireTroveisActive(ITroveManager _troveManager, address _borrower) internal view {
        uint status = _troveManager.getTroveStatus(_borrower);
        require(status == 1, "BorrowerOps: Trove does not exist or is closed");
    }

    function _requireTroveisNotActive(ITroveManager _troveManager, address _borrower) internal view {
        uint status = _troveManager.getTroveStatus(_borrower);
        require(status != 1, "BorrowerOps: Trove is active");
    }

    function _requireNonZeroDebtChange(uint _ZSUSDChange) internal pure {
        require(_ZSUSDChange > 0, "BorrowerOps: Debt increase requires non-zero debtChange");
    }
   
    function _requireNotInRecoveryMode(uint _price) internal view {
        require(!_checkRecoveryMode(_price), "BorrowerOps: Operation not permitted during Recovery Mode");
    }

    function _requireNoCollWithdrawal(uint _collWithdrawal) internal pure {
        require(_collWithdrawal == 0, "BorrowerOps: Collateral withdrawal not permitted Recovery Mode");
    }

    function _requireValidAdjustmentInCurrentMode 
    (
        bool _isRecoveryMode,
        uint _collWithdrawal,
        bool _isDebtIncrease, 
        LocalVariables_adjustTrove memory _vars
    ) 
        internal 
        view 
    {
        /* 
        *In Recovery Mode, only allow:
        *
        * - Pure collateral top-up
        * - Pure debt repayment
        * - Collateral top-up with debt repayment
        * - A debt increase combined with a collateral top-up which makes the ICR >= 150% and improves the ICR (and by extension improves the TCR).
        *
        * In Normal Mode, ensure:
        *
        * - The new ICR is above MCR
        * - The adjustment won't pull the TCR below CCR
        */
        if (_isRecoveryMode) {
            _requireNoCollWithdrawal(_collWithdrawal);
            if (_isDebtIncrease) {
                _requireICRisAboveCCR(_vars.newICR);
                _requireNewICRisAboveOldICR(_vars.newICR, _vars.oldICR);
            }       
        } else { // if Normal Mode
            _requireICRisAboveMCR(_vars.newICR);
            _vars.newTCR = _getNewTCRFromTroveChange(_vars.collChange, _vars.isCollIncrease, _vars.netDebtChange, _isDebtIncrease, _vars.price);
            _requireNewTCRisAboveCCR(_vars.newTCR);  
        }
    }

    function _requireICRisAboveMCR(uint _newICR) internal view {
        require(_newICR >= liquityBaseParams.MCR(), "BorrowerOps: An operation that would result in ICR < MCR is not permitted");
    }

    function _requireICRisAboveCCR(uint _newICR) internal view {
        require(_newICR >= liquityBaseParams.CCR(), "BorrowerOps: Operation must leave trove with ICR >= CCR");
    }

    function _requireNewICRisAboveOldICR(uint _newICR, uint _oldICR) internal pure {
        require(_newICR >= _oldICR, "BorrowerOps: Cannot decrease your Trove's ICR in Recovery Mode");
    }

    function _requireNewTCRisAboveCCR(uint _newTCR) internal view {
        require(_newTCR >= liquityBaseParams.CCR(), "BorrowerOps: An operation that would result in TCR < CCR is not permitted");
    }

    function _requireAtLeastMinNetDebt(uint _netDebt) internal pure {
        require (_netDebt >= MIN_NET_DEBT, "BorrowerOps: Trove's net debt must be greater than minimum");
    }

    function _requireValidZSUSDRepayment(uint _currentDebt, uint _debtRepayment) internal pure {
        require(_debtRepayment <= _currentDebt.sub(ZSUSD_GAS_COMPENSATION), "BorrowerOps: Amount repaid must not be larger than the Trove's debt");
    }

    function _requireCallerIsStabilityPool() internal view {
        require(msg.sender == stabilityPoolAddress, "BorrowerOps: Caller is not Stability Pool");
    }

     function _requireSufficientZSUSDBalance(IZSUSDToken _zsusdToken, address _borrower, uint _debtRepayment) internal view {
        require(_zsusdToken.balanceOf(_borrower) >= _debtRepayment, "BorrowerOps: Caller doesnt have enough ZSUSD to make repayment");
    }

    function _requireValidMaxFeePercentage(uint _maxFeePercentage, bool _isRecoveryMode) internal view {
        if (_isRecoveryMode) {
            require(_maxFeePercentage <= DECIMAL_PRECISION,
                "Max fee percentage must less than or equal to 100%");
        } else {
            require(_maxFeePercentage >= liquityBaseParams.BORROWING_FEE_FLOOR() && _maxFeePercentage <= DECIMAL_PRECISION,
                "Max fee percentage must be between 0.5% and 100%");
        }
    }

    // --- ICR and TCR getters ---

    /// Compute the new collateral ratio, considering the change in coll and debt. Assumes 0 pending rewards.
    function _getNewNominalICRFromTroveChange
    (
        uint _coll,
        uint _debt,
        uint _collChange,
        bool _isCollIncrease,
        uint _debtChange,
        bool _isDebtIncrease
    )
        pure
        internal
        returns (uint)
    {
        (uint newColl, uint newDebt) = _getNewTroveAmounts(_coll, _debt, _collChange, _isCollIncrease, _debtChange, _isDebtIncrease);

        uint newNICR = LiquityMath._computeNominalCR(newColl, newDebt);
        return newNICR;
    }

    /// Compute the new collateral ratio, considering the change in coll and debt. Assumes 0 pending rewards.
    function _getNewICRFromTroveChange
    (
        uint _coll,
        uint _debt,
        uint _collChange,
        bool _isCollIncrease,
        uint _debtChange,
        bool _isDebtIncrease,
        uint _price
    )
        pure
        internal
        returns (uint)
    {
        (uint newColl, uint newDebt) = _getNewTroveAmounts(_coll, _debt, _collChange, _isCollIncrease, _debtChange, _isDebtIncrease);

        uint newICR = LiquityMath._computeCR(newColl, newDebt, _price);
        return newICR;
    }

    function _getNewTroveAmounts(
        uint _coll,
        uint _debt,
        uint _collChange,
        bool _isCollIncrease,
        uint _debtChange,
        bool _isDebtIncrease
    )
        internal
        pure
        returns (uint, uint)
    {
        uint newColl = _coll;
        uint newDebt = _debt;

        newColl = _isCollIncrease ? _coll.add(_collChange) :  _coll.sub(_collChange);
        newDebt = _isDebtIncrease ? _debt.add(_debtChange) : _debt.sub(_debtChange);

        return (newColl, newDebt);
    }

    function _getNewTCRFromTroveChange
    (
        uint _collChange,
        bool _isCollIncrease,
        uint _debtChange,
        bool _isDebtIncrease,
        uint _price
    )
        internal
        view
        returns (uint)
    {
        uint totalColl = getEntireSystemColl();
        uint totalDebt = getEntireSystemDebt();

        totalColl = _isCollIncrease ? totalColl.add(_collChange) : totalColl.sub(_collChange);
        totalDebt = _isDebtIncrease ? totalDebt.add(_debtChange) : totalDebt.sub(_debtChange);

        uint newTCR = LiquityMath._computeCR(totalColl, totalDebt, _price);
        return newTCR;
    }

    function getCompositeDebt(uint _debt) external view override returns (uint) {
        return _getCompositeDebt(_debt);
    }

    function BORROWING_FEE_FLOOR() override external view returns (uint) {
        return liquityBaseParams.BORROWING_FEE_FLOOR();
    }
}
