<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [@liquity/lib-base](./lib-base.md) &gt; [ZEROStakeChange](./lib-base.zerostakechange.md)

## ZEROStakeChange type

Represents the change between two states of an ZERO Stake.

<b>Signature:</b>

```typescript
export declare type ZEROStakeChange<T> = {
    stakeZERO: T;
    unstakeZERO?: undefined;
} | {
    stakeZERO?: undefined;
    unstakeZERO: T;
    unstakeAllZERO: boolean;
};
```
