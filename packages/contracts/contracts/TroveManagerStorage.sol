// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "./Interfaces/IStabilityPool.sol";
import "./Interfaces/ICollSurplusPool.sol";
import "./Interfaces/IZSUSDToken.sol";
import "./Interfaces/ISortedTroves.sol";
import "./Interfaces/IZEROToken.sol";
import "./Interfaces/IZEROStaking.sol";
import "./Interfaces/IFeeDistributor.sol";
import "./Dependencies/Ownable.sol";
import "./Dependencies/BaseMath.sol";
import "./Dependencies/console.sol";
import "./Dependencies/IERC20.sol";

contract TroveManagerStorage is Ownable, BaseMath {
    string constant public NAME = "TroveManager";

    // --- Connected contract declarations ---

    address public troveManagerRedeemOps;

    address public borrowerOperationsAddress;

    IStabilityPool public _stabilityPool;

    address gasPoolAddress;

    ICollSurplusPool collSurplusPool;

    IZSUSDToken public _zsusdToken;

    IZEROToken public _zeroToken;

    IERC20 public sovToken;

    IZEROStaking public _zeroStaking;

    IFeeDistributor public feeDistributor;

    // A doubly linked list of Troves, sorted by their sorted by their collateral ratios
    ISortedTroves public sortedTroves;

    // --- Data structures ---

    uint public baseRate;

    // The timestamp of the latest fee operation (redemption or new ZSUSD issuance)
    uint public lastFeeOperationTime;

    enum Status {
        nonExistent,
        active,
        closedByOwner,
        closedByLiquidation,
        closedByRedemption
    }

    // Store the necessary data for a trove
    struct Trove {
        uint debt;
        uint coll;
        uint stake;
        Status status;
        uint128 arrayIndex;
    }

    mapping (address => Trove) public Troves;

    uint public totalStakes;

    // Snapshot of the value of totalStakes, taken immediately after the latest liquidation
    uint public totalStakesSnapshot;

    // Snapshot of the total collateral across the ActivePool and DefaultPool, immediately after the latest liquidation.
    uint public totalCollateralSnapshot;

    /*
    * L_SOV and L_ZSUSDDebt track the sums of accumulated liquidation rewards per unit staked. During its lifetime, each stake earns:
    *
    * An SOV gain of ( stake * [L_SOV - L_SOV(0)] )
    * A ZSUSDDebt increase  of ( stake * [L_ZSUSDDebt - L_ZSUSDDebt(0)] )
    *
    * Where L_SOV(0) and L_ZSUSDDebt(0) are snapshots of L_SOV and L_ZSUSDDebt for the active Trove taken at the instant the stake was made
    */
    uint public L_SOV;
    uint public L_ZSUSDDebt;

    // Map addresses with active troves to their RewardSnapshot
    mapping (address => RewardSnapshot) public rewardSnapshots;

    // Object containing the SOV and ZSUSD snapshots for a given active trove
    struct RewardSnapshot { uint SOV; uint ZSUSDDebt;}

    // Array of all active trove addresses - used to to compute an approximate hint off-chain, for the sorted list insertion
    address[] public TroveOwners;

    // Error trackers for the trove redistribution calculation
    uint public lastSOVError_Redistribution;
    uint public lastZSUSDDebtError_Redistribution;
}
