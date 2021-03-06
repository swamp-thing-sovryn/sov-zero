// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

/*
 * The Stability Pool holds ZSUSD tokens deposited by Stability Pool depositors.
 *
 * When a trove is liquidated, then depending on system conditions, some of its ZSUSD debt gets offset with
 * ZSUSD in the Stability Pool:  that is, the offset debt evaporates, and an equal amount of ZSUSD tokens in the Stability Pool is burned.
 *
 * Thus, a liquidation causes each depositor to receive a ZSUSD loss, in proportion to their deposit as a share of total deposits.
 * They also receive an SOV gain, as the SOV collateral of the liquidated trove is distributed among Stability depositors,
 * in the same proportion.
 *
 * When a liquidation occurs, it depletes every deposit by the same fraction: for example, a liquidation that depletes 40%
 * of the total ZSUSD in the Stability Pool, depletes 40% of each deposit.
 *
 * A deposit that has experienced a series of liquidations is termed a "compounded deposit": each liquidation depletes the deposit,
 * multiplying it by some factor in range ]0,1[
 *
 * Please see the implementation spec in the proof document, which closely follows on from the compounded deposit / SOV gain derivations:
 * https://github.com/liquity/liquity/blob/master/papers/Scalable_Reward_Distribution_with_Compounding_Stakes.pdf
 *
 * --- ZERO ISSUANCE TO STABILITY POOL DEPOSITORS ---
 *
 * An ZERO issuance event occurs at every deposit operation, and every liquidation.
 *
 * Each deposit is tagged with the address of the front end through which it was made.
 *
 * All deposits earn a share of the issued ZERO in proportion to the deposit as a share of total deposits. The ZERO earned
 * by a given deposit, is split between the depositor and the front end through which the deposit was made, based on the front end's kickbackRate.
 *
 * Please see the system Readme for an overview:
 * https://github.com/liquity/dev/blob/main/README.md#zero-issuance-to-stability-providers
 */
interface IStabilityPool {

    // --- Events ---
    
    event StabilityPoolSOVBalanceUpdated(uint _newBalance);
    event StabilityPoolZSUSDBalanceUpdated(uint _newBalance);

    event SOVTokenAddressChanged(address _sovTokenAddress);
    event BorrowerOperationsAddressChanged(address _newBorrowerOperationsAddress);
    event TroveManagerAddressChanged(address _newTroveManagerAddress);
    event ActivePoolAddressChanged(address _newActivePoolAddress);
    event DefaultPoolAddressChanged(address _newDefaultPoolAddress);
    event ZSUSDTokenAddressChanged(address _newZSUSDTokenAddress);
    event SortedTrovesAddressChanged(address _newSortedTrovesAddress);
    event PriceFeedAddressChanged(address _newPriceFeedAddress);
    event CommunityIssuanceAddressChanged(address _newCommunityIssuanceAddress);

    event P_Updated(uint _P);
    event S_Updated(uint _S, uint128 _epoch, uint128 _scale);
    event G_Updated(uint _G, uint128 _epoch, uint128 _scale);
    event EpochUpdated(uint128 _currentEpoch);
    event ScaleUpdated(uint128 _currentScale);

    event FrontEndRegistered(address indexed _frontEnd, uint _kickbackRate);
    event FrontEndTagSet(address indexed _depositor, address indexed _frontEnd);

    event DepositSnapshotUpdated(address indexed _depositor, uint _P, uint _S, uint _G);
    event FrontEndSnapshotUpdated(address indexed _frontEnd, uint _P, uint _G);
    event UserDepositChanged(address indexed _depositor, uint _newDeposit);
    event FrontEndStakeChanged(address indexed _frontEnd, uint _newFrontEndStake, address _depositor);

    event SOVGainWithdrawn(address indexed _depositor, uint _SOV, uint _ZSUSDLoss);
    event ZEROPaidToDepositor(address indexed _depositor, uint _ZERO);
    event ZEROPaidToFrontEnd(address indexed _frontEnd, uint _ZERO);
    event SOVSent(address _to, uint _amount);

    // --- Functions ---

    /**
     * @notice Called only once on init, to set addresses of other Liquity contracts. Callable only by owner
     * @dev initializer function, checks addresses are contracts
     * @param _sovTokenAddress Sov token contract address
     * @param _liquityBaseParamsAddress LiquidityBaseParams contract address
     * @param _borrowerOperationsAddress BorrowerOperations contract address
     * @param _troveManagerAddress TroveManager contract address
     * @param _activePoolAddress ActivePool contract address
     * @param _zsusdTokenAddress ZSUSDToken contract address
     * @param _sortedTrovesAddress SortedTroves contract address
     * @param _priceFeedAddress PriceFeed contract address
     * @param _communityIssuanceAddress CommunityIssuanceAddress
    */
    function setAddresses(
        address _sovTokenAddress,
        address _liquityBaseParamsAddress,
        address _borrowerOperationsAddress,
        address _troveManagerAddress,
        address _activePoolAddress,
        address _zsusdTokenAddress,
        address _sortedTrovesAddress,
        address _priceFeedAddress,
        address _communityIssuanceAddress
    ) external;

