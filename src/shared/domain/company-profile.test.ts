import { describe, expect, it } from "vitest";
import { groupBankAccounts, type BankAccount } from "./company-profile";

const account = (
  bank: string,
  kind: BankAccount["kind"],
  currency: BankAccount["currency"],
  number: string,
) => ({
  bank,
  kind,
  currency,
  number,
});

describe("bank accounts on the statement (D26)", () => {
  it("put the bolivianos and dollars of the same bank and kind of account on one line, in order", () => {
    expect(
      groupBankAccounts([
        account("BISA S.A.", "checking", "BOB", "1000000001"),
        account("Ganadero S.A.", "checking", "BOB", "2000000002"),
        account("BISA S.A.", "checking", "USD", "1000000009"),
        account("BISA S.A.", "savings", "BOB", "3000000003"),
      ]),
    ).toEqual([
      {
        bank: "BISA S.A.",
        kind: "checking",
        numbers: [
          { currency: "BOB", number: "1000000001" },
          { currency: "USD", number: "1000000009" },
        ],
      },
      { bank: "Ganadero S.A.", kind: "checking", numbers: [{ currency: "BOB", number: "2000000002" }] },
      { bank: "BISA S.A.", kind: "savings", numbers: [{ currency: "BOB", number: "3000000003" }] },
    ]);
  });

  it("give nothing to print when there are no accounts", () => {
    expect(groupBankAccounts([])).toEqual([]);
  });
});
