import { ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import { Money } from "@/shared/domain/money";
import { formatMoney, formatPerMille, formatUsd } from "@/shared/presentation/format";
import { CardField, CardList, CardListItem, WideOnly } from "@/shared/presentation/responsive-list";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/presentation/ui/table";
import type { PortfolioStatementView } from "../application/statement-view";
import { Figure, Figures, SourceNotice, StatusBadge } from "./statement-parts";

/** The summary Agrosoil keeps next to each sheet: Cliente, Entrega, Pago, Dev., Deuda and status. */
export function PortfolioStatement({
  statement,
  customerHref,
}: {
  statement: PortfolioStatementView;
  customerHref: (customerKey: string) => string;
}) {
  const { totals } = statement;
  const owing = statement.customers.filter((customer) => customer.totals.status === "owing").length;

  return (
    <div className="flex flex-col gap-6">
      <SourceNotice source={statement.source} />
      <Figures>
        <Figure label="Ventas" value={formatUsd(totals.delivered)} />
        <Figure label="Cobrado" value={formatUsd(totals.paid)} />
        <Figure label="Deuda total" value={formatUsd(totals.balance)} emphasis />
        <Figure
          label="Cobrado de las ventas"
          value={statement.collectedPerMille === null ? "—" : formatPerMille(statement.collectedPerMille)}
        />
      </Figures>

      <WideOnly>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead className="text-right">Entrega</TableHead>
              <TableHead className="text-right">Pago</TableHead>
              <TableHead className="text-right">Dev.</TableHead>
              <TableHead className="text-right">Deuda</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="w-10 print:hidden">
                <span className="sr-only">Abrir</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {statement.customers.map((customer) => (
              <TableRow key={customer.key} className="group relative">
                <TableCell className="font-medium">
                  {/* The link covers the row, so the whole row opens the customer's statement. */}
                  <Link
                    href={customerHref(customer.key)}
                    className="group-hover:text-primary after:absolute after:inset-0"
                  >
                    {customer.name}
                  </Link>
                </TableCell>
                <Amount value={customer.totals.delivered} />
                <Amount value={customer.totals.paid} />
                <Amount value={customer.totals.returned} />
                <Amount value={customer.totals.balance} strong />
                <TableCell>
                  <StatusBadge status={customer.totals.status} />
                </TableCell>
                <TableCell className="text-muted-foreground print:hidden">
                  <ChevronRightIcon
                    className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
                    aria-hidden
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell>
                Total · {statement.customers.length} clientes, {owing} con deuda
              </TableCell>
              <Amount value={totals.delivered} />
              <Amount value={totals.paid} />
              <Amount value={totals.returned} />
              <Amount value={totals.balance} strong />
              <TableCell />
              <TableCell className="print:hidden" />
            </TableRow>
          </TableFooter>
        </Table>
      </WideOnly>
      <CardList label="Clientes de la planilla">
        {statement.customers.map((customer) => (
          <CardListItem key={customer.key} className="relative">
            <div className="flex items-baseline justify-between gap-3">
              <Link href={customerHref(customer.key)} className="font-medium after:absolute after:inset-0">
                {customer.name}
              </Link>
              <StatusBadge status={customer.totals.status} />
            </div>
            <CardField label="Entrega">{amountText(customer.totals.delivered)}</CardField>
            <CardField label="Pago">{amountText(customer.totals.paid)}</CardField>
            <CardField label="Devolución">{amountText(customer.totals.returned)}</CardField>
            <CardField label="Deuda">
              <span className="font-semibold">{amountText(customer.totals.balance)}</span>
            </CardField>
          </CardListItem>
        ))}
        <CardListItem className="bg-muted/50 font-medium">
          <span>
            Total · {statement.customers.length} clientes, {owing} con deuda
          </span>
          <CardField label="Deuda">
            <span className="font-semibold">{amountText(totals.balance)}</span>
          </CardField>
        </CardListItem>
      </CardList>
    </div>
  );
}

function amountText(value: string): string {
  return Money.parse(value).isZero() ? "—" : formatMoney(value);
}

function Amount({ value, strong = false }: { value: string; strong?: boolean }) {
  return (
    <TableCell className={`text-right tabular-nums ${strong ? "font-semibold" : ""}`}>
      {Money.parse(value).isZero() ? <span className="text-muted-foreground">—</span> : formatMoney(value)}
    </TableCell>
  );
}
