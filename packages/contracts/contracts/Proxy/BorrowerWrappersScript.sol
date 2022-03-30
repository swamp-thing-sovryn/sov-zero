// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "../Dependencies/SafeMath.sol";
import "../Dependencies/LiquityMath.sol";
import "../Dependencies/IERC20.sol";
import "../Interfaces/IBorrowerOperations.sol";
import "../Interfaces/ITroveManager.sol";
import "../Interfaces/IStabilityPool.sol";
import "../Interfaces/IPriceFeed.sol";
import "../Interfaces/IZEROStaking.sol";
import "./BorrowerOperationsScript.sol";
import "./ETHTransferScript.sol";
import "./ZEROStakingScript.sol";
import "../Dependencies/console.sol";


contract BorrowerWrappersScript is BorrowerOperationsScript, ETHTransferScript, ZEROStakingScript {
    using SafeMath for uint;

    string constant public NAME = "BorrowerWrappersScript";

    ITroveManager immutable troveManager;
    IStabilityPool immutable stabilityPool;
    IPriceFeed immutable priceFeed;
    IERC20 immutable zsusdToken;
    IERC20 immutable zeroToken;
    IZEROStaking immutable zeroStaking;

    constructor(
        address _borrowerOperationsAddress,
        address _troveManagerAddress,
        address _zeroStakingAddress,
        address _stabilityPoolAddress,
        address _priceFeedAddress,
        address _zsusdTokenAddress,
        address _zeroTokenAddress,
        address _sovTokenAddress
    )
        BorrowerOperationsScript(IBorrowerOperations(_borrowerOperationsAddress), IERC20(_sovTokenAddress))
        ZEROStakingScript(_zeroStakingAddress)
        public
    {
        checkContract(_troveManagerAddress);
        ITroveManager troveManagerCached = ITroveManager(_troveManagerAddress);
        troveManager = troveManagerCached;

        IStabilityPool stabilityPoolCached = IStabilityPool(_stabilityPoolAddress);
        checkContract(_stabilityPoolAddress);
        stabilityPool = stabilityPoolCached;

        IPriceFeed priceFeedCached = IPriceFeed(_priceFeedAddress); 
        checkContract(_priceFeedAddress);
        priceFeed = priceFeedCached;

        checkContract(_zsusdTokenAddress);
        zsusdToken = IERC20(_zsusdTokenAddress);

        checkContract(_zeroTokenAddress);
        zeroToken = IERC20(_zeroTokenAddress);

        IZEROStaking zeroStakingCached = IZEROStaking(_zeroStakingAddress);
        checkContract(_zeroStakingAddress);
        zeroStaking = zeroStakingCached;
    }

    function claimCollateralAndOpenTrove(uint _maxFee, uint _ZSUSDAmount, address _upperHint, address _lowerHint, uint _amount) external {
        sovToken.transferFrom(msg.sender, address(this), _amount);
        uint balanceBefore = sovToken.balanceOf(address(this));

        // Claim collateral
        borrowerOperations.claimCollateral();

        uint balanceAfter = sovToken.balanceOf(address(this));

        // already checked in CollSurplusPool
        assert(balanceAfter > balanceBefore);

        uint totalCollateral = balanceAfter.sub(balanceBefore).add(_amount);

        // Open trove with obtained collateral, plus collateral sent by user
        sovToken.approve(address(borrowerOperations), totalCollateral);
        borrowerOperations.openTrove(_maxFee, _ZSUSDAmount, _upperHint, _lowerHint, totalCollateral);
    }

    function claimSPRewardsAndRecycle(uint _maxFee, address _upperHint, address _lowerHint) external {
        uint collBalanceBefore = sovToken.balanceOf(address(this));
        uint zeroBalanceBefore = zeroToken.balanceOf(address(this));

        // Claim rewards
        stabilityPool.withdrawFromSP(0);

        uint collBalanceAfter = sovToken.balanceOf(address(this));
        uint zeroBalanceAfter = zeroToken.balanceOf(address(this));
        uint claimedCollateral = collBalanceAfter.sub(collBalanceBefore);

        // Add claimed SOV to trove, get more ZSUSD and stake it into the Stability Pool
        if (claimedCollateral > 0) {
            _requireUserHasTrove(address(this));
            uint ZSUSDAmount = _getNetZSUSDAmount(claimedCollateral);
            sovToken.approve(address(borrowerOperations), claimedCollateral);
            borrowerOperations.adjustTrove(_maxFee, 0, ZSUSDAmount, true, _upperHint, _lowerHint, claimedCollateral);
            // Provide withdrawn ZSUSD to Stability Pool
            if (ZSUSDAmount > 0) {
                stabilityPool.provideToSP(ZSUSDAmount, address(0));
            }
        }

        // Stake claimed ZERO
        uint claimedZERO = zeroBalanceAfter.sub(zeroBalanceBefore);
        if (claimedZERO > 0) {
            zeroStaking.stake(claimedZERO);
        }
    }

    function claimStakingGainsAndRecycle(uint _maxFee, address _upperHint, address _lowerHint) external {
        uint collBalanceBefore = sovToken.balanceOf(address(this));
        uint zsusdBalanceBefore = zsusdToken.balanceOf(address(this));
        uint zeroBalanceBefore = zeroToken.balanceOf(address(this));

        // Claim gains
        zeroStaking.unstake(0);

        uint gainedCollateral = sovToken.balanceOf(address(this)).sub(collBalanceBefore); // stack too deep issues :'(
        uint gainedZSUSD = zsusdToken.balanceOf(address(this)).sub(zsusdBalanceBefore);

        uint netZSUSDAmount;
        // Top up trove and get more ZSUSD, keeping ICR constant
        if (gainedCollateral > 0) {
            _requireUserHasTrove(address(this));
            netZSUSDAmount = _getNetZSUSDAmount(gainedCollateral);
            sovToken.approve(address(borrowerOperations), gainedCollateral);
            borrowerOperations.adjustTrove(_maxFee, 0, netZSUSDAmount, true, _upperHint, _lowerHint, gainedCollateral);
        }

        uint totalZSUSD = gainedZSUSD.add(netZSUSDAmount);
        if (totalZSUSD > 0) {
            stabilityPool.provideToSP(totalZSUSD, address(0));

            // Providing to Stability Pool also triggers ZERO claim, so stake it if any
            uint zeroBalanceAfter = zeroToken.balanceOf(address(this));
            uint claimedZERO = zeroBalanceAfter.sub(zeroBalanceBefore);
            if (claimedZERO > 0) {
                zeroStaking.stake(claimedZERO);
            }
        }

    }

    function _getNetZSUSDAmount(uint _collateral) internal returns (uint) {
        uint price = priceFeed.fetchPrice();
        uint ICR = troveManager.getCurrentICR(address(this), price);

        uint ZSUSDAmount = _collateral.mul(price).div(ICR);
        uint borrowingRate = troveManager.getBorrowingRateWithDecay();
        uint netDebt = ZSUSDAmount.mul(LiquityMath.DECIMAL_PRECISION).div(LiquityMath.DECIMAL_PRECISION.add(borrowingRate));

        return netDebt;
    }

    function transferSOV(address _recipient, uint256 _amount) external returns (bool) {
        (bool success ) = sovToken.transfer(_recipient, _amount);
        return success;
    }

    function _requireUserHasTrove(address _depositor) internal view {
        require(troveManager.getTroveStatus(_depositor) == 1, "BorrowerWrappersScript: caller must have an active trove");
    }
}
