import { contentLabel } from "@/modules/catalog/presentation/catalog-labels";
import {
  CHARGE_CONCEPT_LABELS,
  METHOD_LABELS,
  formatAmount,
} from "@/modules/collections/presentation/collection-labels";
import { ExchangeRate } from "@/shared/domain/exchange-rate";
import { Money } from "@/shared/domain/money";
import { formatRate } from "@/shared/presentation/format";
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

/**
 * What a statement line says, on screen and in the PDF: the main text and an optional note under it.
 * `withRate` adds a payment's exchange rate to its text, where no "T/C" column shows it.
 */
export function describeLine(
  line: StatementLineView,
  { withRate = false }: { withRate?: boolean } = {},
): { text: string; note: string | null } {
  if (line.isReversal) {
    return { text: line.opening ? "Anulación del saldo inicial" : VOIDED[line.kind], note: null };
  }
  if (line.receipt) {
    const bolivianos = paymentInBolivianos(line);
    const rate = withRate && line.exchangeRate ? ` · T/C ${formatRate(line.exchangeRate)}` : "";
    return {
      text: `Pago · ${METHOD_LABELS[line.receipt.method]}${bolivianos ? ` · ${bolivianos}` : ""}${rate}`,
      note: line.observation ? `Ref.: ${line.observation}` : null,
    };
  }
  if (line.kind === "charge") {
    const concept = line.chargeConcept ? CHARGE_CONCEPT_LABELS[line.chargeConcept] : "Cargo";
    return { text: `${concept}: ${line.description}`, note: null };
  }
  if (line.opening) {
    const inFavor = Money.parse(line.amount).isNegative();
    return {
      text: inFavor ? "Saldo inicial a favor del cliente" : "Saldo inicial",
      note: line.opening.note,
    };
  }
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

/**
 * A payment's line in bolivianos (D39): what was received when it was paid in Bs, its equivalent when it
 * was paid in dollars. A payment split over several campaigns (D20) shows each campaign's part, and
 * the whole Bs received, so two lines never claim the same bolivianos.
 */
function paymentInBolivianos(line: StatementLineView): string | null {
  const receipt = line.receipt;
  if (!receipt || !line.exchangeRate) return null;
  const part = Money.parse(line.amount);
  const isWhole = part.equals(Money.parse(receipt.usdAmount));
  if (receipt.currency === "BOB" && isWhole) return formatAmount("BOB", receipt.amount);
  const partInBolivianos = formatAmount(
    "BOB",
    ExchangeRate.parse(line.exchangeRate).toBob(part).toDecimalString(),
  );
  if (receipt.currency === "BOB") return `${partInBolivianos} de ${formatAmount("BOB", receipt.amount)}`;
  return `equivale a ${partInBolivianos}`;
}

/** "Fact. 4471" under a delivery's number, when it has a SIN invoice (D40). */
export function invoiceLabel(line: StatementLineView): string | null {
  return line.invoiceNumber ? `Fact. ${line.invoiceNumber}` : null;
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