    /**
     * @notice Initial checks:
     *  - Frontend is registered or zero address
     *  - Sender is not a registered frontend
     *  - _amount is not zero
     *  ---
     *  - Triggers a ZERO issuance, based on time passed since the last issuance. The ZERO issuance is shared between *all* depositors and front ends
     *  - Tags the deposit with the provided front end tag param, if it's a new deposit
     *  - Sends depositor's accumulated gains (ZERO, SOV) to depositor
     *  - Sends the tagged front end's accumulated ZERO gains to the tagged front end
     *  - Increases deposit and tagged front end's stake, and takes new snapshots for each.
     * @param _amount amount to provide
     * @param _frontEndTag frontend address to receive accumulated ZERO gains
     */
    function provideToSP(uint _amount, address _frontEndTag) external;

    /**
     * @notice Initial checks:
     *    - _amount is zero or there are no under collateralized troves left in the system
     *    - User has a non zero deposit
     *    ---
     *    - Triggers a ZERO issuance, based on time passed since the last issuance. The ZERO issuance is shared between *all* depositors and front ends
     *    - Removes the deposit's front end tag if it is a full withdrawal
     *    - Sends all depositor's accumulated gains (ZERO, SOV) to depositor
     *    - Sends the tagged front end's accumulated ZERO gains to the tagged front end
     *    - Decreases deposit and tagged front end's stake, and takes new snapshots for each.
     * 
     *    If _amount > userDeposit, the user withdraws all of their compounded deposit.
     * @param _amount amount to withdraw
     */
    function withdrawFromSP(uint _amount) external;

    /**
     * @notice Initial checks:
     *    - User has a non zero deposit
     *    - User has an open trove
     *    - User has some SOV gain
     *    ---
     *    - Triggers a ZERO issuance, based on time passed since the last issuance. The ZERO issuance is shared between *all* depositors and front ends
     *    - Sends all depositor's ZERO gain to  depositor
     *    - Sends all tagged front end's ZERO gain to the tagged front end
     *    - Transfers the depositor's entire SOV gain from the Stability Pool to the caller's trove
     *    - Leaves their compounded deposit in the Stability Pool
     *    - Updates snapshots for deposit and tagged front end stake
     * @param _upperHint upper trove id hint
     * @param _lowerHint lower trove id hint
     */
    function withdrawSOVGainToTrove(address _upperHint, address _lowerHint) external;

    /**
     * @notice Initial checks:
     *    - Frontend (sender) not already registered
     *    - User (sender) has no deposit
     *    - _kickbackRate is in the range [0, 100%]
     *    ---
     *    Front end makes a one-time selection of kickback rate upon registering
     * @param _kickbackRate kickback rate selected by frontend
     */
    function registerFrontEnd(uint _kickbackRate) external;

    /**
     * @notice Initial checks:
     *    - Caller is TroveManager
     *    ---
     *    Cancels out the specified debt against the ZSUSD contained in the Stability Pool (as far as possible)
     *    and transfers the Trove's SOV collateral from ActivePool to StabilityPool.
     *    Only called by liquidation functions in the TroveManager.
     * @param _debt debt to cancel
     * @param _coll collateral to transfer
     */
    function offset(uint _debt, uint _coll) external;

    /**
     * @return the total amount of SOV held by the pool
     */
    function getSOV() external view returns (uint);

    /**
     * @return ZSUSD held in the pool. Changes when users deposit/withdraw, and when Trove debt is offset.
     */
    function getTotalZSUSDDeposits() external view returns (uint);

    /**
     * @notice Calculates the SOV gain earned by the deposit since its last snapshots were taken.
     * @param _depositor address to calculate SOV gain
     * @return SOV gain from given depositor
     */
    function getDepositorSOVGain(address _depositor) external view returns (uint);

    /**
     * @param _depositor depositor address
     * @return the user's compounded deposit.
     */
    function getCompoundedZSUSDDeposit(address _depositor) external view returns (uint);

    /**
     * @notice The front end's compounded stake is equal to the sum of its depositors' compounded deposits.
     * @param _frontEnd front end address
     * @return the front end's compounded stake.
     */
    function getCompoundedFrontEndStake(address _frontEnd) external view returns (uint);

    /**
     * Fallback function
     * Only callable by Active Pool, it just accounts for ETH received
     * receive() external payable;
     */
}
