// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "./IPool.sol";

/**
 * The Active Pool holds the SOV collateral and ZUSD debt (but not ZUSD tokens) for all active troves.
 *
 * When a trove is liquidated, it's SOV and ZUSD debt are transferred from the Active Pool, to either the
 * Stability Pool, the Default Pool, or both, depending on the liquidation conditions.
 *
 */
interface IActivePool is IPool {
    // --- Events ---
    event SOVTokenAddressChanged(address _sovTokenAddress);
    event BorrowerOperationsAddressChanged(address _newBorrowerOperationsAddress);
    event TroveManagerAddressChanged(address _newTroveManagerAddress);
    event ActivePoolZUSDDebtUpdated(uint _ZUSDDebt);

    // --- Functions ---

    /// @notice Send SOV amount to given account. Updates ActivePool balance. Only callable by BorrowerOperations, TroveManager or StabilityPool.
    /// @param _account account to receive the SOV amount
    /// @param _amount SOV amount to send
    function sendSOV(address _account, uint _amount) external;
}
