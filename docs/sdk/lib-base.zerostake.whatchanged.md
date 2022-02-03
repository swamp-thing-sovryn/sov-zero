<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [@liquity/lib-base](./lib-base.md) &gt; [ZEROStake](./lib-base.zerostake.md) &gt; [whatChanged](./lib-base.zerostake.whatchanged.md)

## ZEROStake.whatChanged() method

Calculate the difference between this `ZEROStake` and `thatStakedZERO`<!-- -->.

<b>Signature:</b>

```typescript
whatChanged(thatStakedZERO: Decimalish): ZEROStakeChange<Decimal> | undefined;
```

## Parameters

|  Parameter | Type | Description |
|  --- | --- | --- |
|  thatStakedZERO | [Decimalish](./lib-base.decimalish.md) |  |

<b>Returns:</b>

[ZEROStakeChange](./lib-base.zerostakechange.md)<!-- -->&lt;[Decimal](./lib-base.decimal.md)<!-- -->&gt; \| undefined

An object representing the change, or `undefined` if the staked amounts are equal.
