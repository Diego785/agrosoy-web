import { describe, expect, it } from "vitest";
import { plainLine, type StatementLineView } from "../application/statement-view";
import { describeLine } from "./statement-text";

/** A payment line: `amount` is this campaign's part in US$, `receipt` the whole payment. */
function payment(
  amount: string,
  receipt: Partial<NonNullable<StatementLineView["receipt"]>> & { usdAmount: string },
  extra: Partial<StatementLineView> = {},
): StatementLineView {
  return plainLine({
    kind: "payment",
    date: "2026-11-01",
    noteNumber: null,
    description: "",
    amount,
    exchangeRate: "12.0000",
    receipt: { number: 1, method: "transfer", currency: "USD", amount: receipt.usdAmount, ...receipt },
    document: { type: "payment", id: "p1" },
    ...extra,
  });
}

describe("describeLine for payments (D39)", () => {
  it("shows the bolivianos received when the payment was in Bs", () => {
    const line = payment("833.33", { currency: "BOB", amount: "10000.00", usdAmount: "833.33" });
    expect(describeLine(line).text).toBe("Pago · Transferencia · Bs 10.000,00");
  });

  it("shows the equivalent in Bs when the payment was in dollars", () => {
    const line = payment("400.00", { method: "cash", usdAmount: "400.00" });
    expect(describeLine(line).text).toBe("Pago · Efectivo · equivale a Bs 4.800,00");
  });

  it("shows each campaign's part of a payment split over two campaigns", () => {
    const winter = payment(
      "2200.00",
      { currency: "BOB", amount: "20880.00", usdAmount: "3000.00" },
      {
        exchangeRate: "6.9600",
      },
    );
    const summer = payment(
      "800.00",
      { currency: "BOB", amount: "20880.00", usdAmount: "3000.00" },
      {
        exchangeRate: "6.9600",
      },
    );
    expect(describeLine(winter).text).toBe("Pago · Transferencia · Bs 15.312,00 de Bs 20.880,00");
    expect(describeLine(summer).text).toBe("Pago · Transferencia · Bs 5.568,00 de Bs 20.880,00");

    const inDollars = payment("250.00", { usdAmount: "400.00" });
    expect(describeLine(inDollars).text).toBe("Pago · Transferencia · equivale a Bs 3.000,00");
  });

  it("adds the rate where there is no T/C column, and keeps the reference as a note", () => {
    const line = payment("400.00", { usdAmount: "400.00" }, { observation: "Transf. 4471" });
    expect(describeLine(line, { withRate: true })).toEqual({
      text: "Pago · Transferencia · equivale a Bs 4.800,00 · T/C 12,00",
      note: "Ref.: Transf. 4471",
    });
  });

  it("leaves the sheet's payments as they were", () => {
    const fromSheet = plainLine({
      kind: "payment",
      date: "2026-09-30",
      noteNumber: null,
      description: "",
      amount: "1500.00",
      fromSheet: true,
    });
    expect(describeLine(fromSheet, { withRate: true }).text).toBe("Pagos según la planilla");
  });
});
