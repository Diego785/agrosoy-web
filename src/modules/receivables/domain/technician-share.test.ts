import { describe, expect, it } from "vitest";
import { Money } from "@/shared/domain/money";
import type { LedgerKind } from "./ledger";
import { shareByTechnician, type ShareEntry } from "./technician-share";

let nextId = 0;
const entry = (
  kind: LedgerKind,
  amount: string,
  options: Partial<Omit<ShareEntry, "amount" | "kind">> = {},
): ShareEntry => ({
  id: `e${++nextId}`,
  customerId: "ramiro",
  campaignId: "w26",
  date: "2026-06-01",
  isInterest: false,
  noteId: null,
  noteTechnicianId: null,
  paidNoteId: null,
  ...options,
  kind,
  amount: Money.parse(amount),
});

const sale = (noteId: string, technician: string, amount: string, date = "2026-06-01") =>
  entry("delivery", amount, { noteId, noteTechnicianId: technician, date });

/** Each technician's delivered, paid and balance, the way a portfolio adds them. */
function byTechnician(entries: ShareEntry[], current: string | null = "saul") {
  const shared = shareByTechnician(entries, () => current);
  const result: Record<string, { paid: string; balance: string }> = {};
  for (const [technician, own] of Map.groupBy(shared, (item) => item.technicianId ?? "none")) {
    const paid = Money.sum(own.filter((item) => item.kind === "payment").map((item) => item.amount)).negate();
    result[technician] = {
      paid: paid.toDecimalString(),
      balance: Money.sum(own.map((item) => item.amount)).toDecimalString(),
    };
  }
  return result;
}

describe("debt per technician follows the notes (D46)", () => {
  it("keeps each sale with the technician who made it, whoever looks after the customer today", () => {
    expect(byTechnician([sale("n1", "favio", "1000"), sale("n2", "saul", "500")])).toEqual({
      favio: { paid: "0.00", balance: "1000.00" },
      saul: { paid: "0.00", balance: "500.00" },
    });
  });

  it("applies a payment to the oldest note first, across technicians", () => {
    const entries = [
      sale("n1", "favio", "1000", "2026-05-01"),
      sale("n2", "saul", "500", "2026-06-01"),
      entry("payment", "-1200", { date: "2026-07-01" }),
    ];
    expect(byTechnician(entries)).toEqual({
      favio: { paid: "1000.00", balance: "0.00" },
      saul: { paid: "200.00", balance: "300.00" },
    });
  });

  it("applies a payment to the note administration chose", () => {
    const entries = [
      sale("n1", "favio", "1000", "2026-05-01"),
      sale("n2", "saul", "500", "2026-06-01"),
      entry("payment", "-500", { date: "2026-07-01", paidNoteId: "n2" }),
    ];
    expect(byTechnician(entries)).toEqual({
      favio: { paid: "0.00", balance: "1000.00" },
      saul: { paid: "500.00", balance: "0.00" },
    });
  });

  it("covers interest first, under today's technician, and keeps money in favor with them", () => {
    const entries = [
      sale("n1", "favio", "1000", "2026-05-01"),
      entry("charge", "30", { date: "2027-01-31", isInterest: true }),
      entry("payment", "-1100", { date: "2027-02-10" }),
    ];
    expect(byTechnician(entries)).toEqual({
      saul: { paid: "100.00", balance: "-70.00" },
      favio: { paid: "1000.00", balance: "0.00" },
    });
  });

  it("takes a return off its own technician's sales", () => {
    const entries = [
      sale("n1", "favio", "1000", "2026-05-01"),
      sale("n2", "saul", "500", "2026-06-01"),
      entry("return", "-200", { date: "2026-07-01", noteId: "n3", noteTechnicianId: "saul" }),
    ];
    expect(byTechnician(entries)).toEqual({
      favio: { paid: "0.00", balance: "1000.00" },
      saul: { paid: "0.00", balance: "300.00" },
    });
  });

  it("leaves a customer's debt whole with a single technician", () => {
    const entries = [sale("n1", "favio", "1000"), entry("payment", "-400", { date: "2026-08-01" })];
    expect(byTechnician(entries, null)).toEqual({ favio: { paid: "400.00", balance: "600.00" } });
  });
});
