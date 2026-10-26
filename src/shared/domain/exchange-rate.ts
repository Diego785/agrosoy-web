import { formatScaled, parseScaled } from "./decimal-text";
import { DomainError } from "./domain-error";
import { Money } from "./money";
import { divideRoundingHalfUp } from "./rounding";

const DECIMALS = 4;
const SCALE = 10n ** BigInt(DECIMALS);

/**
 * Bolivianos per US dollar, agreed per operation: fixed by the customer's agreement or the day's
 * rate. Four decimals, matching Postgres `numeric(10,4)`.
 */
export class ExchangeRate {
  private constructor(private readonly scaled: bigint) {}

  static parse(value: string): ExchangeRate {
    const scaled = parseScaled(value, DECIMALS, { allowNegative: false });
    if (scaled === undefined || scaled === 0n) {
      throw new DomainError("INVALID_EXCHANGE_RATE", { value });
    }
    return new ExchangeRate(scaled);
  }

  /** Bolivianos to dollars, rounded half up to the cent: Bs 100 at 6.96 is US$ 14.37. */
  toUsd(amount: Money): Money {
    assertCurrency(amount, "BOB");
    return Money.ofCents(divideRoundingHalfUp(amount.cents * SCALE, this.scaled), "USD");
  }

  /** Dollars to bolivianos, rounded half up to the cent. */
  toBob(amount: Money): Money {
    assertCurrency(amount, "USD");
    return Money.ofCents(divideRoundingHalfUp(amount.cents * this.scaled, SCALE), "BOB");
  }

  equals(other: ExchangeRate): boolean {
    return this.scaled === other.scaled;
  }

  /** "6.9600" */
  toDecimalString(): string {
    return formatScaled(this.scaled, DECIMALS);
  }
}

function assertCurrency(amount: Money, expected: Money["currency"]): void {
  if (amount.currency !== expected) {
    throw new Error(`Expected an amount in ${expected}, got ${amount.currency}`);
  }
}
