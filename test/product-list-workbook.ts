import ExcelJS from "exceljs";

type Row = [code: string, label: string, price?: number, per?: string];

const LIST: Row[] = [
  ["001", "Fulvin 40-22(20lts.)", 7.8, "Litro "],
  ["002", "Fulvin 40-22(5lts.)", 8.3, "Litro "],
  ["020", "Papel Hidrosensible(50 unid.)", 12, "bolsa "],
  ["026", "4-Energy (250ml.)", 70, "frasco "],
];

/** A workbook laid out like Agrosoil's PRODUCTOS.xlsx: merged title, headings, "OTROS" concepts. */
export async function productListWorkbook({
  fulvinPrice = 7.8,
  labels = {},
}: {
  fulvinPrice?: number;
  /** Labels to write instead of the usual ones, by code. */
  labels?: Record<string, string>;
} = {}): Promise<Uint8Array> {
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet("PRODUCTOS ");
  sheet.getCell("B2").value = "CODIGOS DE LOS PRODUCTOS";
  sheet.mergeCells("B2:E3");
  // In exceljs `row.values[1]` is column A; the leading holes put the table in column B.
  sheet.getRow(4).values = [, , "CODIGOS ", "PRODUCTOS", , , "PRECIO $US. "];
  const rows: Row[] = LIST.map(([code, label, price, per]) => [
    code,
    labels[code] ?? label,
    code === "001" ? fulvinPrice : price,
    per,
  ]);
  let rowNumber = 5;
  for (const [code, label, price, per] of rows) {
    sheet.getRow(rowNumber++).values = [, , code, label, , , price ?? null, per ?? null];
  }
  sheet.getRow(rowNumber++).values = [, , "AGROQUIMICOS "];
  sheet.getRow(rowNumber++).values = [, , "051", "Oberon(5lts.)"];
  sheet.getRow(rowNumber++).values = [, , "OTROS "];
  sheet.getRow(rowNumber++).values = [, , "079", "INTERES "];
  return new Uint8Array(await book.xlsx.writeBuffer());
}
