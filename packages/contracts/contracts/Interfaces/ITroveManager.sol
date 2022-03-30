// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "./ILiquityBase.sol";
import "./IStabilityPool.sol";
import "./IZSUSDToken.sol";
import "./IZEROToken.sol";
import "./IZEROStaking.sol";


/// Common interface for the Trove Manager.
interface ITroveManager is ILiquityBase {
    
    // --- Events ---
    
    event SOVTokenAddressChanged(address _sovTokenAddress);
    event FeeDistributorAddressChanged(address _feeDistributorAddress);
    event TroveManagerRedeemOpsAddressChanged(address _troveManagerRedeemOps);
    event LiquityBaseParamsAddressChanges(address _borrowerOperationsAddress);
    event BorrowerOperationsAddressChanged(address _newBorrowerOperationsAddress);
    event PriceFeedAddressChanged(address _newPriceFeedAddress);
    event ZSUSDTokenAddressChanged(address _newZSUSDTokenAddress);
    event ActivePoolAddressChanged(address _activePoolAddress);
    event DefaultPoolAddressChanged(address _defaultPoolAddress);
    event StabilityPoolAddressChanged(address _stabilityPoolAddress);
    event GasPoolAddressChanged(address _gasPoolAddress);
    event CollSurplusPoolAddressChanged(address _collSurplusPoolAddress);
    event SortedTrovesAddressChanged(address _sortedTrovesAddress);
    event ZEROTokenAddressChanged(address _zeroTokenAddress);
    event ZEROStakingAddressChanged(address _zeroStakingAddress);

    event Liquidation(uint _liquidatedDebt, uint _liquidatedColl, uint _collGasCompensation, uint _ZSUSDGasCompensation);
    event Redemption(uint _attemptedZSUSDAmount, uint _actualZSUSDAmount, uint _SOVSent, uint _SOVFee);
    event TroveUpdated(address indexed _borrower, uint _debt, uint _coll, uint stake, uint8 operation);
    event TroveLiquidated(address indexed _borrower, uint _debt, uint _coll, uint8 operation);
    event BaseRateUpdated(uint _baseRate);
    event LastFeeOpTimeUpdated(uint _lastFeeOpTime);
    event TotalStakesUpdated(uint _newTotalStakes);
    event SystemSnapshotsUpdated(uint _totalStakesSnapshot, uint _totalCollateralSnapshot);
    event LTermsUpdated(uint _L_SOV, uint _L_ZSUSDDebt);
    event TroveSnapshotsUpdated(uint _L_SOV, uint _L_ZSUSDDebt);
    event TroveIndexUpdated(address _borrower, uint _newIndex);

    // --- Functions ---

    /**
     * @notice Called only once on init, to set addresses of other Liquity contracts. Callable only by owner
     * @dev initializer function, checks addresses are contracts
     *  To avoid stack too deep compile error use an addresses array to pass the addresses.
     *  _sovTokenAddress SOV token contract address
     *  _feeDistributorAddress feeDistributor contract address
     *  _troveManagerRedeemOps TroveManagerRedeemOps contract address
     *  _liquityBaseParamsAddress LiquityBaseParams contract address
     *  _borrowerOperationsAddress BorrowerOperations contract address
     *  _activePoolAddress ActivePool contract address
     *  _defaultPoolAddress DefaultPool contract address
     *  _stabilityPoolAddress StabilityPool contract address
     *  _gasPoolAddress GasPool contract address
     *  _collSurplusPoolAddress CollSurplusPool contract address
     *  _priceFeedAddress PriceFeed contract address
     *  _zsusdTokenAddress ZSUSDToken contract address
     *  _sortedTrovesAddress SortedTroves contract address
     *  _zeroTokenAddress ZEROToken contract address
     *  _zeroStakingAddress ZEROStaking contract address
     * @param _setupAddresses array of contract addresses to setup
     */
    function setAddresses(
        address [15] calldata _setupAddresses
    ) external;

    /// @return Trove owners count
    function getTroveOwnersCount() external view returns (uint);

    /// @param _index Trove owner index
    /// @return Trove from TroveOwners array in given index
    function getTroveFromTroveOwnersArray(uint _index) external view returns (address);

    /// @param _borrower borrower address
    /// @return the nominal collateral ratio (ICR) of a given Trove, without the price. Takes a trove's pending coll and debt rewards from redistributions into account.
    function getNominalICR(address _borrower) external view returns (uint);

