// SPDX-License-Identifier: MIT
pragma solidity 0.6.11;

import "./Interfaces/IActivePool.sol";
import "./Dependencies/SafeMath.sol";
import "./Dependencies/CheckContract.sol";
import "./Dependencies/console.sol";

import "./ActivePoolStorage.sol";

/**
 * @title Active Pool
 * @notice The Active Pool holds the SOV collateral and ZSUSD debt (but not ZSUSD tokens) for all active troves.
 * 
 * When a trove is liquidated, it's SOV and ZSUSD debt are transferred from the Active Pool, to either the
 * Stability Pool, the Default Pool, or both, depending on the liquidation conditions.
 */
contract ActivePool is CheckContract, IActivePool, ActivePoolStorage {
    using SafeMath for uint256;
    // --- Events ---
    event SOVTokenAddressChanged(address _sovTokenAddress);
    event BorrowerOperationsAddressChanged(address _newBorrowerOperationsAddress);
    event TroveManagerAddressChanged(address _newTroveManagerAddress);
    event ActivePoolZSUSDDebtUpdated(uint _ZSUSDDebt);

    // --- Contract setters ---
    /// @notice initializer function that sets required addresses
    /// @dev Checks addresses are contracts. Only callable by contract owner.
    /// @param _sovTokenAddress SOV token contract address.
    /// @param _borrowerOperationsAddress BorrowerOperations contract address
    /// @param _troveManagerAddress TroveManager contract address
    /// @param _stabilityPoolAddress StabilityPool contract address
    /// @param _defaultPoolAddress DefaultPool contract address
    function setAddresses(
        address _sovTokenAddress,
        address _borrowerOperationsAddress,
        address _troveManagerAddress,
        address _stabilityPoolAddress,
        address _defaultPoolAddress
    ) external onlyOwner {
        checkContract(_sovTokenAddress);
        checkContract(_borrowerOperationsAddress);
        checkContract(_troveManagerAddress);
        checkContract(_stabilityPoolAddress);
        checkContract(_defaultPoolAddress);

        sovToken = IERC20(_sovTokenAddress);
        borrowerOperationsAddress = _borrowerOperationsAddress;
        troveManagerAddress = _troveManagerAddress;
        stabilityPoolAddress = _stabilityPoolAddress;
        defaultPoolAddress = _defaultPoolAddress;

        emit SOVTokenAddressChanged(_sovTokenAddress);
        emit BorrowerOperationsAddressChanged(_borrowerOperationsAddress);
        emit TroveManagerAddressChanged(_troveManagerAddress);
        emit StabilityPoolAddressChanged(_stabilityPoolAddress);
        emit DefaultPoolAddressChanged(_defaultPoolAddress);

        
    }

    // --- Getters for public variables. Required by IPool interface ---

    /// @return the SOV state variable.
    function getSOV() external view override returns (uint) {
        return sovToken.balanceOf(address(this));
    }

    /// @return the ZSUSD debt state variable
    function getZSUSDDebt() external view override returns (uint) {
        return ZSUSDDebt;
    }

    // --- Pool functionality ---

    /// @notice Send SOV amount to given account. Updates ActivePool balance. Only callable by BorrowerOperations, TroveManager or StabilityPool.
    /// @param _account account to receive the SOV amount
    /// @param _amount SOV amount to send
    function sendSOV(address _account, uint _amount) external override {
        _requireCallerIsBOorTroveMorSP();
        emit SOVSent(_account, _amount);

        sovToken.transfer(_account, _amount);
    }

    /// @notice Increases ZSUSD debt of the active pool. Only callable by BorrowerOperations, TroveManager or StabilityPool.
    /// @param _amount ZSUSD amount to add to the pool debt
    function increaseZSUSDDebt(uint _amount) external override {
        _requireCallerIsBOorTroveM();
        ZSUSDDebt = ZSUSDDebt.add(_amount);
        ActivePoolZSUSDDebtUpdated(ZSUSDDebt);
    }

    /// @notice Decreases ZSUSD debt of the active pool. Only callable by BorrowerOperations, TroveManager or StabilityPool.
    /// @param _amount ZSUSD amount to sub to the pool debt
    function decreaseZSUSDDebt(uint _amount) external override {
        _requireCallerIsBOorTroveMorSP();
        ZSUSDDebt = ZSUSDDebt.sub(_amount);
        ActivePoolZSUSDDebtUpdated(ZSUSDDebt);
    }

    // --- 'require' functions ---

    function _requireCallerIsBorrowerOperationsOrDefaultPool() internal view {
        require(
            msg.sender == borrowerOperationsAddress || msg.sender == defaultPoolAddress,
            "ActivePool: Caller is neither BO nor Default Pool"
        );
    }

    function _requireCallerIsBOorTroveMorSP() internal view {
        require(
            msg.sender == borrowerOperationsAddress ||
                msg.sender == troveManagerAddress ||
                msg.sender == stabilityPoolAddress,
            "ActivePool: Caller is neither BorrowerOperations nor TroveManager nor StabilityPool"
        );
    }

    function _requireCallerIsBOorTroveM() internal view {
        require(
            msg.sender == borrowerOperationsAddress || msg.sender == troveManagerAddress,
            "ActivePool: Caller is neither BorrowerOperations nor TroveManager"
        );
    }
}
