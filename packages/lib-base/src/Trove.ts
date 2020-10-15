import { Decimal, Decimalish, Difference } from "@liquity/decimal";

interface Trovish {
  readonly collateral?: Decimalish;
  readonly debt?: Decimalish;
}

export type TroveChange = {
  collateralDifference?: Difference;
  debtDifference?: Difference;
};

export class Trove {
  public static readonly CRITICAL_COLLATERAL_RATIO: Decimal = Decimal.from(1.5);
  public static readonly MINIMUM_COLLATERAL_RATIO: Decimal = Decimal.from(1.1);
  /**
   * Amount automatically minted and assigned to gas compensation pool for eact Trove opened, it counts towards collateral ratio (lowers it).
   */
  public static readonly CLV_GAS_COMPENSATION: Decimal = Decimal.from(10);

  readonly collateral: Decimal;
  readonly debt: Decimal;

  constructor({ collateral = 0, debt = Trove.CLV_GAS_COMPENSATION }: Trovish = {}) {
    this.collateral = Decimal.from(collateral);
    this.debt = Decimal.from(debt);
  }

  get isEmpty(): boolean {
    return this.collateral.isZero && this.debt.isZero;
  }

  get netDebt(): Decimal {
    return this.debt.nonZero?.sub(Trove.CLV_GAS_COMPENSATION) ?? this.debt;
  }

  collateralRatio(price: Decimalish): Decimal {
    return this.collateral.mulDiv(price, this.debt);
  }

  collateralRatioIsBelowMinimum(price: Decimalish): boolean {
    return this.collateralRatio(price).lt(Trove.MINIMUM_COLLATERAL_RATIO);
  }

  collateralRatioIsBelowCritical(price: Decimalish): boolean {
    return this.collateralRatio(price).lt(Trove.CRITICAL_COLLATERAL_RATIO);
  }

  toString(): string {
    return `{ collateral: ${this.collateral}` + `, debt: ${this.debt}` + " }";
  }

  equals(that: Trove): boolean {
    return this.collateral.eq(that.collateral) && this.debt.eq(that.debt);
  }

  add({ collateral = 0, debt = 0 }: Trovish): Trove {
    return new Trove({
      collateral: this.collateral.add(collateral),
      debt: this.debt.add(debt)
    });
  }

  addCollateral(collateral: Decimalish): Trove {
    return this.add({ collateral });
  }

  addDebt(debt: Decimalish): Trove {
    return this.add({ debt });
  }

  subtract({ collateral = 0, debt = 0 }: Trovish): Trove {
    return new Trove({
      collateral: this.collateral.sub(collateral),
      debt: this.debt.sub(debt)
    });
  }

  subtractCollateral(collateral: Decimalish): Trove {
    return this.subtract({ collateral });
  }

  subtractDebt(debt: Decimalish): Trove {
    return this.subtract({ debt });
  }

  multiply(multiplier: Decimalish): Trove {
    return new Trove({
      collateral: this.collateral.mul(multiplier),
      debt: this.debt.mul(multiplier)
    });
  }

  setCollateral(collateral: Decimalish): Trove {
    return new Trove({
      collateral,
      debt: this.debt
    });
  }

  setDebt(debt: Decimalish): Trove {
    return new Trove({
      collateral: this.collateral,
      debt
    });
  }

  whatChanged({ collateral, debt }: Trove): TroveChange {
    const change: TroveChange = {};

    if (!collateral.eq(this.collateral)) {
      change.collateralDifference = Difference.between(collateral, this.collateral);
    }

    if (!debt.eq(this.debt)) {
      change.debtDifference = Difference.between(debt, this.debt);
    }

    return change;
  }

  applyCollateralDifference(collateralDifference?: Difference): Trove {
    if (collateralDifference?.positive) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      return this.addCollateral(collateralDifference.absoluteValue!);
    } else if (collateralDifference?.negative) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      if (collateralDifference.absoluteValue!.lt(this.collateral)) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        return this.subtractCollateral(collateralDifference.absoluteValue!);
      } else {
        return this.setCollateral(0);
      }
    } else {
      return this;
    }
  }

  applyDebtDifference(debtDifference?: Difference): Trove {
    if (debtDifference?.positive) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      return this.addDebt(debtDifference.absoluteValue!);
    } else if (debtDifference?.negative) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      if (debtDifference.absoluteValue!.lt(this.collateral)) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        return this.subtractDebt(debtDifference.absoluteValue!);
      } else {
        return this.setDebt(0);
      }
    } else {
      return this;
    }
  }

  apply({ collateralDifference, debtDifference }: TroveChange): Trove {
    return this.applyCollateralDifference(collateralDifference).applyDebtDifference(debtDifference);
  }
}

interface TrovishWithPendingRewards extends Trovish {
  readonly stake?: Decimalish;
  readonly snapshotOfTotalRedistributed?: Trovish;
}

export class TroveWithPendingRewards extends Trove {
  readonly stake: Decimal;
  readonly snapshotOfTotalRedistributed: Trove;

  constructor({
    collateral = 0,
    debt = Trove.CLV_GAS_COMPENSATION,
    stake = 0,
    snapshotOfTotalRedistributed
  }: TrovishWithPendingRewards = {}) {
    super({ collateral, debt });

    this.stake = Decimal.from(stake);
    this.snapshotOfTotalRedistributed = new Trove({
      ...snapshotOfTotalRedistributed
    });
  }

  applyRewards(totalRedistributed: Trove): Trove {
    return this.add(
      totalRedistributed.subtract(this.snapshotOfTotalRedistributed).multiply(this.stake)
    );
  }

  equals(that: TroveWithPendingRewards): boolean {
    return (
      super.equals(that) &&
      this.stake.eq(that.stake) &&
      this.snapshotOfTotalRedistributed.equals(that.snapshotOfTotalRedistributed)
    );
  }
}
