import { describe, expect, it } from "vitest";
import { parseProductList } from "./product-list";
import type { CellValue, SheetGrid } from "./sales-sheet";

// Laid out like Agrosoy's PRODUCTOS.xlsx: table from column B, price unit in the column after the
// price, without a header of its own.
const row = (...cells: CellValue[]): CellValue[] => [null, ...cells];

const grid: SheetGrid = {
  name: "PRODUCTOS ",
  rows: [
    [],
    row("CODIGOS DE LOS PRODUCTOS"),
    [],
    row("CODIGOS ", "PRODUCTOS", null, null, "PRECIO $US. "),
    row("001", "Fulvin 40-22(20lts.)", null, null, 7.8, "Litro "),
    row("002", "Fulvin 40-22(5lts.)", null, null, 8.3, "Litro "),
    row("008", "Fertilizante foliar Azufre"),
    row("013", "4-Energy (260ml.)", null, null, null, "frasco"),
    row("020", "Papel Hidrosensible(50 unid.)", null, null, 12, "bolsa "),
    row("025", "Bulhnova (1lt.)", null, null, 33, "kilo"),
    row("024", "A-Micsur Zn (5lts.)", null, null, 20, "Litro "),
    row("045", "A-MICSUR ZN (500ML.)", null, null, 5, "frasco "),
    row("AGROQUIMICOS "),
    row("051", "Oberon(5lts.)"),
    row("051", "Oberon(1lt.)"),
    row(52, "Gusafos 48 EC (20lts.)", null, null, "15,5", "galonera"),
    row("OTROS "),
    row("079", "INTERES "),
  ],
};

describe("Agrosoy's product list", () => {
  const parsed = parseProductList(grid)!;
  const byCode = new Map(parsed.rows.map((item) => [item.code, item]));

  it("reads code, product, container, price and what the price is per", () => {
    expect(byCode.get("001")).toMatchObject({
      row: 5,
      name: "Fulvin 40-22",
      key: "fulvin 40-22",
      content: "20",
      unit: "l",
      saleUnit: "measure",
      price: "7.80",
      line: "fertilizers",
      findings: [],
    });
    expect(byCode.get("020")).toMatchObject({
      content: "50",
      unit: "u",
      saleUnit: "container",
      price: "12.00",
    });
  });

  it("creates a product without a container as one unit priced per container", () => {
    expect(byCode.get("008")).toMatchObject({
      name: "Fertilizante foliar Azufre",
      content: "1",
      unit: "u",
      saleUnit: "container",
      price: null,
      findings: ["NO_CONTAINER", "NO_PRICE"],
    });
  });

  it("flags prices per kilo for liquids and unknown price units", () => {
    expect(byCode.get("025")).toMatchObject({ saleUnit: "measure", findings: ["PRICE_UNIT_MISMATCH"] });
    expect(byCode.get("052")).toMatchObject({
      price: "15.50",
      saleUnit: "container",
      findings: ["UNKNOWN_PRICE_UNIT"],
    });
    expect(byCode.get("051")?.findings).toEqual(["NO_PRICE_UNIT", "NO_PRICE"]);
  });

  it("takes the line from the headings and skips the charge concepts and repeated codes", () => {
    expect(byCode.get("045")?.line).toBe("fertilizers");
    expect(byCode.get("051")?.line).toBe("agrochemicals");
    expect(parsed.skipped).toEqual([
      { row: 15, code: "051", label: "Oberon(1lt.)", reason: "REPEATED_CODE" },
      { row: 18, code: "079", label: "INTERES", reason: "CHARGE_CONCEPT" },
    ]);
  });

  it("names a product the same in every row, preferring the spelling that isn't all capitals", () => {
    expect(byCode.get("045")?.name).toBe("A-Micsur Zn");
    expect(byCode.get("024")?.name).toBe("A-Micsur Zn");
  });

  it("returns nothing for a sheet without the table", () => {
    expect(parseProductList({ name: "Hoja1", rows: [row("FECHA", "CLIENTE")] })).toBeUndefined();
  });
});
