// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "./IPool.sol";

interface IDefaultPool is IPool {
    // --- Events ---
    event SOVTokenAddressChanged(address _sovTokenAddress);
    event TroveManagerAddressChanged(address _newTroveManagerAddress);
    event DefaultPoolZUSDDebtUpdated(uint256 _ZUSDDebt);

    // --- Functions ---

    /// @notice Send SOV to Active Pool
    /// @param _amount SOV to send
    function sendSOVToActivePool(uint256 _amount) external;
}
