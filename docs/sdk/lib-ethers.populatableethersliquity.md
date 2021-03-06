<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [@liquity/lib-ethers](./lib-ethers.md) &gt; [PopulatableEthersLiquity](./lib-ethers.populatableethersliquity.md)

## PopulatableEthersLiquity class

Ethers-based implementation of [PopulatableLiquity](./lib-base.populatableliquity.md)<!-- -->.

<b>Signature:</b>

```typescript
export declare class PopulatableEthersLiquity implements PopulatableLiquity<EthersTransactionReceipt, EthersTransactionResponse, EthersPopulatedTransaction> 
```
<b>Implements:</b> [PopulatableLiquity](./lib-base.populatableliquity.md)<!-- -->&lt;[EthersTransactionReceipt](./lib-ethers.etherstransactionreceipt.md)<!-- -->, [EthersTransactionResponse](./lib-ethers.etherstransactionresponse.md)<!-- -->, [EthersPopulatedTransaction](./lib-ethers.etherspopulatedtransaction.md)<!-- -->&gt;

## Constructors

|  Constructor | Modifiers | Description |
|  --- | --- | --- |
|  [(constructor)(readable)](./lib-ethers.populatableethersliquity._constructor_.md) |  | Constructs a new instance of the <code>PopulatableEthersLiquity</code> class |

## Methods

|  Method | Modifiers | Description |
|  --- | --- | --- |
|  [adjustTrove(params, maxBorrowingRate, overrides)](./lib-ethers.populatableethersliquity.adjusttrove.md) |  | Adjust existing Trove by changing its collateral, debt, or both. |
|  [borrowZSUSD(amount, maxBorrowingRate, overrides)](./lib-ethers.populatableethersliquity.borrowzsusd.md) |  | Adjust existing Trove by borrowing more ZSUSD. |
|  [claimCollateralSurplus(overrides)](./lib-ethers.populatableethersliquity.claimcollateralsurplus.md) |  | Claim leftover collateral after a liquidation or redemption. |
|  [closeTrove(overrides)](./lib-ethers.populatableethersliquity.closetrove.md) |  | Close existing Trove by repaying all debt and withdrawing all collateral. |
|  [depositCollateral(amount, overrides)](./lib-ethers.populatableethersliquity.depositcollateral.md) |  | Adjust existing Trove by depositing more collateral. |
|  [depositZSUSDInStabilityPool(amount, frontendTag, overrides)](./lib-ethers.populatableethersliquity.depositzsusdinstabilitypool.md) |  | Make a new Stability Deposit, or top up existing one. |
|  [liquidate(address, overrides)](./lib-ethers.populatableethersliquity.liquidate.md) |  | Liquidate one or more undercollateralized Troves. |
|  [liquidateUpTo(maximumNumberOfTrovesToLiquidate, overrides)](./lib-ethers.populatableethersliquity.liquidateupto.md) |  | Liquidate the least collateralized Troves up to a maximum number. |
|  [openTrove(params, maxBorrowingRate, overrides)](./lib-ethers.populatableethersliquity.opentrove.md) |  | Open a new Trove by depositing collateral and borrowing ZSUSD. |
|  [redeemZSUSD(amount, maxRedemptionRate, overrides)](./lib-ethers.populatableethersliquity.redeemzsusd.md) |  | Redeem ZSUSD to native currency (e.g. Ether) at face value. |
|  [registerFrontend(kickbackRate, overrides)](./lib-ethers.populatableethersliquity.registerfrontend.md) |  | Register current wallet address as a Liquity frontend. |
|  [repayZSUSD(amount, overrides)](./lib-ethers.populatableethersliquity.repayzsusd.md) |  | Adjust existing Trove by repaying some of its debt. |
|  [sendZERO(toAddress, amount, overrides)](./lib-ethers.populatableethersliquity.sendzero.md) |  | Send ZERO tokens to an address. |
|  [sendZSUSD(toAddress, amount, overrides)](./lib-ethers.populatableethersliquity.sendzsusd.md) |  | Send ZSUSD tokens to an address. |
|  [stakeZERO(amount, overrides)](./lib-ethers.populatableethersliquity.stakezero.md) |  | Stake ZERO to start earning fee revenue or increase existing stake. |
|  [transferCollateralGainToTrove(overrides)](./lib-ethers.populatableethersliquity.transfercollateralgaintotrove.md) |  | Transfer [collateral gain](./lib-base.stabilitydeposit.collateralgain.md) from Stability Deposit to Trove. |
|  [unstakeZERO(amount, overrides)](./lib-ethers.populatableethersliquity.unstakezero.md) |  | Withdraw ZERO from staking. |
|  [withdrawCollateral(amount, overrides)](./lib-ethers.populatableethersliquity.withdrawcollateral.md) |  | Adjust existing Trove by withdrawing some of its collateral. |
|  [withdrawGainsFromStabilityPool(overrides)](./lib-ethers.populatableethersliquity.withdrawgainsfromstabilitypool.md) |  | Withdraw [collateral gain](./lib-base.stabilitydeposit.collateralgain.md) and [ZERO reward](./lib-base.stabilitydeposit.zeroreward.md) from Stability Deposit. |
|  [withdrawGainsFromStaking(overrides)](./lib-ethers.populatableethersliquity.withdrawgainsfromstaking.md) |  | Withdraw [collateral gain](./lib-base.zerostake.collateralgain.md) and [ZSUSD gain](./lib-base.zerostake.zsusdgain.md) from ZERO stake. |
|  [withdrawZSUSDFromStabilityPool(amount, overrides)](./lib-ethers.populatableethersliquity.withdrawzsusdfromstabilitypool.md) |  | Withdraw ZSUSD from Stability Deposit. |