    /// @notice computes the user’s individual collateralization ratio (ICR) based on their total collateral and total ZSUSD debt. Returns 2^256 -1 if they have 0 debt.
    /// @param _borrower borrower address
    /// @param _price SOV price
    /// @return the current collateral ratio (ICR) of a given Trove. Takes a trove's pending coll and debt rewards from redistributions into account.
    function getCurrentICR(address _borrower, uint _price) external view returns (uint);

    /// @notice Closes the trove if its ICR is lower than the minimum collateral ratio.
    /// @param _borrower borrower address
    function liquidate(address _borrower) external;

    /**
     * @notice Liquidate a sequence of troves. Closes a maximum number of n under-collateralized Troves,
     * starting from the one with the lowest collateral ratio in the system, and moving upwards
     * @param _n max number of under-collateralized Troves to liquidate
     */
    function liquidateTroves(uint _n) external;

    /**
     * @notice Attempt to liquidate a custom list of troves provided by the caller.
     * @param _troveArray list of trove addresses
     */
    function batchLiquidateTroves(address[] calldata _troveArray) external;

    /** 
     * @notice Send _ZSUSDamount ZSUSD to the system and redeem the corresponding amount of collateral from as many Troves as are needed to fill the redemption
     * request.  Applies pending rewards to a Trove before reducing its debt and coll.
     *
     * Note that if _amount is very large, this function can run out of gas, specially if traversed troves are small. This can be easily avoided by
     * splitting the total _amount in appropriate chunks and calling the function multiple times.
     *
     * Param `_maxIterations` can also be provided, so the loop through Troves is capped (if it’s zero, it will be ignored).This makes it easier to
     * avoid OOG for the frontend, as only knowing approximately the average cost of an iteration is enough, without needing to know the “topology”
     * of the trove list. It also avoids the need to set the cap in stone in the contract, nor doing gas calculations, as both gas price and opcode
     * costs can vary.
     *
     * All Troves that are redeemed from -- with the likely exception of the last one -- will end up with no debt left, therefore they will be closed.
     * If the last Trove does have some remaining debt, it has a finite ICR, and the reinsertion could be anywhere in the list, therefore it requires a hint.
     * A frontend should use getRedemptionHints() to calculate what the ICR of this Trove will be after redemption, and pass a hint for its position
     * in the sortedTroves list along with the ICR value that the hint was found for.
     *
     * If another transaction modifies the list between calling getRedemptionHints() and passing the hints to redeemCollateral(), it
     * is very likely that the last (partially) redeemed Trove would end up with a different ICR than what the hint is for. In this case the
     * redemption will stop after the last completely redeemed Trove and the sender will keep the remaining ZSUSD amount, which they can attempt
     * to redeem later.
     * 
     * @param _ZSUSDAmount ZSUSD amount to send to the system
     * @param _firstRedemptionHint calculated ICR hint of first trove after redemption
     * @param _maxIterations max Troves iterations (can be 0)
     * @param _maxFee max fee percentage to accept
     */
    function redeemCollateral(
        uint _ZSUSDAmount,
        address _firstRedemptionHint,
        address _upperPartialRedemptionHint,
        address _lowerPartialRedemptionHint,
        uint _partialRedemptionHintNICR,
        uint _maxIterations,
        uint _maxFee
    ) external; 

    /// @notice Update borrower's stake based on their latest collateral value
    /// @param _borrower borrower address
    function updateStakeAndTotalStakes(address _borrower) external returns (uint);

    /// @notice Update borrower's snapshots of L_SOV and L_ZSUSDDebt to reflect the current values
    /// @param _borrower borrower address
    function updateTroveRewardSnapshots(address _borrower) external;

    /// @notice Push the owner's address to the Trove owners list, and record the corresponding array index on the Trove struct
    /// @param _borrower borrower address
    /// @return index where Trove was inserted
    function addTroveOwnerToArray(address _borrower) external returns (uint index);

    /// @notice Add the borrowers's coll and debt rewards earned from redistributions, to their Trove
    /// @param _borrower borrower address
    function applyPendingRewards(address _borrower) external;

    /// @param _borrower borrower address
    /// @return the borrower's pending accumulated SOV reward, earned by their stake
    function getPendingSOVReward(address _borrower) external view returns (uint);

    /// @param _borrower borrower address
    /// @return the borrower's pending accumulated ZSUSD reward, earned by their stake
    function getPendingZSUSDDebtReward(address _borrower) external view returns (uint);

