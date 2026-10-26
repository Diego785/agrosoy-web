import ExcelJS from "exceljs";

/** A workbook laid out like the technicians' sheets: merged title, formulas, side summary. */
export async function salesWorkbook({ extraRow = false } = {}): Promise<Uint8Array> {
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet("Ing. Favio Añez");
  sheet.getCell("B2").value = "CAMPAÑA INVIERNO 2026";
  sheet.mergeCells("B2:K2");
  // In exceljs `row.values[1]` is column A; the leading holes put the table in column B, as in the real sheet.
  sheet.getRow(4).values = [
    ,
    ,
    "FECHA ",
    "PRODUCTO ",
    "CLIENTE ",
    "CANT. ",
    "PREC.",
    "TOTAL $US. ",
    "TIPO DE CAMBIO ",
    "OBSERVACION ",
    "#BOLETA ",
  ];
  const rows: [
    Date,
    string,
    string,
    number | ExcelJS.CellFormulaValue,
    number | ExcelJS.CellFormulaValue,
    number | null,
    string | null,
    number,
  ][] = [
    [
      new Date(Date.UTC(2026, 3, 30)),
      "Fulvin 40-22(20lts.)",
      "Alexander Jimenez ",
      200,
      11,
      6.96,
      null,
      11737,
    ],
    [
      new Date(Date.UTC(2026, 6, 23)),
      "4-energy(250ml.)",
      "Andres Kaoru Matsudo ",
      12,
      { formula: "250/4", result: 62.5 },
      10.9,
      "contado ",
      12125,
    ],
    [
      new Date(Date.UTC(2026, 4, 29)),
      "Biogain Amino Como(1lt.)",
      "Rodolfo Romero ",
      { formula: "12+8", result: 20 },
      39,
      6.96,
      null,
      11599,
    ],
  ];
  if (extraRow)
    rows.push([
      new Date(Date.UTC(2026, 8, 29)),
      "Proan(5kg.)",
      "Eduardo Cuaquira ",
      60,
      20,
      null,
      null,
      12491,
    ]);
  rows.forEach((values, index) => {
    const rowNumber = 5 + index;
    sheet.getRow(rowNumber).values = [
      ,
      ,
      ...values.slice(0, 5),
      { formula: `E${rowNumber}*F${rowNumber}` },
      ...values.slice(5),
    ];
  });
  sheet.getCell("B12").value = "Total ";
  sheet.getCell("G12").value = { formula: "SUM(G5:G7)", result: 3730 };

  sheet.getRow(20).values = [, , , , , , , , , , , , "Cliente", "Entrega", "Pago", "Dev.", "Deuda"];
  sheet.getRow(21).values = [, , , , , , , , , , , , "ALEXANDER JIMENEZ ", 2200, null, null, 2200];
  sheet.getRow(22).values = [, , , , , , , , , , , , "ANDRES KAORU", 750, 750, null, 0];
  sheet.getRow(23).values = [, , , , , , , , , , , , "RODOLFO ROMERO ", 780, 100.5, null, 679.5];
  sheet.getRow(24).values = [, , , , , , , , , , , , "DEUDA TOTAL "];

  book.addWorksheet("Notas").getCell("A1").value = "Recordatorios";
  return new Uint8Array(await book.xlsx.writeBuffer());
}
