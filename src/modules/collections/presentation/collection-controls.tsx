"use client";

import { ArrowLeftRightIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { ActionResult } from "@/shared/presentation/action-result";
import { errorMessage } from "@/shared/presentation/error-messages";
import { applyActionError } from "@/shared/presentation/form-errors";
import { formatDate, formatRate, trimDecimalZeros } from "@/shared/presentation/format";
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
import { Field, FieldError, FieldLabel } from "@/shared/presentation/ui/field";
import { Input } from "@/shared/presentation/ui/input";
import { Textarea } from "@/shared/presentation/ui/textarea";
import type { CurrentRate, OfficialRate } from "../application/collection-ports";
import type { DailyRateInput, VoidReasonInput } from "../application/collection-schemas";
import { setDailyRateAction, voidChargeAction, voidPaymentAction } from "./collection-actions";
import { resetOnLeave } from "@/shared/presentation/reset-on-leave";

export const VoidPaymentButton = resetOnLeave(function VoidPaymentButton({
  paymentId,
  receiptNumber,
}: {
  paymentId: string;
  receiptNumber: number;
}) {
  return (
    <VoidButton
      title={`¿Anular el recibo N.º ${receiptNumber}?`}
      description="El monto vuelve a la deuda del cliente con fecha de hoy. El recibo queda como anulado, con el motivo."
      done={`Recibo N.º ${receiptNumber} anulado`}
      run={(input) => voidPaymentAction(paymentId, input)}
    />
  );
});

export const VoidChargeButton = resetOnLeave(function VoidChargeButton({ chargeId }: { chargeId: string }) {
  return (
    <VoidButton
      title="¿Anular este cargo?"
      description="Se descuenta de la deuda del cliente con fecha de hoy. El cargo queda como anulado, con el motivo."
      done="Cargo anulado"
      run={(input) => voidChargeAction(chargeId, input)}
    />
  );
});

function VoidButton({
  title,
  description,
  done,
  run,
}: {
  title: string;
  description: string;
  done: string;
  run: (input: VoidReasonInput) => Promise<ActionResult<null>>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isWorking, startWorking] = useTransition();
  const form = useForm<VoidReasonInput>({ defaultValues: { reason: "" } });
  const { errors } = form.formState;

  const submit = form.handleSubmit((values) =>
    startWorking(async () => {
      const result = await run(values);
      if (!result.ok) return applyActionError(form, result.error);
      setOpen(false);
      toast.success(done);
      router.refresh();
    }),
  );

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="relative text-destructive hover:bg-destructive/10 hover:text-destructive"
        onClick={() => setOpen(true)}
      >
        Anular
      </Button>
      <AlertDialog open={open} onOpenChange={(next) => !isWorking && setOpen(next)}>
        <AlertDialogContent>
          <form onSubmit={submit} noValidate className="flex flex-col gap-4">
            <AlertDialogHeader>
              <AlertDialogTitle>{title}</AlertDialogTitle>
              <AlertDialogDescription>{description}</AlertDialogDescription>
            </AlertDialogHeader>
            <Field data-invalid={!!errors.reason}>
              <FieldLabel htmlFor="reason">Motivo</FieldLabel>
              <Textarea id="reason" aria-invalid={!!errors.reason} {...form.register("reason")} />
              <FieldError errors={[errors.reason ?? errors.root]} />
            </Field>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isWorking}>Cancelar</AlertDialogCancel>
              <AlertDialogAction type="submit" variant="destructive" disabled={isWorking}>
                Anular
              </AlertDialogAction>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/**
 * The rate in force for customers without their own: shown, and changed by administration. It stays
 * until someone replaces it (D36). `children` is what goes beside it: the official rate.
 */
export const DailyRateForm = resetOnLeave(function DailyRateForm({
  today,
  current,
  children,
}: {
  today: string;
  current: CurrentRate | null;
  children?: ReactNode;
}) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, startSaving] = useTransition();
  const form = useForm<DailyRateInput>({ defaultValues: { rateDate: today, rate: "" } });
  const { errors } = form.formState;

  const submit = form.handleSubmit((values) =>
    startSaving(async () => {
      const result = await setDailyRateAction(values);
      if (!result.ok) return applyActionError(form, result.error);
      setIsEditing(false);
      router.refresh();
    }),
  );

  function startEditing(rate: string) {
    form.reset({ rateDate: today, rate: trimDecimalZeros(rate) });
    setIsEditing(true);
  }

  if (!isEditing && current) {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border bg-card px-4 py-3 text-sm shadow-xs">
        <RateMark />
        <span className="text-muted-foreground">Tipo de cambio vigente</span>
        <span className="font-semibold tabular-nums">{formatRate(current.rate)} Bs por US$</span>
        <span className="text-xs text-muted-foreground tabular-nums">
          desde el {formatDate(current.since)}
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {children}
          <Button type="button" variant="ghost" size="sm" onClick={() => startEditing(current.rate)}>
            Cambiar
          </Button>
        </div>
      </div>
    );
  }
  return (
    <form onSubmit={submit} noValidate className="rounded-xl border bg-card px-4 py-3 shadow-xs">
      <Field data-invalid={!!errors.rate}>
        <FieldLabel htmlFor="dailyRate">Tipo de cambio vigente (Bs por US$)</FieldLabel>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            id="dailyRate"
            inputMode="decimal"
            selectOnFocus
            placeholder="12.00"
            className="max-w-32"
            aria-invalid={!!errors.rate}
            {...form.register("rate")}
          />
          <Button type="submit" variant="outline" disabled={isSaving}>
            Guardar
          </Button>
          {current && (
            <Button type="button" variant="ghost" onClick={() => setIsEditing(false)}>
              Cancelar
            </Button>
          )}
          {children}
        </div>
        <FieldError errors={[errors.rate ?? errors.rateDate ?? errors.root]} />
      </Field>
    </form>
  );
});

/** The central bank's rate with its date, to adopt it with one click (D36). */
export function OfficialRateHint({
  today,
  official,
  isCurrent,
}: {
  today: string;
  official: OfficialRate;
  isCurrent: boolean;
}) {
  const router = useRouter();
  const [isSaving, startSaving] = useTransition();

  function adoptOfficial() {
    startSaving(async () => {
      const result = await setDailyRateAction({ rateDate: today, rate: official.rate });
      if (!result.ok) return void toast.error(errorMessage(result.error));
      toast.success(`Tipo de cambio vigente: ${formatRate(official.rate)}`);
      router.refresh();
    });
  }

  return (
    <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground tabular-nums">
      Oficial BCB {formatRate(official.rate)} ({formatDate(official.date)})
      {!isCurrent && (
        <Button type="button" variant="outline" size="sm" disabled={isSaving} onClick={adoptOfficial}>
          Usar oficial
        </Button>
      )}
    </span>
  );
}

function RateMark() {
  return (
    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
      <ArrowLeftRightIcon className="size-4" aria-hidden />
    </span>
  );
}
