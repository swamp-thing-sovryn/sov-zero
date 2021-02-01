<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [@liquity/lib-base](./lib-base.md)

## lib-base package

## Classes

|  Class | Description |
|  --- | --- |
|  [Fees](./lib-base.fees.md) | Calculator for fees. |
|  [LiquityStore](./lib-base.liquitystore.md) | Abstract base class of Liquity data store implementations. |
|  [LQTYStake](./lib-base.lqtystake.md) | Represents a user's LQTY stake and accrued gains. |
|  [StabilityDeposit](./lib-base.stabilitydeposit.md) |  |
|  [Trove](./lib-base.trove.md) |  |
|  [TroveWithPendingRewards](./lib-base.trovewithpendingrewards.md) |  |

## Interfaces

|  Interface | Description |
|  --- | --- |
|  [CollateralGainTransferDetails](./lib-base.collateralgaintransferdetails.md) |  |
|  [LiquidationDetails](./lib-base.liquidationdetails.md) |  |
|  [LiquityStoreBaseState](./lib-base.liquitystorebasestate.md) | State variables read from the blockchain. |
|  [LiquityStoreDerivedState](./lib-base.liquitystorederivedstate.md) | State variables derived from [LiquityStoreBaseState](./lib-base.liquitystorebasestate.md)<!-- -->. |
|  [LiquityStoreListenerParams](./lib-base.liquitystorelistenerparams.md) | Parameters passed to [LiquityStore](./lib-base.liquitystore.md) listeners. |
|  [PopulatedLiquityTransaction](./lib-base.populatedliquitytransaction.md) |  |
|  [ReadableLiquity](./lib-base.readableliquity.md) |  |
|  [RedemptionDetails](./lib-base.redemptiondetails.md) |  |
|  [SentLiquityTransaction](./lib-base.sentliquitytransaction.md) |  |
|  [StabilityDepositChangeDetails](./lib-base.stabilitydepositchangedetails.md) |  |
|  [StabilityPoolGainsWithdrawalDetails](./lib-base.stabilitypoolgainswithdrawaldetails.md) |  |
|  [TransactableLiquity](./lib-base.transactableliquity.md) |  |
|  [TroveAdjustmentDetails](./lib-base.troveadjustmentdetails.md) |  |
|  [TroveClosureDetails](./lib-base.troveclosuredetails.md) |  |
|  [TroveCreationDetails](./lib-base.trovecreationdetails.md) |  |

## Variables

|  Variable | Description |
|  --- | --- |
|  [CRITICAL\_COLLATERAL\_RATIO](./lib-base.critical_collateral_ratio.md) | Total collateral ratio below which recovery mode is triggered. |
|  [LUSD\_LIQUIDATION\_RESERVE](./lib-base.lusd_liquidation_reserve.md) | Amount of LUSD that's reserved for compensating the liquidator of a Trove. |
|  [MINIMUM\_COLLATERAL\_RATIO](./lib-base.minimum_collateral_ratio.md) | Collateral ratio below which a Trove can be liquidated in normal mode. |

## Type Aliases

|  Type Alias | Description |
|  --- | --- |
|  [FailedReceipt](./lib-base.failedreceipt.md) |  |
|  [FrontendStatus](./lib-base.frontendstatus.md) | Represents whether an address has been registered as a Liquity frontend. |
|  [LiquityReceipt](./lib-base.liquityreceipt.md) |  |
|  [LiquityStoreState](./lib-base.liquitystorestate.md) | Type of [LiquityStore](./lib-base.liquitystore.md)<!-- -->'s [state](./lib-base.liquitystore.state.md)<!-- -->. |
|  [LQTYStakeChange](./lib-base.lqtystakechange.md) |  |
|  [MinedReceipt](./lib-base.minedreceipt.md) |  |
|  [PendingReceipt](./lib-base.pendingreceipt.md) |  |
|  [StabilityDepositChange](./lib-base.stabilitydepositchange.md) |  |
|  [SuccessfulReceipt](./lib-base.successfulreceipt.md) |  |
|  [TroveAdjustmentParams](./lib-base.troveadjustmentparams.md) | Parameters of Trove adjustment. |
|  [TroveChange](./lib-base.trovechange.md) | Represents the change from one Trove to another. |
|  [TroveClosureParams](./lib-base.troveclosureparams.md) | Parameters of Trove closure. |
|  [TroveCreationError](./lib-base.trovecreationerror.md) | Describes why a Trove could not be created. |
|  [TroveCreationParams](./lib-base.trovecreationparams.md) | Parameters of Trove creation. |
