import { describe, expect, it } from "vitest";
import { parseSalesSheet, type CellValue, type SheetGrid } from "./sales-sheet";

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const _ = null;

/** A trimmed copy of a technician's sheet: same layout and quirks as the real one. */
function sheet(): SheetGrid {
  const rows: CellValue[][] = [
    [],
    [_, "CAMPAÑA INVIERNO 2026"],
    [],
    [
      _,
      "FECHA ",
      "PRODUCTO ",
      "CLIENTE ",
      "CANT. ",
      "PREC.",
      "TOTAL $US. ",
      "TIPO DE CAMBIO ",
      "OBSERVACION ",
      "#BOLETA ",
      "CODIGO ",
    ],
    [_, day("2026-04-30"), "Fulvin 40-22(20lts.)", "Alexander Jimenez ", 200, 11, 2200, 6.96, _, 11737],
    [_, day("2026-08-11"), "Fulvin 40-22(20lts.)", "Alexander Jimenez ", 200, 8.5, 1700, _, "MP", 12135],
    [
      _,
      day("2026-07-23"),
      "4-energy(250ml.)",
      "Andres Kaoru Matsudo ",
      12,
      62.5,
      750,
      10.9,
      "contado ",
      12125,
    ],
    [_, day("2026-04-17"), "Rein 517(1lt.)", "Karla Miserendino ", 2, 0, 0, _, "SV", 12070],
    [_, day("2026-07-14"), "Bulhnova(1lt.)", "Roberto Mamani ", 4, 36, 144, _, _, 12114],
    [_, day("2026-08-13"), "Fulvin 40-22(20lts.)", "Roberto Mamani ", 100, 9, 900, _, _, 12114],
    [_, _, _, _, _, _, 0],
    [_, "Total ", _, _, _, _, 5000],
    [],
    [_, "DEVOLUCIONES "],
    [_, "FECHA ", "PRODUCTO ", "CLIENTE ", "CANT.", "PRECIO", "TOTAL", _, "BOLETA "],
    [_, day("2026-09-01"), "Bulhnova(1lt.)", "Roberto Mamani ", 1, 36, 36, _, 12114],
    [],
    [_, _, _, _, _, _, _, _, _, _, _, _, "Cliente", "Entrega", "Pago", "Dev.", "Deuda"],
    [_, _, _, _, _, _, _, _, _, _, _, _, "ALEXANDER JIMENEZ ", 3900, _, _, 3900],
    [_, _, _, _, _, _, _, _, _, _, _, _, "ANDRES KAORU", 750, 750, _, 0],
    [_, _, _, _, _, _, _, _, _, _, _, _, "ROBERTO MAMANI ", 1000, 176.6, _, 823.4],
    [_, _, _, _, _, _, _, _, _, _, _, _, "DEUDA TOTAL "],
  ];
  return { name: "Ing. Favio Añez", rows };
}

describe("parseSalesSheet", () => {
  const parsed = parseSalesSheet(sheet());
  const codes = parsed.issues.map((issue) => issue.code);

  it("reads the campaign and every delivery line, recomputing totals", () => {
    expect(parsed.campaignLabel).toBe("CAMPAÑA INVIERNO 2026");
    const deliveries = parsed.lines.filter((line) => line.kind === "delivery");
    expect(deliveries).toHaveLength(6);
    expect(deliveries[0]).toMatchObject({
      row: 5,
      date: "2026-04-30",
      product: "Fulvin 40-22(20lts.)",
      customerName: "Alexander Jimenez",
      customerKey: "alexander jimenez",
      noteNumber: 11737,
    });
    expect(deliveries[0]?.total.toDecimalString()).toBe("2200.00");
    expect(deliveries[0]?.exchangeRate?.toDecimalString()).toBe("6.9600");
    expect(deliveries[2]?.observation).toBe("contado");
  });

  it("reads the returns table separately", () => {
    const returns = parsed.lines.filter((line) => line.kind === "return");
    expect(returns).toHaveLength(1);
    expect(returns[0]).toMatchObject({ customerKey: "roberto mamani", row: 16 });
  });

  it("matches shortened names in the summary and keeps payments", () => {
    const andres = parsed.summary.find((row) => row.customerKey === "andres kaoru matsudo");
    expect(andres?.paid.toDecimalString()).toBe("750.00");
    expect(andres?.customerName).toBe("Andres Kaoru Matsudo");
    expect(parsed.summary.find((row) => row.customerKey === "roberto mamani")?.paid.toDecimalString()).toBe(
      "176.60",
    );
  });

  it("reports what administration must review", () => {
    expect(parsed.issues).toContainEqual({ row: 6, code: "MISSING_EXCHANGE_RATE", details: {} });
    expect(parsed.issues).toContainEqual({ row: 8, code: "ZERO_PRICE", details: { observation: "SV" } });
    expect(parsed.issues).toContainEqual({
      row: null,
      code: "SHEET_TOTAL_MISMATCH",
      details: { sheet: "5000.00", computed: "5694.00" },
    });
    expect(parsed.issues).toContainEqual({
      row: null,
      code: "CUSTOMER_NOT_IN_SUMMARY",
      details: { customer: "Karla Miserendino" },
    });
    // Note 12114 appears on 14 July and 13 August, as in the real sheet.
    expect(codes).toContain("NOTE_NUMBER_REUSED");
  });

  it("flags a summary total that differs from the lines", () => {
    const mismatch = parsed.issues.find((issue) => issue.code === "SUMMARY_DELIVERED_MISMATCH");
    expect(mismatch?.details).toEqual({ customer: "Roberto Mamani", sheet: "1000.00", computed: "1044.00" });
  });

  it("stops at a Total label written in the product column", () => {
    const grid = sheet();
    const rows = grid.rows.map((cells) => [...cells]);
    rows[11] = [_, _, "Total ", _, _, _, 5000];
    const result = parseSalesSheet({ ...grid, rows });
    expect(result.issues.map((issue) => issue.code)).not.toContain("INVALID_VALUE");
    expect(result.issues.map((issue) => issue.code)).toContain("SHEET_TOTAL_MISMATCH");
  });

  it("reports a sheet without the expected headers instead of guessing", () => {
    const result = parseSalesSheet({ name: "Notas", rows: [["algo"], ["otra cosa"]] });
    expect(result.lines).toEqual([]);
    expect(result.issues).toEqual([{ row: null, code: "HEADER_NOT_FOUND", details: { sheet: "Notas" } }]);
  });
});
