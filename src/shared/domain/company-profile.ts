import type { Currency } from "./money";

export const BANK_ACCOUNT_KINDS = ["checking", "savings"] as const;
export type BankAccountKind = (typeof BANK_ACCOUNT_KINDS)[number];

/** An account customers can pay into, printed at the foot of the statement (D26). */
export type BankAccount = { bank: string; kind: BankAccountKind; currency: Currency; number: string };

/** What the printed documents say about the company (D26): notes, receipts and statements. */
export type CompanyProfile = {
  /** The brand printed on the forms. */
  brand: string;
  legalName: string;
  taxId: string;
  city: string;
  country: string;
  phone: string;
  mobile: string;
  email: string;
  website: string;
  facebook: string;
  /** In the order administration lists them; all in the legal name and under the NIT above. */
  bankAccounts: BankAccount[];
};

/** The details Agrosoil gave us and those printed on its forms; administration can change them. */
export const DEFAULT_COMPANY_PROFILE: CompanyProfile = {
  brand: "Agrosoil Bolivia",
  legalName: "AGROSOILBOLIVIA S.R.L.",
  taxId: "410408021",
  city: "Santa Cruz",
  country: "Bolivia",
  phone: "3427958",
  mobile: "68767600 - 72142142",
  email: "agrosoilbolivia@gmail.com",
  website: "www.agrosoilbolivia.com",
  facebook: "Agrosoil Bolivia",
  // Administration types its account numbers on the settings page; none ship with the code.
  bankAccounts: [],
};

/**
 * The accounts as the statement prints them: one entry per bank and kind of account, with that
 * account's numbers in bolivianos and dollars side by side, in the order they were listed.
 */
export function groupBankAccounts(
  accounts: readonly BankAccount[],
): { bank: string; kind: BankAccountKind; numbers: { currency: Currency; number: string }[] }[] {
  const groups: ReturnType<typeof groupBankAccounts> = [];
  for (const account of accounts) {
    const group = groups.find((entry) => entry.bank === account.bank && entry.kind === account.kind);
    const number = { currency: account.currency, number: account.number };
    if (group) group.numbers.push(number);
    else groups.push({ bank: account.bank, kind: account.kind, numbers: [number] });
  }
  return groups;
}
