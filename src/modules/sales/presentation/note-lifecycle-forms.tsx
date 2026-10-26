"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
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
import { Textarea } from "@/shared/presentation/ui/textarea";
import type { ConfirmNoteInput, NextNoteNumberInput, VoidNoteInput } from "../application/note-schemas";
import { confirmNoteAction, setNextNoteNumberAction, voidNoteAction } from "./note-actions";

// The server validates everything; these forms only show its answers next to the fields.

/** Confirming can also fail on the note's own date or payment terms, which aren't inputs here. */
type ConfirmFormValues = ConfirmNoteInput & { noteDate?: string; paymentTerms?: string };

export function ConfirmNoteButton({
  noteId,
  total,
  nextNumber,
}: {
  noteId: string;
  /** US$ the customer will owe, as a decimal string. */
  total: string;
  nextNumber: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPaper, setIsPaper] = useState(false);
  const [isWorking, startWorking] = useTransition();
  const form = useForm<ConfirmFormValues>({ defaultValues: { paperNumber: "" } });
  const { errors } = form.formState;

  const submit = form.handleSubmit((values) =>
    startWorking(async () => {
      const result = await confirmNoteAction(noteId, { paperNumber: isPaper ? values.paperNumber : "" });
      if (!result.ok) {
        return applyActionError(form, result.error, { paperNumber: "Ya hay una boleta con ese número." });
      }
      setOpen(false);
      toast.success(`Boleta N.º ${result.data.number} confirmada`);
      router.refresh();
    }),
  );
  // Errors about the note itself (a closed campaign, cash terms) come back for fields not in this form.
  const noteError = errors.noteDate ?? errors.paymentTerms ?? errors.root;

  return (
    <>
      <Button type="button" size="sm" onClick={() => setOpen(true)}>
        Confirmar
      </Button>
      <AlertDialog open={open} onOpenChange={(next) => !isWorking && setOpen(next)}>
        <AlertDialogContent>
          <form onSubmit={submit} noValidate className="flex flex-col gap-4">
            <AlertDialogHeader>
              <AlertDialogTitle>¿Confirmar la boleta?</AlertDialogTitle>
              <AlertDialogDescription>
                {Number(total) > 0
                  ? `Se carga US$ ${formatMoney(total)} a la deuda del cliente y la boleta ya no se puede editar; solo anular.`
                  : "Solo tiene bonificaciones o muestras: no genera deuda. Ya no se podrá editar; solo anular."}
              </AlertDialogDescription>
            </AlertDialogHeader>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isPaper}
                onChange={(event) => setIsPaper(event.target.checked)}
                className="size-4"
              />
              Es una boleta de papel con número impreso
            </label>
            {isPaper ? (
              <Field data-invalid={!!errors.paperNumber}>
                <FieldLabel htmlFor="paperNumber">Número impreso</FieldLabel>
                <Input
                  id="paperNumber"
                  inputMode="numeric"
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
}

export function VoidNoteButton({ noteId, number }: { noteId: string; number: number }) {
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
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
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
}

export function NextNumberForm({ nextNumber }: { nextNumber: number }) {
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
          className="underline underline-offset-2 hover:text-foreground"
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
}
