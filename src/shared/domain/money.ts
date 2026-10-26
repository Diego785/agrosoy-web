import { formatScaled, parseScaled } from "./decimal-text";
import { DomainError } from "./domain-error";

export type Currency = "USD" | "BOB";

/**
 * An amount in one currency, held as integer cents so sums and comparisons are exact.
 * Built from decimal strings (forms, Postgres `numeric(14,2)`), never from floats (D5).
 */
export class Money {
  private constructor(
    readonly cents: bigint,
    readonly currency: Currency,
  ) {}

  static ofCents(cents: bigint | number, currency: Currency = "USD"): Money {
    if (typeof cents === "number" && !Number.isSafeInteger(cents)) {
      throw new RangeError(`Money needs a whole number of cents, got ${cents}`);
    }
    return new Money(BigInt(cents), currency);
  }

  static zero(currency: Currency = "USD"): Money {
    return new Money(0n, currency);
  }

  /** Accepts "1234", "1234.5" or "-1234.56". Thousands separators and commas are rejected. */
  static parse(value: string, currency: Currency = "USD"): Money {
    const cents = parseScaled(value, 2);
    if (cents === undefined) {
      throw new DomainError("INVALID_AMOUNT", { value });
    }
    return new Money(cents, currency);
  }

  static sum(amounts: readonly Money[], currency: Currency = "USD"): Money {
    return amounts.reduce((total, amount) => total.add(amount), Money.zero(currency));
  }

  add(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.cents + other.cents, this.currency);
  }

  subtract(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.cents - other.cents, this.currency);
  }

  negate(): Money {
    return new Money(-this.cents, this.currency);
  }

  isZero(): boolean {
    return this.cents === 0n;
  }

  isPositive(): boolean {
    return this.cents > 0n;
  }

  isNegative(): boolean {
    return this.cents < 0n;
  }

  /** -1, 0 or 1, for sorting and for "is this payment more than the debt" checks. */
  compare(other: Money): -1 | 0 | 1 {
    this.assertSameCurrency(other);
    return this.cents === other.cents ? 0 : this.cents < other.cents ? -1 : 1;
  }

  equals(other: Money): boolean {
    return this.currency === other.currency && this.cents === other.cents;
  }

  /** "-1234.50": the format of Postgres `numeric(14,2)` and of the DTOs sent to the browser. */
  toDecimalString(): string {
    return formatScaled(this.cents, 2);
  }

  private assertSameCurrency(other: Money): void {
    // A programming error, not a user error: conversions must go through ExchangeRate.
    if (other.currency !== this.currency) {
      throw new Error(`Cannot combine ${this.currency} with ${other.currency}`);
    }
  }
}
