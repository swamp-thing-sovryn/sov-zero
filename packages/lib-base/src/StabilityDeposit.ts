import { Decimal, Decimalish } from "./Decimal";

/**
 * Represents the change between two Stability Deposit states.
 *
 * @public
 */
export type StabilityDepositChange<T> =
  | { depositZSUSD: T; withdrawZSUSD?: undefined }
  | { depositZSUSD?: undefined; withdrawZSUSD: T; withdrawAllZSUSD: boolean };

/**
 * A Stability Deposit and its accrued gains.
 *
 * @public
 */
export class StabilityDeposit {
  /** Amount of ZSUSD in the Stability Deposit at the time of the last direct modification. */
  readonly initialZSUSD: Decimal;

  /** Amount of ZSUSD left in the Stability Deposit. */
  readonly currentZSUSD: Decimal;

  /** Amount of native currency (e.g. Ether) received in exchange for the used-up ZSUSD. */
  readonly collateralGain: Decimal;

  /** Amount of ZERO rewarded since the last modification of the Stability Deposit. */
  readonly zeroReward: Decimal;

  /**
   * Address of frontend through which this Stability Deposit was made.
   *
   * @remarks
   * If the Stability Deposit was made through a frontend that doesn't tag deposits, this will be
   * the zero-address.
   */
  readonly frontendTag: string;

  /** @internal */
  constructor(
    initialZSUSD: Decimal,
    currentZSUSD: Decimal,
    collateralGain: Decimal,
    zeroReward: Decimal,
    frontendTag: string
  ) {
    this.initialZSUSD = initialZSUSD;
    this.currentZSUSD = currentZSUSD;
    this.collateralGain = collateralGain;
    this.zeroReward = zeroReward;
    this.frontendTag = frontendTag;

    if (this.currentZSUSD.gt(this.initialZSUSD)) {
      throw new Error("currentZSUSD can't be greater than initialZSUSD");
    }
  }

  get isEmpty(): boolean {
    return (
      this.initialZSUSD.isZero &&
      this.currentZSUSD.isZero &&
      this.collateralGain.isZero &&
      this.zeroReward.isZero
    );
  }

  /** @internal */
  toString(): string {
    return (
      `{ initialZSUSD: ${this.initialZSUSD}` +
      `, currentZSUSD: ${this.currentZSUSD}` +
      `, collateralGain: ${this.collateralGain}` +
      `, zeroReward: ${this.zeroReward}` +
      `, frontendTag: "${this.frontendTag}" }`
    );
  }

  /**
   * Compare to another instance of `StabilityDeposit`.
   */
  equals(that: StabilityDeposit): boolean {
    return (
      this.initialZSUSD.eq(that.initialZSUSD) &&
      this.currentZSUSD.eq(that.currentZSUSD) &&
      this.collateralGain.eq(that.collateralGain) &&
      this.zeroReward.eq(that.zeroReward) &&
      this.frontendTag === that.frontendTag
    );
  }

  /**
   * Calculate the difference between the `currentZSUSD` in this Stability Deposit and `thatZSUSD`.
   *
   * @returns An object representing the change, or `undefined` if the deposited amounts are equal.
   */
  whatChanged(thatZSUSD: Decimalish): StabilityDepositChange<Decimal> | undefined {
    thatZSUSD = Decimal.from(thatZSUSD);

    if (thatZSUSD.lt(this.currentZSUSD)) {
      return { withdrawZSUSD: this.currentZSUSD.sub(thatZSUSD), withdrawAllZSUSD: thatZSUSD.isZero };
    }

    if (thatZSUSD.gt(this.currentZSUSD)) {
      return { depositZSUSD: thatZSUSD.sub(this.currentZSUSD) };
    }
  }

  /**
   * Apply a {@link StabilityDepositChange} to this Stability Deposit.
   *
   * @returns The new deposited ZSUSD amount.
   */
  apply(change: StabilityDepositChange<Decimalish> | undefined): Decimal {
    if (!change) {
      return this.currentZSUSD;
    }

    if (change.withdrawZSUSD !== undefined) {
      return change.withdrawAllZSUSD || this.currentZSUSD.lte(change.withdrawZSUSD)
        ? Decimal.ZERO
        : this.currentZSUSD.sub(change.withdrawZSUSD);
    } else {
      return this.currentZSUSD.add(change.depositZSUSD);
    }
  }
}
