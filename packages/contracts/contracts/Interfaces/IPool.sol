// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

// Common interface for the Pools.
interface IPool {
    // --- Events ---

    event ZUSDBalanceUpdated(uint _newBalance);
    event SOVTokenAddressChanged(address _sovTokenAddress);
    event ActivePoolAddressChanged(address _newActivePoolAddress);
    event DefaultPoolAddressChanged(address _newDefaultPoolAddress);
    event StabilityPoolAddressChanged(address _newStabilityPoolAddress);
    event SOVSent(address _to, uint _amount);

    // --- Functions ---

    /// @return SOV pool balance
    function getSOV() external view returns (uint);

    /// @return ZUSD debt pool balance
    function getZUSDDebt() external view returns (uint);

    /// @notice Increases ZUSD debt of the pool.
    /// @param _amount ZUSD amount to add to the pool debt
    function increaseZUSDDebt(uint _amount) external;

    /// @notice Decreases ZUSD debt of the pool.
    /// @param _amount ZUSD amount to subtract to the pool debt
    function decreaseZUSDDebt(uint _amount) external;
}
