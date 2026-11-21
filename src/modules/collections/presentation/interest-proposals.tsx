"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { campaignLabel } from "@/modules/campaigns/presentation/campaign-labels";
import { formatCustomerCode } from "@/modules/customers/domain/customer";
import { monthName } from "../domain/interest";
import { Money } from "@/shared/domain/money";
import type { ActionResult } from "@/shared/presentation/action-result";
import { errorMessage } from "@/shared/presentation/error-messages";
import { formatCount, formatMoney, formatUsd } from "@/shared/presentation/format";
import { resetOnLeave } from "@/shared/presentation/reset-on-leave";
import { CardField, CardList, CardListItem, WideOnly } from "@/shared/presentation/responsive-list";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/presentation/ui/alert-dialog";
import { Button } from "@/shared/presentation/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/presentation/ui/table";
import type { InterestDecisionInput } from "../application/collection-schemas";
import type { InterestProposalView } from "../application/collection-ports";
import { chargeInterestAction, waiveInterestAction } from "./collection-actions";

type Decision = "charge" | "waive";

const interests = (count: number) => (count === 1 ? "1 interés" : `${formatCount(count)} intereses`);

/**
 * The interest charges the system proposes (D38). Administration reviews them, unticks whoever
 * shouldn't pay, and charges or waives the rest; a waived one isn't proposed again.
 */
export const InterestProposals = resetOnLeave(function InterestProposals({
  proposals,
}: {
  proposals: InterestProposalView[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(() => new Set(proposals.map((p) => p.key)));
  const [asking, setAsking] = useState<Decision | null>(null);
  const [isWorking, startWorking] = useTransition();

  const chosen = proposals.filter((proposal) => selected.has(proposal.key));
  const chosenTotal = Money.sum(chosen.map((proposal) => Money.parse(proposal.usdAmount))).toDecimalString();
  const customerCount = new Set(chosen.map((proposal) => proposal.customer.id)).size;
  const allChosen = chosen.length === proposals.length;

  const toggle = (key: string, checked: boolean) =>
    setSelected((previous) => {
      const next = new Set(previous);
      if (checked) next.add(key);
      else next.delete(key);
      return next;
    });
  const toggleAll = (checked: boolean) =>
    setSelected(checked ? new Set(proposals.map((proposal) => proposal.key)) : new Set());

  function decide(decision: Decision) {
    const input: InterestDecisionInput = {
      proposals: chosen.map((proposal) => ({ key: proposal.key, usdAmount: proposal.usdAmount })),
    };
    startWorking(async () => {
      const result: ActionResult<{ charged: number } | { waived: number }> =
        decision === "charge" ? await chargeInterestAction(input) : await waiveInterestAction(input);
      setAsking(null);
      if (!result.ok) {
        const reviewAgain = result.error.code === "DUPLICATE" || result.error.fieldErrors?.proposals;
        toast.error(
          reviewAgain
            ? "La lista cambió desde que la abriste. Revísala de nuevo."
            : errorMessage(result.error),
        );
        router.refresh();
        return;
      }
      toast.success(
        "charged" in result.data
          ? `${interests(result.data.charged)} cargados a la deuda`
          : `${interests(result.data.waived)} descartados`,
      );
      router.refresh();
    });
  }

  const checkbox = (proposal: InterestProposalView) => (
    <input
      type="checkbox"
      className="size-4 accent-primary"
      aria-label={`Elegir a ${proposal.customer.name}, ${campaignLabel(proposal.campaign)}, ${monthName(proposal.month)}`}
      checked={selected.has(proposal.key)}
      onChange={(event) => toggle(proposal.key, event.target.checked)}
    />
  );

  return (
    <div className="flex flex-col gap-4">
      <WideOnly>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <input
                  type="checkbox"
                  className="size-4 accent-primary"
                  aria-label="Elegir todos"
                  checked={allChosen}
                  onChange={(event) => toggleAll(event.target.checked)}
                />
              </TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Campaña</TableHead>
              <TableHead className="w-40">Mes</TableHead>
              <TableHead className="text-right">Debía al cierre (US$)</TableHead>
              <TableHead className="text-right">Interés (US$)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {proposals.map((proposal) => (
              <TableRow key={proposal.key} data-state={selected.has(proposal.key) ? "selected" : undefined}>
                <TableCell>{checkbox(proposal)}</TableCell>
                <TableCell className="font-medium">
                  <span className="mr-2 text-xs text-muted-foreground tabular-nums">
                    {formatCustomerCode(proposal.customer.code)}
                  </span>
                  {proposal.customer.name}
                </TableCell>
                <TableCell className="text-muted-foreground">{campaignLabel(proposal.campaign)}</TableCell>
                <TableCell className="text-muted-foreground first-letter:uppercase">
                  {monthName(proposal.month)}
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatMoney(proposal.baseUsd)}</TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  {formatMoney(proposal.usdAmount)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={5}>
                {chosen.length === 0
                  ? "Ninguno elegido"
                  : chosen.length === 1
                    ? "1 interés elegido"
                    : `${interests(chosen.length)} elegidos`}
              </TableCell>
              <TableCell className="text-right font-semibold tabular-nums">
                {formatMoney(chosenTotal)}
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </WideOnly>
      <div className="md:hidden">
        <label className="flex items-center gap-2 px-1 pb-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            className="size-4 accent-primary"
            checked={allChosen}
            onChange={(event) => toggleAll(event.target.checked)}
          />
          Elegir todos
        </label>
        <CardList label="Intereses propuestos">
          {proposals.map((proposal) => (
            <CardListItem key={proposal.key}>
              <label className="flex items-center gap-3">
                {checkbox(proposal)}
                <span className="min-w-0 flex-1 truncate font-medium">{proposal.customer.name}</span>
                <span className="font-semibold tabular-nums">{formatUsd(proposal.usdAmount)}</span>
              </label>
              <span className="text-xs text-muted-foreground tabular-nums">
                {campaignLabel(proposal.campaign)} · {monthName(proposal.month)}
              </span>
              <CardField label="Debía">US$ {formatMoney(proposal.baseUsd)}</CardField>
            </CardListItem>
          ))}
        </CardList>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" disabled={chosen.length === 0 || isWorking} onClick={() => setAsking("charge")}>
          Cargar {chosen.length > 0 ? interests(chosen.length) : "intereses"}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={chosen.length === 0 || isWorking}
          onClick={() => setAsking("waive")}
        >
          Descartar
        </Button>
        <span className="text-sm text-muted-foreground md:hidden">Total {formatUsd(chosenTotal)}</span>
      </div>
      <AlertDialog open={asking !== null} onOpenChange={(open) => !isWorking && !open && setAsking(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {asking === "waive"
                ? `¿Descartar ${interests(chosen.length)}?`
                : `¿Cargar ${interests(chosen.length)}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {asking === "waive"
                ? "No se cobran y no vuelven a proponerse. Si después hace falta, se registra un cargo a mano."
                : `Se suman ${formatUsd(chosenTotal)} a la deuda de ${
                    customerCount === 1 ? "1 cliente" : `${formatCount(customerCount)} clientes`
                  }, como cargos de interés con fecha de hoy. Cada uno se puede anular desde Cargos.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isWorking}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant={asking === "waive" ? "destructive" : "default"}
              disabled={isWorking}
              onClick={() => asking && decide(asking)}
            >
              {asking === "waive" ? "Descartar" : "Cargar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
});
