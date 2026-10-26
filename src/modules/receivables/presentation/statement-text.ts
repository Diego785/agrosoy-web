import { contentLabel } from "@/modules/catalog/presentation/catalog-labels";
import { METHOD_LABELS, formatAmount } from "@/modules/collections/presentation/collection-labels";
import { Money } from "@/shared/domain/money";
import type { StatementLineView } from "../application/statement-view";

const FREE_LABELS = { bonus: "bonificación", sample: "muestra" } as const;
const VOIDED: Record<StatementLineView["kind"], string> = {
  delivery: "Anulación de la boleta",
  return: "Anulación de la devolución",
  payment: "Anulación del pago",
  charge: "Anulación del cargo",
  other: "Anulación del ajuste",
};

/** Debit kinds raise the balance; these lower it. */
export const CREDIT_KINDS: ReadonlySet<StatementLineView["kind"]> = new Set(["payment", "return"]);

/** What a statement line says, on screen and in the PDF: the main text and an optional note under it. */
export function describeLine(line: StatementLineView): { text: string; note: string | null } {
  if (line.isReversal) return { text: VOIDED[line.kind], note: null };
  if (line.receipt) {
    const inBolivianos =
      line.receipt.currency === "BOB" ? ` · ${formatAmount("BOB", line.receipt.amount)}` : "";
    return {
      text: `Pago · ${METHOD_LABELS[line.receipt.method]}${inBolivianos}`,
      note: line.observation ? `Ref.: ${line.observation}` : null,
    };
  }
  if (line.kind === "charge") return { text: `Cargo: ${line.description}`, note: null };
  if (line.fromSheet && line.kind === "payment") return { text: "Pagos según la planilla", note: null };
  if (line.fromSheet && line.kind === "return") return { text: "Devoluciones según la planilla", note: null };
  if (line.transfer === "out") return { text: "Pasa a la nueva campaña", note: null };
  if (line.transfer === "in") return { text: "Viene de la campaña anterior", note: null };
  if (!line.description && line.kind === "payment") {
    return { text: "Pagos según el resumen de la planilla (sin fecha)", note: null };
  }
  if (!line.description && line.kind === "return") {
    return { text: "Devoluciones según el resumen de la planilla (sin fecha)", note: null };
  }
  if (line.kind === "other" && !line.description) return { text: "Ajuste", note: null };
  const packaging = line.packaging ? ` · ${contentLabel(line.packaging)}` : "";
  const free = line.freeOfCharge ? ` (${FREE_LABELS[line.freeOfCharge]})` : "";
  const returned = line.kind === "return" ? " (devolución)" : "";
  return {
    text: `${line.description}${packaging}${free}${returned}`,
    note: line.observation ? `Obs.: ${line.observation}` : null,
  };
}

/** "Boleta 12", "Recibo 3", the sheet's note number, or nothing. */
export function documentLabel(line: StatementLineView): string {
  if (line.receipt) return `Recibo ${line.receipt.number}`;
  if (line.noteNumber === null) return "";
  return line.document?.type === "note" ? `Boleta ${line.noteNumber}` : String(line.noteNumber);
}

/** Each line with the balance after it, as the spreadsheet's "Saldo" column. */
export function withRunningBalance(
  lines: StatementLineView[],
): { line: StatementLineView; balance: string }[] {
  let balance = Money.zero();
  return lines.map((line) => {
    const amount = Money.parse(line.amount);
    balance = CREDIT_KINDS.has(line.kind) ? balance.subtract(amount) : balance.add(amount);
    return { line, balance: balance.toDecimalString() };
  });
}
