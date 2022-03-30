// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

// Common interface for the Pools.
interface IPool {
    // --- Events ---

    event ZSUSDBalanceUpdated(uint _newBalance);
    event SOVTokenAddressChanged(address _sovTokenAddress);
    event ActivePoolAddressChanged(address _newActivePoolAddress);
    event DefaultPoolAddressChanged(address _newDefaultPoolAddress);
    event StabilityPoolAddressChanged(address _newStabilityPoolAddress);
    event SOVSent(address _to, uint _amount);

    // --- Functions ---

    /// @return SOV pool balance
    function getSOV() external view returns (uint);

    /// @return ZSUSD debt pool balance
    function getZSUSDDebt() external view returns (uint);

    /// @notice Increases ZSUSD debt of the pool.
    /// @param _amount ZSUSD amount to add to the pool debt
    function increaseZSUSDDebt(uint _amount) external;

    /// @notice Decreases ZSUSD debt of the pool.
    /// @param _amount ZSUSD amount to subtract to the pool debt
    function decreaseZSUSDDebt(uint _amount) external;
}
