import { formatScaled, parseScaled } from "./decimal-text";
import { DomainError } from "./domain-error";
import { Money } from "./money";
import { divideRoundingHalfUp } from "./rounding";

const DECIMALS = 3;
const SCALE = 10n ** BigInt(DECIMALS);

/**
 * Units of a presentation (containers, liters or kilos) with three decimals, held as integer
 * thousandths to match Postgres `numeric(12,3)`.
 */
export class Quantity {
  private constructor(readonly thousandths: bigint) {}

  static parse(value: string): Quantity {
    const thousandths = parseScaled(value, DECIMALS);
    if (thousandths === undefined) {
      throw new DomainError("INVALID_QUANTITY", { value });
    }
    return new Quantity(thousandths);
  }

  static zero(): Quantity {
    return new Quantity(0n);
  }

  static sum(quantities: readonly Quantity[]): Quantity {
    return quantities.reduce((total, quantity) => total.add(quantity), Quantity.zero());
  }

  add(other: Quantity): Quantity {
    return new Quantity(this.thousandths + other.thousandths);
  }

  subtract(other: Quantity): Quantity {
    return new Quantity(this.thousandths - other.thousandths);
  }

  negate(): Quantity {
    return new Quantity(-this.thousandths);
  }

  isZero(): boolean {
    return this.thousandths === 0n;
  }

  isPositive(): boolean {
    return this.thousandths > 0n;
  }

  isNegative(): boolean {
    return this.thousandths < 0n;
  }

  compare(other: Quantity): -1 | 0 | 1 {
    return this.thousandths === other.thousandths ? 0 : this.thousandths < other.thousandths ? -1 : 1;
  }

  /** Quantity × quantity (12 containers × 0.250 L), rounded half up to the thousandth. */
  multiply(other: Quantity): Quantity {
    return new Quantity(divideRoundingHalfUp(this.thousandths * other.thousandths, SCALE));
  }

  /** Divides by a whole number (milliliters to liters: ÷ 1000), rounded half up to the thousandth. */
  divideBy(divisor: number): Quantity {
    if (!Number.isSafeInteger(divisor) || divisor === 0) {
      throw new RangeError(`Quantity can only be divided by a non-zero integer, got ${divisor}`);
    }
    return new Quantity(divideRoundingHalfUp(this.thousandths, BigInt(divisor)));
  }

  /** Line total = quantity × unit price, rounded half up to the cent. */
  times(unitPrice: Money): Money {
    return Money.ofCents(divideRoundingHalfUp(this.thousandths * unitPrice.cents, SCALE), unitPrice.currency);
  }

  /** "12.500" */
  toDecimalString(): string {
    return formatScaled(this.thousandths, DECIMALS);
  }
}
