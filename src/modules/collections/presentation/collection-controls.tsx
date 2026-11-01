"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { ActionResult } from "@/shared/presentation/action-result";
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
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
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

/** The day's rate for `daily` customers: shown, and editable by administration. */
export const DailyRateForm = resetOnLeave(function DailyRateForm({
  today,
  rate,
}: {
  today: string;
  rate: string | null;
}) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(rate === null);
  const [isSaving, startSaving] = useTransition();
  const form = useForm<DailyRateInput>({
    defaultValues: { rateDate: today, rate: rate ? trimDecimalZeros(rate) : "" },
  });
  const { errors } = form.formState;

  const submit = form.handleSubmit((values) =>
    startSaving(async () => {
      const result = await setDailyRateAction(values);
      if (!result.ok) return applyActionError(form, result.error);
      setIsEditing(false);
      router.refresh();
    }),
  );

  if (!isEditing && rate) {
    return (
      <p className="text-sm text-muted-foreground">
        Tipo de cambio del día ({formatDate(today)}):{" "}
        <span className="font-medium text-foreground">{formatRate(rate)} Bs por US$</span>.{" "}
        <button
          type="button"
          className="underline underline-offset-2 hover:text-foreground"
          onClick={() => setIsEditing(true)}
        >
          Cambiar
        </button>
      </p>
    );
  }
  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-1">
      <Field data-invalid={!!errors.rate}>
        <FieldLabel htmlFor="dailyRate">Tipo de cambio del día ({formatDate(today)})</FieldLabel>
        <div className="flex gap-2">
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
          {rate && (
            <Button type="button" variant="ghost" onClick={() => setIsEditing(false)}>
              Cancelar
            </Button>
          )}
        </div>
        <FieldError errors={[errors.rate ?? errors.rateDate ?? errors.root]} />
      </Field>
    </form>
  );
});
