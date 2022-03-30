import { Decimal, Decimalish } from "./Decimal";

/**
 * Represents the change between two states of an ZERO Stake.
 *
 * @public
 */
export type ZEROStakeChange<T> =
  | { stakeZERO: T; unstakeZERO?: undefined }
  | { stakeZERO?: undefined; unstakeZERO: T; unstakeAllZERO: boolean };

/** 
 * Represents a user's ZERO stake and accrued gains.
 * 
 * @remarks
 * Returned by the {@link ReadableLiquity.getZEROStake | getZEROStake()} function.

 * @public
 */
export class ZEROStake {
  /** The amount of ZERO that's staked. */
  readonly stakedZERO: Decimal;

  /** Collateral gain available to withdraw. */
  readonly collateralGain: Decimal;

  /** ZSUSD gain available to withdraw. */
  readonly zsusdGain: Decimal;

  /** @internal */
  constructor(stakedZERO = Decimal.ZERO, collateralGain = Decimal.ZERO, zsusdGain = Decimal.ZERO) {
    this.stakedZERO = stakedZERO;
    this.collateralGain = collateralGain;
    this.zsusdGain = zsusdGain;
  }

  get isEmpty(): boolean {
    return this.stakedZERO.isZero && this.collateralGain.isZero && this.zsusdGain.isZero;
  }

  /** @internal */
  toString(): string {
    return (
      `{ stakedZERO: ${this.stakedZERO}` +
      `, collateralGain: ${this.collateralGain}` +
      `, zsusdGain: ${this.zsusdGain} }`
    );
  }

  /**
   * Compare to another instance of `ZEROStake`.
   */
  equals(that: ZEROStake): boolean {
    return (
      this.stakedZERO.eq(that.stakedZERO) &&
      this.collateralGain.eq(that.collateralGain) &&
      this.zsusdGain.eq(that.zsusdGain)
    );
  }

  /**
   * Calculate the difference between this `ZEROStake` and `thatStakedZERO`.
   *
   * @returns An object representing the change, or `undefined` if the staked amounts are equal.
   */
  whatChanged(thatStakedZERO: Decimalish): ZEROStakeChange<Decimal> | undefined {
    thatStakedZERO = Decimal.from(thatStakedZERO);

    if (thatStakedZERO.lt(this.stakedZERO)) {
      return {
        unstakeZERO: this.stakedZERO.sub(thatStakedZERO),
        unstakeAllZERO: thatStakedZERO.isZero
      };
    }

    if (thatStakedZERO.gt(this.stakedZERO)) {
      return { stakeZERO: thatStakedZERO.sub(this.stakedZERO) };
    }
  }

  /**
   * Apply a {@link ZEROStakeChange} to this `ZEROStake`.
   *
   * @returns The new staked ZERO amount.
   */
  apply(change: ZEROStakeChange<Decimalish> | undefined): Decimal {
    if (!change) {
      return this.stakedZERO;
    }

    if (change.unstakeZERO !== undefined) {
      return change.unstakeAllZERO || this.stakedZERO.lte(change.unstakeZERO)
        ? Decimal.ZERO
        : this.stakedZERO.sub(change.unstakeZERO);
    } else {
      return this.stakedZERO.add(change.stakeZERO);
    }
  }
}
