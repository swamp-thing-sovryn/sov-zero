// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;


interface ICollSurplusPool {

    // --- Events ---
    
    event SOVTokenAddressChanged(address _sovTokenAddress);
    event BorrowerOperationsAddressChanged(address _newBorrowerOperationsAddress);
    event TroveManagerAddressChanged(address _newTroveManagerAddress);
    event ActivePoolAddressChanged(address _newActivePoolAddress);

    event CollBalanceUpdated(address indexed _account, uint _newBalance);
    event SOVSent(address _to, uint _amount);

    // --- Contract setters ---

    /**
     * @notice Called only once on init, to set addresses of other Liquity contracts. Callable only by owner
     * @dev initializer function, checks addresses are contracts
     * @param _sovTokenAddress SOV token contract address
     * @param _borrowerOperationsAddress BorrowerOperations contract address
     * @param _troveManagerAddress TroveManager contract address
     * @param _activePoolAddress ActivePool contract address
     */
    function setAddresses(
        address _sovTokenAddress,
        address _borrowerOperationsAddress,
        address _troveManagerAddress,
        address _activePoolAddress
    ) external;

    /// @return SOV balance
    function getSOV() external view returns (uint);

    /// @param _account account to retrieve collateral
    /// @return collateral
    function getCollateral(address _account) external view returns (uint);

    /// @notice adds amount to current account balance. Only callable by TroveManager.
    /// @param _account account to add amount
    /// @param _amount amount to add
    function accountSurplus(address _account, uint _amount) external;

    /// @notice claims collateral for given account. Only callable by BorrowerOperations.
    /// @param _account account to send claimable collateral
    function claimColl(address _account) external;
}
