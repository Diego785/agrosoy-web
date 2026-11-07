"use client";

import { CheckIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { PAYMENT_METHODS, cashNoteAmount } from "@/modules/collections/domain/payment";
import { CURRENCY_LABELS, METHOD_LABELS } from "@/modules/collections/presentation/collection-labels";
import { ExchangeRate } from "@/shared/domain/exchange-rate";
import { Money } from "@/shared/domain/money";
import { applyActionError } from "@/shared/presentation/form-errors";
import { formatMoney } from "@/shared/presentation/format";
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
import { Field, FieldDescription, FieldError, FieldLabel } from "@/shared/presentation/ui/field";
import { Input } from "@/shared/presentation/ui/input";
import { NativeSelect, NativeSelectOption } from "@/shared/presentation/ui/native-select";
import { Textarea } from "@/shared/presentation/ui/textarea";
import type { ConfirmNoteInput, NextNoteNumberInput, VoidNoteInput } from "../application/note-schemas";
import { confirmNoteAction, setNextNoteNumberAction, voidNoteAction } from "./note-actions";
import { resetOnLeave } from "@/shared/presentation/reset-on-leave";

// The server validates everything; these forms only show its answers next to the fields.

/** Confirming can also fail on the note's own date, which isn't an input here. */
type ConfirmFormValues = Required<ConfirmNoteInput> & { noteDate?: string };

export const ConfirmNoteButton = resetOnLeave(function ConfirmNoteButton({
  noteId,
  total,
  exchangeRate,
  isCash,
  nextNumber,
}: {
  noteId: string;
  /** US$ the customer will owe, as a decimal string. */
  total: string;
  exchangeRate: string;
  /** A cash note records its payment as it is confirmed. */
  isCash: boolean;
  nextNumber: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPaper, setIsPaper] = useState(false);
  const [isWorking, startWorking] = useTransition();
  const form = useForm<ConfirmFormValues>({
    defaultValues: {
      paperNumber: "",
      payment: { currency: "USD", method: "cash", reference: "", inKindDescription: "" },
    },
  });
  const { errors } = form.formState;
  const [currency, method] = useWatch({
    control: form.control,
    name: ["payment.currency", "payment.method"],
  });
  const isPaidNow = isCash && Number(total) > 0;

  const submit = form.handleSubmit((values) =>
    startWorking(async () => {
      const result = await confirmNoteAction(noteId, {
        paperNumber: isPaper ? values.paperNumber : "",
        payment: isPaidNow ? values.payment : undefined,
      });
      if (!result.ok) {
        return applyActionError(form, result.error, { paperNumber: "Ya hay una boleta con ese número." });
      }
      setOpen(false);
      toast.success(
        result.data.receiptNumber
          ? `Boleta N.º ${result.data.number} confirmada con el recibo N.º ${result.data.receiptNumber}`
          : `Boleta N.º ${result.data.number} confirmada`,
      );
      router.refresh();
    }),
  );
  const noteError = errors.noteDate ?? errors.root;

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        <CheckIcon aria-hidden />
        Confirmar
      </Button>
      <AlertDialog open={open} onOpenChange={(next) => !isWorking && setOpen(next)}>
        <AlertDialogContent>
          <form onSubmit={submit} noValidate className="flex flex-col gap-4">
            <AlertDialogHeader>
              <AlertDialogTitle>¿Confirmar la boleta?</AlertDialogTitle>
              <AlertDialogDescription>
                {isPaidNow
                  ? `Es al contado: se registra el cobro de US$ ${formatMoney(total)} junto con la boleta. Ya no se podrá editar; solo anular.`
                  : Number(total) > 0
                    ? `Se carga US$ ${formatMoney(total)} a la deuda del cliente y la boleta ya no se puede editar; solo anular.`
                    : "Solo tiene bonificaciones o muestras: no genera deuda. Ya no se podrá editar; solo anular."}
              </AlertDialogDescription>
            </AlertDialogHeader>

            {isPaidNow && (
              <fieldset className="flex flex-col gap-3 rounded-lg border p-3">
                <legend className="px-1 text-sm font-medium">Cobro</legend>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="paymentCurrency">Pagó en</FieldLabel>
                    <NativeSelect id="paymentCurrency" {...form.register("payment.currency")}>
                      <NativeSelectOption value="USD">{CURRENCY_LABELS.USD}</NativeSelectOption>
                      <NativeSelectOption value="BOB">{CURRENCY_LABELS.BOB}</NativeSelectOption>
                    </NativeSelect>
                    <FieldDescription>
                      {currency === "BOB"
                        ? `Bs ${formatMoney(cashNoteAmount(Money.parse(total), ExchangeRate.parse(exchangeRate), "BOB").toDecimalString())}`
                        : `US$ ${formatMoney(total)}`}
                    </FieldDescription>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="paymentMethod">Forma de pago</FieldLabel>
                    <NativeSelect id="paymentMethod" {...form.register("payment.method")}>
                      {PAYMENT_METHODS.map((option) => (
                        <NativeSelectOption key={option} value={option}>
                          {METHOD_LABELS[option]}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                    <FieldError errors={[errors.payment?.currency ?? errors.payment?.method]} />
                  </Field>
                </div>
                {method === "in_kind" && (
                  <Field data-invalid={!!errors.payment?.inKindDescription}>
                    <FieldLabel htmlFor="paymentInKind">Qué entregó y valor acordado</FieldLabel>
                    <Input id="paymentInKind" {...form.register("payment.inKindDescription")} />
                    <FieldError errors={[errors.payment?.inKindDescription]} />
                  </Field>
                )}
                <Field>
                  <FieldLabel htmlFor="paymentReference">Referencia (opcional)</FieldLabel>
                  <Input id="paymentReference" {...form.register("payment.reference")} />
                </Field>
              </fieldset>
            )}

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isPaper}
                onChange={(event) => setIsPaper(event.target.checked)}
                className="size-4 accent-primary"
              />
              Es una boleta de papel con número impreso
            </label>
            {isPaper ? (
              <Field data-invalid={!!errors.paperNumber}>
                <FieldLabel htmlFor="paperNumber">Número impreso</FieldLabel>
                <Input
                  id="paperNumber"
                  inputMode="numeric"
                  selectOnFocus
                  className="max-w-40"
                  aria-invalid={!!errors.paperNumber}
                  {...form.register("paperNumber")}
                />
                <FieldError errors={[errors.paperNumber]} />
              </Field>
            ) : (
              <p className="text-sm">
                Recibirá el <strong>N.º {nextNumber}</strong>.
              </p>
            )}
            <FieldError errors={[noteError]} />

            <AlertDialogFooter>
              <AlertDialogCancel disabled={isWorking}>Cancelar</AlertDialogCancel>
              <AlertDialogAction type="submit" disabled={isWorking}>
                Confirmar boleta
              </AlertDialogAction>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
});

export const VoidNoteButton = resetOnLeave(function VoidNoteButton({
  noteId,
  number,
}: {
  noteId: string;
  number: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isWorking, startWorking] = useTransition();
  const form = useForm<VoidNoteInput>({ defaultValues: { reason: "" } });
  const { errors } = form.formState;

  const submit = form.handleSubmit((values) =>
    startWorking(async () => {
      const result = await voidNoteAction(noteId, values);
      if (!result.ok) return applyActionError(form, result.error);
      setOpen(false);
      toast.success(`Boleta N.º ${number} anulada`);
      router.refresh();
    }),
  );

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
        onClick={() => setOpen(true)}
      >
        Anular
      </Button>
      <AlertDialog open={open} onOpenChange={(next) => !isWorking && setOpen(next)}>
        <AlertDialogContent>
          <form onSubmit={submit} noValidate className="flex flex-col gap-4">
            <AlertDialogHeader>
              <AlertDialogTitle>¿Anular la boleta N.º {number}?</AlertDialogTitle>
              <AlertDialogDescription>
                Se descuenta su monto de la deuda del cliente con fecha de hoy. La boleta queda en el sistema
                como anulada, con su número y el motivo.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <Field data-invalid={!!errors.reason}>
              <FieldLabel htmlFor="reason">Motivo</FieldLabel>
              <Textarea id="reason" aria-invalid={!!errors.reason} {...form.register("reason")} />
              <FieldError errors={[errors.reason ?? errors.root]} />
            </Field>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isWorking}>Cancelar</AlertDialogCancel>
              <AlertDialogAction type="submit" variant="destructive" disabled={isWorking}>
                Anular boleta
              </AlertDialogAction>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
});

export const NextNumberForm = resetOnLeave(function NextNumberForm({ nextNumber }: { nextNumber: number }) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, startSaving] = useTransition();
  const form = useForm<NextNoteNumberInput>({ defaultValues: { nextNumber: String(nextNumber) } });
  const { errors } = form.formState;

  const submit = form.handleSubmit((values) =>
    startSaving(async () => {
      const result = await setNextNoteNumberAction(values);
      if (!result.ok) return applyActionError(form, result.error);
      setIsEditing(false);
      router.refresh();
    }),
  );

  if (!isEditing) {
    return (
      <p className="text-sm text-muted-foreground">
        La próxima boleta será la <span className="font-medium text-foreground">N.º {nextNumber}</span>.{" "}
        <button
          type="button"
          className="font-medium text-primary hover:underline"
          onClick={() => {
            form.reset({ nextNumber: String(nextNumber) });
            setIsEditing(true);
          }}
        >
          Cambiar
        </button>
      </p>
    );
  }
  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-1">
      <Field data-invalid={!!errors.nextNumber}>
        <FieldLabel htmlFor="nextNumber">Continuar la numeración desde</FieldLabel>
        <div className="flex gap-2">
          <Input
            id="nextNumber"
            inputMode="numeric"
            selectOnFocus
            className="max-w-32"
            aria-invalid={!!errors.nextNumber}
            {...form.register("nextNumber")}
          />
          <Button type="submit" variant="outline" disabled={isSaving}>
            Guardar
          </Button>
          <Button type="button" variant="ghost" onClick={() => setIsEditing(false)}>
            Cancelar
          </Button>
        </div>
        <FieldDescription>Por ejemplo, el primer número del talonario que se usa ahora.</FieldDescription>
        <FieldError errors={[errors.nextNumber ?? errors.root]} />
      </Field>
    </form>
  );
});
