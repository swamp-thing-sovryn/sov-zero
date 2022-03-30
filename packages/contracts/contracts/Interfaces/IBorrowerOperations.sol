// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

/// Common interface for the Trove Manager.
interface IBorrowerOperations {

    // --- Events ---

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
    event TroveUpdated(address indexed _borrower, uint _debt, uint _coll, uint stake, uint8 operation);
    event ZSUSDBorrowingFeePaid(address indexed _borrower, uint _ZSUSDFee);

    // --- Functions ---
    
    /**
     * @notice Called only once on init, to set addresses of other Liquity contracts. Callable only by owner
     * @dev initializer function, checks addresses are contracts
     * @param _sovTokenAddress SOV token contract address
     * @param _feeDistributorAddress feeDistributor contract address
     * @param _liquityBaseParamsAddress LiquidityBaseParams contract address
     * @param _troveManagerAddress TroveManager contract address
     * @param _activePoolAddress ActivePool contract address
     * @param _defaultPoolAddress DefaultPool contract address
     * @param _stabilityPoolAddress StabilityPool contract address
     * @param _gasPoolAddress GasPool contract address
     * @param _collSurplusPoolAddress CollSurplusPool contract address
     * @param _priceFeedAddress PrideFeed contract address
     * @param _sortedTrovesAddress SortedTroves contract address
     * @param _zsusdTokenAddress ZSUSDToken contract address
     * @param _zeroStakingAddress ZEROStaking contract address
     */
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
    ) external;

    /**
     * @notice Function that creates a Trove for the caller with the requested debt, and the SOV received as collateral.
     * Successful execution is conditional mainly on the resulting collateralization ratio which must exceed the minimum (110% in Normal Mode, 150% in Recovery Mode).
     * In addition to the requested debt, extra debt is issued to pay the issuance fee, and cover the gas compensation. 
     * The borrower has to provide a `_maxFeePercentage` that he/she is willing to accept in case of a fee slippage, i.e. when a redemption transaction is processed first, driving up the issuance fee. 
     *
     * @dev This function can only be called from the SOV contract otherwise it will fail
     * 
     * @param _maxFee max fee percentage to acept in case of a fee slippage
     * @param _ZSUSDAmount ZSUSD requested debt 
     * @param _upperHint upper trove id hint
     * @param _lowerHint lower trove id hint
     * @param _amount SOV received as collateral
     */
    function openTroveFrom(address _owner, uint _maxFee, uint _ZSUSDAmount, address _upperHint, address _lowerHint, uint _amount) external;


    /**
     * @notice Function that creates a Trove for the caller with the requested debt, and the SOV received as collateral.
     * Successful execution is conditional mainly on the resulting collateralization ratio which must exceed the minimum (110% in Normal Mode, 150% in Recovery Mode).
     * In addition to the requested debt, extra debt is issued to pay the issuance fee, and cover the gas compensation. 
     * The borrower has to provide a `_maxFeePercentage` that he/she is willing to accept in case of a fee slippage, i.e. when a redemption transaction is processed first, driving up the issuance fee. 
     * @param _maxFee max fee percentage to acept in case of a fee slippage
     * @param _ZSUSDAmount ZSUSD requested debt 
     * @param _upperHint upper trove id hint
     * @param _lowerHint lower trove id hint
     * @param _amount SOV received as collateral
     */
    function openTrove(uint _maxFee, uint _ZSUSDAmount, address _upperHint, address _lowerHint, uint _amount) external;

    /// @notice Function that adds the received SOV to the caller's active Trove.
    /// @param _upperHint upper trove id hint
    /// @param _lowerHint lower trove id hint
    /// @param _amount SOV received as collateral
    function addColl(address _upperHint, address _lowerHint, uint _amount) external;

    /// @notice Function that adds the received SOV to active Trove.
    /// @param _troveOwner address of the Trove owner
    /// @param _upperHint upper trove id hint
    /// @param _lowerHint lower trove id hint
    /// @param _amount SOV received as collateral
    ///
    /// @dev Keep in mind this function can only be called from the SOV token
    function addCollFrom(address _troveOwner, address _upperHint, address _lowerHint, uint _amount) external;

    /// @notice send SOV as collateral to a trove. Called by only the Stability Pool.
    /// @param _user user trove address
    /// @param _upperHint upper trove id hint
    /// @param _lowerHint lower trove id hint
    /// @param _amount SOV received as collateral
    function moveSOVGainToTrove(address _user, address _upperHint, address _lowerHint, uint _amount) external;
    
    /**
     * @notice withdraws `_amount` of collateral from the caller’s Trove. 
     * Executes only if the user has an active Trove, the withdrawal would not pull the user’s Trove below the minimum collateralization ratio, 
     * and the resulting total collateralization ratio of the system is above 150%. 
     * @param _amount collateral amount to withdraw 
     * @param _upperHint upper trove id hint
     * @param _lowerHint lower trove id hint
     */
    function withdrawColl(uint _amount, address _upperHint, address _lowerHint) external;

    /**
     * @notice issues `_amount` of ZSUSD from the caller’s Trove to the caller. 
     * Executes only if the Trove's collateralization ratio would remain above the minimum, and the resulting total collateralization ratio is above 150%. 
     * The borrower has to provide a `_maxFeePercentage` that he/she is willing to accept in case of a fee slippage, i.e. when a redemption transaction is processed first, driving up the issuance fee.
     * @param _maxFee max fee percentage to acept in case of a fee slippage
     * @param _amount ZSUSD amount to withdraw 
     * @param _upperHint upper trove id hint
     * @param _lowerHint lower trove id hint
     */
    function withdrawZSUSD(uint _maxFee, uint _amount, address _upperHint, address _lowerHint) external;

    /// @notice repay `_amount` of ZSUSD to the caller’s Trove, subject to leaving 50 debt in the Trove (which corresponds to the 50 ZSUSD gas compensation).
    /// @param _amount ZSUSD amount to repay
    /// @param _upperHint upper trove id hint
    /// @param _lowerHint lower trove id hint
    function repayZSUSD(uint _amount, address _upperHint, address _lowerHint) external;

    /**
     * @notice allows a borrower to repay all debt, withdraw all their collateral, and close their Trove. 
     * Requires the borrower have a ZSUSD balance sufficient to repay their trove's debt, excluding gas compensation - i.e. `(debt - 50)` ZSUSD.
     */
    function closeTrove() external;

    /**
     * @notice enables a borrower to simultaneously change both their collateral and debt, subject to all the restrictions that apply to individual increases/decreases of each quantity with the following particularity: 
     * if the adjustment reduces the collateralization ratio of the Trove, the function only executes if the resulting total collateralization ratio is above 150%. 
     * The borrower has to provide a `_maxFeePercentage` that he/she is willing to accept in case of a fee slippage, i.e. when a redemption transaction is processed first, driving up the issuance fee. 
     * The parameter is ignored if the debt is not increased with the transaction.
     * @param _maxFee max fee percentage to acept in case of a fee slippage
     * @param _collWithdrawal collateral amount to withdraw 
     * @param _debtChange ZSUSD amount to change 
     * @param isDebtIncrease indicates if increases debt
     * @param _upperHint upper trove id hint
     * @param _lowerHint lower trove id hint
     * @param _amount SOV received as collateral
     */
    function adjustTrove(uint _maxFee, uint _collWithdrawal, uint _debtChange, bool isDebtIncrease, address _upperHint, address _lowerHint, uint _amount) external;

    /** 
    * @notice when a borrower’s Trove has been fully redeemed from and closed, or liquidated in Recovery Mode with a collateralization ratio above 110%, 
    * this function allows the borrower to claim their SOV collateral surplus that remains in the system (collateral - debt upon redemption; collateral - 110% of the debt upon liquidation). 
    */
    function claimCollateral() external;

    function getCompositeDebt(uint _debt) external view returns (uint);

    function BORROWING_FEE_FLOOR() external view returns (uint);
}
