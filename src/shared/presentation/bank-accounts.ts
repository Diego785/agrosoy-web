import { groupBankAccounts, type BankAccount, type BankAccountKind } from "@/shared/domain/company-profile";
import type { Currency } from "@/shared/domain/money";

export const BANK_ACCOUNT_KIND_LABELS: Record<BankAccountKind, string> = {
  checking: "Cuenta corriente",
  savings: "Caja de ahorro",
};

export const BANK_ACCOUNT_CURRENCY_LABELS: Record<Currency, string> = { BOB: "Bs", USD: "US$" };

/** "Banco BISA S.A. · Cuenta corriente · Bs 8700000019 · US$ 8700000011", one per bank and kind. */
export function bankAccountLines(accounts: readonly BankAccount[]): string[] {
  return groupBankAccounts(accounts).map((group) =>
    [
      group.bank,
      BANK_ACCOUNT_KIND_LABELS[group.kind],
      ...group.numbers.map((entry) => `${BANK_ACCOUNT_CURRENCY_LABELS[entry.currency]} ${entry.number}`),
    ].join(" · "),
  );
}

/** The line above the accounts: whose name and NIT a deposit or transfer goes to. */
export function bankAccountsHeading(company: { legalName: string; taxId: string }): string {
  const nit = company.taxId ? ` (NIT ${company.taxId})` : "";
  return `Para pagar, depósito o transferencia a nombre de ${company.legalName}${nit}:`;
}
