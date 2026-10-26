import { Money } from "@/shared/domain/money";
import { formatDate, formatMoney, formatQuantity, formatRate, formatUsd } from "@/shared/presentation/format";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/presentation/ui/table";
import type { CustomerStatementView, StatementLineView } from "../application/statement-view";
import { Figure, Figures, SourceNotice, StatusBadge } from "./statement-parts";

const UNDATED: Record<Exclude<StatementLineView["kind"], "delivery">, string> = {
  payment: "Pagos según el resumen de la planilla (sin fecha)",
  return: "Devoluciones según el resumen de la planilla (sin fecha)",
};

/** One customer's movements with a running balance: deliveries add to the debt, payments and returns lower it. */
export function CustomerStatement({ statement }: { statement: CustomerStatementView }) {
  const { totals } = statement;
  const rows = withRunningBalance(statement.lines);

  return (
    <div className="flex flex-col gap-6">
      <SourceNotice source={statement.source} />
      <Figures>
        <Figure label="Entregas" value={formatUsd(totals.delivered)} />
        <Figure label="Pagos" value={formatUsd(totals.paid)} />
        <Figure label="Devoluciones" value={formatUsd(totals.returned)} />
        <Figure label="Deuda" value={formatUsd(totals.balance)} emphasis={totals.status === "owing"} />
      </Figures>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Fecha</TableHead>
            <TableHead>Boleta</TableHead>
            <TableHead>Detalle</TableHead>
            <TableHead className="text-right">Cant.</TableHead>
            <TableHead className="text-right">Precio</TableHead>
            <TableHead className="text-right">T/C</TableHead>
            <TableHead className="text-right">Entrega</TableHead>
            <TableHead className="text-right">Pago / Dev.</TableHead>
            <TableHead className="text-right">Saldo</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(({ line, balance: running }, index) => (
            <TableRow key={index}>
              <TableCell className="tabular-nums">{line.date ? formatDate(line.date) : "—"}</TableCell>
              <TableCell className="tabular-nums">{line.noteNumber ?? "—"}</TableCell>
              <TableCell>
                {line.kind !== "delivery" && !line.description ? UNDATED[line.kind] : line.description}
                {line.kind === "return" && line.description && (
                  <span className="ml-2 text-xs text-muted-foreground">devolución</span>
                )}
                {line.observation && (
                  <span className="block text-xs text-muted-foreground">Obs.: {line.observation}</span>
                )}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {line.quantity ? formatQuantity(line.quantity) : ""}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {line.unitPrice ? formatMoney(line.unitPrice) : ""}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {line.exchangeRate ? formatRate(line.exchangeRate) : ""}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {line.kind === "delivery" ? formatMoney(line.amount) : ""}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {line.kind === "delivery" ? "" : formatMoney(line.amount)}
              </TableCell>
              <TableCell className="text-right font-medium tabular-nums">{formatMoney(running)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell colSpan={6}>Total</TableCell>
            <TableCell className="text-right tabular-nums">{formatMoney(totals.delivered)}</TableCell>
            <TableCell className="text-right tabular-nums">
              {formatMoney(Money.parse(totals.paid).add(Money.parse(totals.returned)).toDecimalString())}
            </TableCell>
            <TableCell className="text-right font-semibold tabular-nums">
              <span className="mr-2">{formatMoney(totals.balance)}</span>
              <StatusBadge status={totals.status} />
            </TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  );
}

function withRunningBalance(lines: StatementLineView[]): { line: StatementLineView; balance: string }[] {
  const rows: { line: StatementLineView; balance: string }[] = [];
  let balance = Money.zero();
  for (const line of lines) {
    const amount = Money.parse(line.amount);
    balance = line.kind === "delivery" ? balance.add(amount) : balance.subtract(amount);
    rows.push({ line, balance: balance.toDecimalString() });
  }
  return rows;
}
