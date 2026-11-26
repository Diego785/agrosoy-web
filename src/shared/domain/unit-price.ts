import { formatScaled, parseScaled } from "./decimal-text";
import { DomainError } from "./domain-error";
import type { Money } from "./money";

const DECIMALS = 4;

/**
 * A note line's price per sale unit, in US dollars with up to four decimals (D60): Agrosoil's sheets
 * keep prices like 7.8833 so that totals come out right. Held as integer ten-thousandths to match
 * Postgres `numeric(14,4)`; a line total still rounds to the cent (`Quantity.times`).
 */
export class UnitPrice {
  private constructor(readonly tenThousandths: bigint) {}

  static parse(value: string): UnitPrice {
    const scaled = parseScaled(value, DECIMALS);
    if (scaled === undefined) {
      throw new DomainError("INVALID_AMOUNT", { value });
    }
    return new UnitPrice(scaled);
  }

  /** A price sheet's price: campaign reference prices keep cents. */
  static fromMoney(amount: Money): UnitPrice {
    return new UnitPrice(amount.cents * 100n);
  }

  static zero(): UnitPrice {
    return new UnitPrice(0n);
  }

  isZero(): boolean {
    return this.tenThousandths === 0n;
  }

  isPositive(): boolean {
    return this.tenThousandths > 0n;
  }

  isNegative(): boolean {
    return this.tenThousandths < 0n;
  }

  equals(other: UnitPrice): boolean {
    return this.tenThousandths === other.tenThousandths;
  }

  /** "7.8833" */
  toDecimalString(): string {
    return formatScaled(this.tenThousandths, DECIMALS);
  }
}