    /*
    * @notice A Trove has pending rewards if its snapshot is less than the current rewards per-unit-staked sum:
    * this indicates that rewards have occured since the snapshot was made, and the user therefore has
    * pending rewards
    * 
    * @param _borrower borrower address
    * @return true if has pending rewards
    */ 
    function hasPendingRewards(address _borrower) external view returns (bool);

    /// @notice returns the Troves entire debt and coll, including pending rewards from redistributions.
    /// @param _borrower borrower address
    function getEntireDebtAndColl(address _borrower) external view returns (
        uint debt, 
        uint coll, 
        uint pendingZSUSDDebtReward, 
        uint pendingSOVReward
    );

    /// @notice Close given trove. Called by BorrowerOperations.
    /// @param _borrower borrower address
    function closeTrove(address _borrower) external;

    /// @notice Remove borrower's stake from the totalStakes sum, and set their stake to 0
    /// @param _borrower borrower address
    function removeStake(address _borrower) external;

    /// @return calculated redemption rate using baseRate
    function getRedemptionRate() external view returns (uint);

    /// @return calculated redemption rate using calculated decayed as base rate
    function getRedemptionRateWithDecay() external view returns (uint);

    /// @notice The redemption fee is taken as a cut of the total SOV drawn from the system in a redemption. It is based on the current redemption rate.
    /// @param _SOVDrawn SOV drawn
    function getRedemptionFeeWithDecay(uint _SOVDrawn) external view returns (uint);

    /// @return borrowing rate
    function getBorrowingRate() external view returns (uint);

    /// @return borrowing rate calculated using decayed as base rate
    function getBorrowingRateWithDecay() external view returns (uint);

    /// @param ZSUSDDebt ZSUSD debt amount to calculate fee
    /// @return borrowing fee using borrowing rate
    function getBorrowingFee(uint ZSUSDDebt) external view returns (uint);

    /// @param _ZSUSDDebt ZSUSD debt amount to calculate fee
    /// @return borrowing fee using borrowing rate with decay
    function getBorrowingFeeWithDecay(uint _ZSUSDDebt) external view returns (uint);

    /// @notice Updates the baseRate state variable based on time elapsed since the last redemption or ZSUSD borrowing operation.
    function decayBaseRateFromBorrowing() external;

    /// @param _borrower borrower address
    /// @return Trove status from given trove
    function getTroveStatus(address _borrower) external view returns (uint);
    
    /// @param _borrower borrower address
    /// @return Trove stake from given trove
    function getTroveStake(address _borrower) external view returns (uint);
    
    /// @param _borrower borrower address
    /// @return Trove debt from given trove
    function getTroveDebt(address _borrower) external view returns (uint);

    /// @param _borrower borrower address
    /// @return Trove collateral from given trove
    function getTroveColl(address _borrower) external view returns (uint);

    /// @param _borrower borrower address
    /// @param num status to set
    function setTroveStatus(address _borrower, uint num) external;

    /// @param _borrower borrower address
    /// @param _collIncrease amount of collateral to increase
    /// @return new trove collateral
    function increaseTroveColl(address _borrower, uint _collIncrease) external returns (uint);

    /// @param _borrower borrower address
    /// @param _collDecrease amount of collateral to decrease
    /// @return new trove collateral
    function decreaseTroveColl(address _borrower, uint _collDecrease) external returns (uint); 

    /// @param _borrower borrower address
    /// @param _debtIncrease amount of debt to increase
    /// @return new trove debt
    function increaseTroveDebt(address _borrower, uint _debtIncrease) external returns (uint); 

    /// @param _borrower borrower address
    /// @param _debtDecrease amount of debt to decrease
    /// @return new trove debt
    function decreaseTroveDebt(address _borrower, uint _debtDecrease) external returns (uint); 

    /**
     * @param _price SOV price
     * @return the total collateralization ratio (TCR) of the system. 
     * The TCR is based on the the entire system debt and collateral (including pending rewards).
     */
    function getTCR(uint _price) external view returns (uint);

    function MCR() external view returns (uint);

    function CCR() external view returns (uint);

    /// @notice reveals whether or not the system is in Recovery Mode (i.e. whether the Total Collateralization Ratio (TCR) is below the Critical Collateralization Ratio (CCR)).
    function checkRecoveryMode(uint _price) external view returns (bool);
}
