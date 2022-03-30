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
    IERC20 immutable zusdToken;
    IERC20 immutable zeroToken;
    IZEROStaking immutable zeroStaking;

    constructor(
        address _borrowerOperationsAddress,
        address _troveManagerAddress,
        address _zeroStakingAddress,
        address _stabilityPoolAddress,
        address _priceFeedAddress,
        address _zusdTokenAddress,
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

        checkContract(_zusdTokenAddress);
        zusdToken = IERC20(_zusdTokenAddress);

        checkContract(_zeroTokenAddress);
        zeroToken = IERC20(_zeroTokenAddress);

        IZEROStaking zeroStakingCached = IZEROStaking(_zeroStakingAddress);
        checkContract(_zeroStakingAddress);
        zeroStaking = zeroStakingCached;
    }

    function claimCollateralAndOpenTrove(uint _maxFee, uint _ZUSDAmount, address _upperHint, address _lowerHint, uint _amount) external {
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
        borrowerOperations.openTrove(_maxFee, _ZUSDAmount, _upperHint, _lowerHint, totalCollateral);
    }

    function claimSPRewardsAndRecycle(uint _maxFee, address _upperHint, address _lowerHint) external {
        uint collBalanceBefore = sovToken.balanceOf(address(this));
        uint zeroBalanceBefore = zeroToken.balanceOf(address(this));

        // Claim rewards
        stabilityPool.withdrawFromSP(0);

        uint collBalanceAfter = sovToken.balanceOf(address(this));
        uint zeroBalanceAfter = zeroToken.balanceOf(address(this));
        uint claimedCollateral = collBalanceAfter.sub(collBalanceBefore);

        // Add claimed SOV to trove, get more ZUSD and stake it into the Stability Pool
        if (claimedCollateral > 0) {
            _requireUserHasTrove(address(this));
            uint ZUSDAmount = _getNetZUSDAmount(claimedCollateral);
            sovToken.approve(address(borrowerOperations), claimedCollateral);
            borrowerOperations.adjustTrove(_maxFee, 0, ZUSDAmount, true, _upperHint, _lowerHint, claimedCollateral);
            // Provide withdrawn ZUSD to Stability Pool
            if (ZUSDAmount > 0) {
                stabilityPool.provideToSP(ZUSDAmount, address(0));
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
        uint zusdBalanceBefore = zusdToken.balanceOf(address(this));
        uint zeroBalanceBefore = zeroToken.balanceOf(address(this));

        // Claim gains
        zeroStaking.unstake(0);

        uint gainedCollateral = sovToken.balanceOf(address(this)).sub(collBalanceBefore); // stack too deep issues :'(
        uint gainedZUSD = zusdToken.balanceOf(address(this)).sub(zusdBalanceBefore);

        uint netZUSDAmount;
        // Top up trove and get more ZUSD, keeping ICR constant
        if (gainedCollateral > 0) {
            _requireUserHasTrove(address(this));
            netZUSDAmount = _getNetZUSDAmount(gainedCollateral);
            sovToken.approve(address(borrowerOperations), gainedCollateral);
            borrowerOperations.adjustTrove(_maxFee, 0, netZUSDAmount, true, _upperHint, _lowerHint, gainedCollateral);
        }

        uint totalZUSD = gainedZUSD.add(netZUSDAmount);
        if (totalZUSD > 0) {
            stabilityPool.provideToSP(totalZUSD, address(0));

            // Providing to Stability Pool also triggers ZERO claim, so stake it if any
            uint zeroBalanceAfter = zeroToken.balanceOf(address(this));
            uint claimedZERO = zeroBalanceAfter.sub(zeroBalanceBefore);
            if (claimedZERO > 0) {
                zeroStaking.stake(claimedZERO);
            }
        }

    }

    function _getNetZUSDAmount(uint _collateral) internal returns (uint) {
        uint price = priceFeed.fetchPrice();
        uint ICR = troveManager.getCurrentICR(address(this), price);

        uint ZUSDAmount = _collateral.mul(price).div(ICR);
        uint borrowingRate = troveManager.getBorrowingRateWithDecay();
        uint netDebt = ZUSDAmount.mul(LiquityMath.DECIMAL_PRECISION).div(LiquityMath.DECIMAL_PRECISION.add(borrowingRate));

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
