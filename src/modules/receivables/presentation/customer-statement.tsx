import { Money } from "@/shared/domain/money";
import { formatDate, formatMoney, formatQuantity, formatRate, formatUsd } from "@/shared/presentation/format";
import { Badge } from "@/shared/presentation/ui/badge";
import { CardField, CardList, CardListItem, WideOnly } from "@/shared/presentation/responsive-list";
import { CardListSkeleton, TableSkeleton } from "@/shared/presentation/skeletons";
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
import {
  Figure,
  Figures,
  StatementFiguresSkeleton,
  SourceNotice,
  SourceNoticeSkeleton,
  StatusBadge,
} from "./statement-parts";

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

      <WideOnly>
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
                <TableCell className="text-muted-foreground tabular-nums">
                  {line.date ? formatDate(line.date) : "—"}
                </TableCell>
                <TableCell className="font-medium tabular-nums">{line.noteNumber ?? "—"}</TableCell>
                <TableCell>
                  <LineDetail line={line} />
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
      </WideOnly>
      <CardList label="Movimientos">
        {rows.map(({ line, balance: running }, index) => (
          <CardListItem key={index}>
            <span className="text-xs text-muted-foreground tabular-nums">
              {line.date ? formatDate(line.date) : "Sin fecha"}
              {line.noteNumber && ` · Boleta ${line.noteNumber}`}
            </span>
            <span>
              <LineDetail line={line} />
            </span>
            {line.quantity && line.unitPrice && (
              <span className="text-xs text-muted-foreground tabular-nums">
                {formatQuantity(line.quantity)} × {formatMoney(line.unitPrice)}
                {line.exchangeRate && ` · T/C ${formatRate(line.exchangeRate)}`}
              </span>
            )}
            <CardField
              label={line.kind === "delivery" ? "Entrega" : line.kind === "payment" ? "Pago" : "Devolución"}
            >
              {formatMoney(line.amount)}
            </CardField>
            <CardField label="Saldo">
              <span className="font-medium">{formatMoney(running)}</span>
            </CardField>
          </CardListItem>
        ))}
        <CardListItem className="bg-muted/50">
          <div className="flex items-center justify-between gap-3 font-medium">
            <span>Total</span>
            <StatusBadge status={totals.status} />
          </div>
          <CardField label="Entregas">{formatMoney(totals.delivered)}</CardField>
          <CardField label="Pagos y devoluciones">
            {formatMoney(Money.parse(totals.paid).add(Money.parse(totals.returned)).toDecimalString())}
          </CardField>
          <CardField label="Saldo">
            <span className="font-semibold">{formatMoney(totals.balance)}</span>
          </CardField>
        </CardListItem>
      </CardList>
    </div>
  );
}

/** `CustomerStatement` while it loads: the source, the four figures and the movements. */
export function CustomerStatementSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-6">
      <SourceNoticeSkeleton />
      <StatementFiguresSkeleton />
      <TableSkeleton
        rows={9}
        columns={[
          { shape: "short" },
          { shape: "code" },
          { shape: "text" },
          { shape: "code", align: "right" },
          { shape: "short", align: "right" },
          { shape: "code", align: "right" },
          { shape: "short", align: "right" },
          { shape: "short", align: "right" },
          { shape: "short", align: "right" },
        ]}
      />
      <CardListSkeleton lines={3} />
    </div>
  );
}

function LineDetail({ line }: { line: StatementLineView }) {
  return (
    <>
      {line.kind !== "delivery" && !line.description ? UNDATED[line.kind] : line.description}
      {line.kind === "return" && line.description && (
        <Badge variant="neutral" className="ml-2 print:border-current">
          devolución
        </Badge>
      )}
      {line.observation && (
        <span className="block text-xs text-muted-foreground">Obs.: {line.observation}</span>
      )}
    </>
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
