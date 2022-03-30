// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import './Interfaces/IDefaultPool.sol';
import "./Dependencies/SafeMath.sol";
import "./Dependencies/CheckContract.sol";
import "./Dependencies/console.sol";
import "./DefaultPoolStorage.sol";

/**
 * The Default Pool holds the SOV and ZSUSD debt (but not ZSUSD tokens) from liquidations that have been redistributed
 * to active troves but not yet "applied", i.e. not yet recorded on a recipient active trove's struct.
 *
 * When a trove makes an operation that applies its pending SOV and ZSUSD debt, its pending SOV and ZSUSD debt is moved
 * from the Default Pool to the Active Pool.
 */
contract DefaultPool is DefaultPoolStorage, CheckContract, IDefaultPool {
    using SafeMath for uint256;
    
    event SOVTokenAddressChanged(address _sovTokenAddress);
    event TroveManagerAddressChanged(address _newTroveManagerAddress);
    event DefaultPoolZSUSDDebtUpdated(uint _ZSUSDDebt);

    // --- Dependency setters ---

    function setAddresses(
        address _sovTokenAddress,
        address _troveManagerAddress,
        address _activePoolAddress
    )
        external
        onlyOwner
    {
        checkContract(_sovTokenAddress);
        checkContract(_troveManagerAddress);
        checkContract(_activePoolAddress);

        sovToken = IERC20(_sovTokenAddress);
        troveManagerAddress = _troveManagerAddress;
        activePoolAddress = _activePoolAddress;

        emit SOVTokenAddressChanged(_sovTokenAddress);
        emit TroveManagerAddressChanged(_troveManagerAddress);
        emit ActivePoolAddressChanged(_activePoolAddress);

        
    }

    // --- Getters for public variables. Required by IPool interface ---

    /**
    * @return the SOV balance.
    *
    */
    function getSOV() external view override returns (uint) {
        return sovToken.balanceOf(address(this));
    }

    function getZSUSDDebt() external view override returns (uint) {
        return ZSUSDDebt;
    }

    // --- Pool functionality ---

    function sendSOVToActivePool(uint _amount) external override {
        _requireCallerIsTroveManager();
        address activePool = activePoolAddress; // cache to save an SLOAD

        emit SOVSent(activePool, _amount);

        sovToken.transfer(activePool, _amount);
    }

    function increaseZSUSDDebt(uint _amount) external override {
        _requireCallerIsTroveManager();
        ZSUSDDebt = ZSUSDDebt.add(_amount);
        emit DefaultPoolZSUSDDebtUpdated(ZSUSDDebt);
    }

    function decreaseZSUSDDebt(uint _amount) external override {
        _requireCallerIsTroveManager();
        ZSUSDDebt = ZSUSDDebt.sub(_amount);
        emit DefaultPoolZSUSDDebtUpdated(ZSUSDDebt);
    }

    // --- 'require' functions ---

    function _requireCallerIsActivePool() internal view {
        require(msg.sender == activePoolAddress, "DefaultPool: Caller is not the ActivePool");
    }

    function _requireCallerIsTroveManager() internal view {
        require(msg.sender == troveManagerAddress, "DefaultPool: Caller is not the TroveManager");
    }
}
