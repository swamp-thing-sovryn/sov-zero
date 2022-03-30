// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "../TroveManager.sol";
import "../BorrowerOperations.sol";
import "../StabilityPool.sol";
import "../ZSUSDToken.sol";
import "../Dependencies/IERC20.sol";

contract EchidnaProxy {
    TroveManager troveManager;
    BorrowerOperations borrowerOperations;
    StabilityPool stabilityPool;
    ZSUSDToken zsusdToken;
    IERC20 sovToken;

    constructor(
        TroveManager _troveManager,
        BorrowerOperations _borrowerOperations,
        StabilityPool _stabilityPool,
        ZSUSDToken _zsusdToken,
        IERC20 _sovToken
    ) public {
        troveManager = _troveManager;
        borrowerOperations = _borrowerOperations;
        stabilityPool = _stabilityPool;
        zsusdToken = _zsusdToken;
        sovToken = _sovToken;
    }

    receive() external payable {
        // do nothing
    }

    // TroveManager

    function liquidatePrx(address _user) external {
        troveManager.liquidate(_user);
    }

    function liquidateTrovesPrx(uint _n) external {
        troveManager.liquidateTroves(_n);
    }

    function batchLiquidateTrovesPrx(address[] calldata _troveArray) external {
        troveManager.batchLiquidateTroves(_troveArray);
    }

    function redeemCollateralPrx(
        uint _ZSUSDAmount,
        address _firstRedemptionHint,
        address _upperPartialRedemptionHint,
        address _lowerPartialRedemptionHint,
        uint _partialRedemptionHintNICR,
        uint _maxIterations,
        uint _maxFee
    ) external {
        troveManager.redeemCollateral(_ZSUSDAmount, _firstRedemptionHint, _upperPartialRedemptionHint, _lowerPartialRedemptionHint, _partialRedemptionHintNICR, _maxIterations, _maxFee);
    }

    // Borrower Operations
    function openTrovePrx(uint _SOV, uint _ZSUSDAmount, address _upperHint, address _lowerHint, uint _maxFee) external {
        sovToken.transferFrom(msg.sender, address(this), _SOV);
        sovToken.approve(address(borrowerOperations), _SOV);
        borrowerOperations.openTrove(_maxFee, _ZSUSDAmount, _upperHint, _lowerHint, _SOV);
    }

    function addCollPrx(uint _SOV, address _upperHint, address _lowerHint) external {
        sovToken.transferFrom(msg.sender, address(this), _SOV);
        sovToken.approve(address(borrowerOperations), _SOV);
        borrowerOperations.addColl(_upperHint, _lowerHint, _SOV);
    }

    function withdrawCollPrx(uint _amount, address _upperHint, address _lowerHint) external {
        borrowerOperations.withdrawColl(_amount, _upperHint, _lowerHint);
    }

    function withdrawZSUSDPrx(uint _amount, address _upperHint, address _lowerHint, uint _maxFee) external {
        borrowerOperations.withdrawZSUSD(_maxFee, _amount, _upperHint, _lowerHint);
    }

    function repayZSUSDPrx(uint _amount, address _upperHint, address _lowerHint) external {
        borrowerOperations.repayZSUSD(_amount, _upperHint, _lowerHint);
    }

    function closeTrovePrx() external {
        borrowerOperations.closeTrove();
    }

    function adjustTrovePrx(uint _SOV, uint _collWithdrawal, uint _debtChange, bool _isDebtIncrease, address _upperHint, address _lowerHint, uint _maxFee) external {
        sovToken.transferFrom(msg.sender, address(this), _SOV);
        sovToken.approve(address(borrowerOperations), _SOV);
        borrowerOperations.adjustTrove(_maxFee, _collWithdrawal, _debtChange, _isDebtIncrease, _upperHint, _lowerHint, _SOV);
    }

    // Pool Manager
    function provideToSPPrx(uint _amount, address _frontEndTag) external {
        stabilityPool.provideToSP(_amount, _frontEndTag);
    }

    function withdrawFromSPPrx(uint _amount) external {
        stabilityPool.withdrawFromSP(_amount);
    }

    // ZSUSD Token

    function transferPrx(address recipient, uint256 amount) external returns (bool) {
        return zsusdToken.transfer(recipient, amount);
    }

    function approvePrx(address spender, uint256 amount) external returns (bool) {
        return zsusdToken.approve(spender, amount);
    }

    function transferFromPrx(address sender, address recipient, uint256 amount) external returns (bool) {
        return zsusdToken.transferFrom(sender, recipient, amount);
    }

    function increaseAllowancePrx(address spender, uint256 addedValue) external returns (bool) {
        return zsusdToken.increaseAllowance(spender, addedValue);
    }

    function decreaseAllowancePrx(address spender, uint256 subtractedValue) external returns (bool) {
        return zsusdToken.decreaseAllowance(spender, subtractedValue);
    }
}
