// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "../Dependencies/CheckContract.sol";
import "../Dependencies/IERC20.sol";
import "../Interfaces/IBorrowerOperations.sol";


contract BorrowerOperationsScript is CheckContract {
    IBorrowerOperations immutable borrowerOperations;
    IERC20 immutable sovToken;

    constructor(IBorrowerOperations _borrowerOperations, IERC20 _sovToken) public {
        checkContract(address(_borrowerOperations));
        CheckContract(address(_sovToken));
        borrowerOperations = _borrowerOperations;
        sovToken = _sovToken;
    }

    function openTrove(uint _maxFee, uint _ZUSDAmount, address _upperHint, address _lowerHint, uint _amount) external {
        sovToken.transferFrom(msg.sender, address(this), _amount);
        sovToken.approve(address(borrowerOperations), _amount);
        borrowerOperations.openTrove(_maxFee, _ZUSDAmount, _upperHint, _lowerHint, _amount);
    }

    function addColl(address _upperHint, address _lowerHint, uint _amount) external {
        sovToken.transferFrom(msg.sender, address(this), _amount);
        sovToken.approve(address(borrowerOperations), _amount);
        borrowerOperations.addColl(_upperHint, _lowerHint, _amount);
    }

    function withdrawColl(uint _amount, address _upperHint, address _lowerHint) external {
        borrowerOperations.withdrawColl(_amount, _upperHint, _lowerHint);
    }

    function withdrawZUSD(uint _maxFee, uint _amount, address _upperHint, address _lowerHint) external {
        borrowerOperations.withdrawZUSD(_maxFee, _amount, _upperHint, _lowerHint);
    }

    function repayZUSD(uint _amount, address _upperHint, address _lowerHint) external {
        borrowerOperations.repayZUSD(_amount, _upperHint, _lowerHint);
    }

    function closeTrove() external {
        borrowerOperations.closeTrove();
    }

    function adjustTrove(uint _maxFee, uint _collWithdrawal, uint _debtChange, bool isDebtIncrease, address _upperHint, address _lowerHint, uint _amount) external {
        sovToken.transferFrom(msg.sender, address(this), _amount);
        sovToken.approve(address(borrowerOperations), _amount);
        borrowerOperations.adjustTrove(_maxFee, _collWithdrawal, _debtChange, isDebtIncrease, _upperHint, _lowerHint, _amount);
    }

    function claimCollateral() external {
        borrowerOperations.claimCollateral();
    }
}
