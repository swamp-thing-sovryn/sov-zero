// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

/// Common interface for Fee Distributor.
interface IFeeDistributor {

     // --- Events ---

    event SOVTokenAddressChanged(address _sovTokenAddress);
    event SOVFeeCollectorAddressChanged(address _sovFeeCollectorAddress);
    event ZeroStakingAddressChanged(address _zeroStakingAddress);
    event BorrowerOperationsAddressChanged(address _borrowerOperationsAddress);
    event TroveManagerAddressChanged(address _troveManagerAddress);
    event WrbtcAddressChanged(address _wrbtcAddress);
    event ZSUSDTokenAddressChanged(address _zsusdTokenAddress);
    event ActivePoolAddressSet(address _activePoolAddress);


    event ZSUSDDistributed(uint256 _zsusdDistributedAmount);
    event SOVDistributed(uint256 _rbtcDistributedAmount);

    // --- Functions ---
    
    /**
     * @notice Called only once on init, to set addresses of other Liquity contracts. Callable only by owner
     * @dev initializer function, checks addresses are contracts
     * @param _sovTokenAddress SOV token contract address
     * @param _sovFeeCollectorAddress SOVFeeCollector address
     * @param _zeroStakingAddress ZEROStaking contract address
     * @param _borrowerOperationsAddress borrowerOperations contract address
     * @param _troveManagerAddress TroveManager contract address
     * @param _wrbtcAddress wrbtc ERC20 contract address
     * @param _zsusdTokenAddress ZSUSDToken contract address
     * @param _activePoolAddress ActivePool contract address
     */
    function setAddresses(
        address _sovTokenAddress,
        address _sovFeeCollectorAddress,
        address _zeroStakingAddress,
        address _borrowerOperationsAddress,
        address _troveManagerAddress,
        address _wrbtcAddress,
        address _zsusdTokenAddress,
        address _activePoolAddress
    ) external;

    function distributeFees() external;

}