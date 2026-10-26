import { describe, expect, it } from "vitest";
import { ExchangeRate } from "@/shared/domain/exchange-rate";
import { customerRecord, formatCustomerCode } from "./customer";

describe("customerRecord", () => {
  it("cleans what was typed and derives the comparison name", () => {
    const record = customerRecord({
      name: "  Eduardo   Cuaquira ",
      taxId: " 1234 567-lp ",
      phone: "  ",
      zoneId: "",
      exchangeRateAgreement: { kind: "daily" },
    });

    expect(record).toEqual({
      name: "Eduardo Cuaquira",
      comparisonName: "eduardo cuaquira",
      taxId: "1234567LP",
      phone: undefined,
      zoneId: undefined,
      technicianId: undefined,
      exchangeRateAgreement: { kind: "daily" },
      notes: undefined,
    });
  });

  it("keeps a fixed exchange rate", () => {
    const rate = ExchangeRate.parse("6.96");
    const record = customerRecord({ name: "Agro Sur", exchangeRateAgreement: { kind: "fixed", rate } });
    expect(record.exchangeRateAgreement).toEqual({ kind: "fixed", rate });
  });

  it("rejects names that are too short after cleaning", () => {
    expect(() => customerRecord({ name: "  A  ", exchangeRateAgreement: { kind: "daily" } })).toThrow();
  });
});

describe("formatCustomerCode", () => {
  it("pads to four digits and grows beyond them", () => {
    expect(formatCustomerCode(42)).toBe("0042");
    expect(formatCustomerCode(12345)).toBe("12345");
  });
});
