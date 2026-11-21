"use client";

import { ReceiptTextIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { applyActionError } from "@/shared/presentation/form-errors";
import { formatDate, formatMoney } from "@/shared/presentation/format";
import { resetOnLeave } from "@/shared/presentation/reset-on-leave";
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
import type { InvoiceCandidate } from "../application/note-ports";
import type { NoteInvoiceInput } from "../application/note-schemas";
import { setNoteInvoiceAction } from "./note-actions";

type InvoiceFormValues = Required<NoteInvoiceInput>;

/**
 * Writes the SIN invoice number on a confirmed note, and on the other deliveries of the same customer
 * and campaign that the same invoice covers (D40). Leaving the number empty clears it.
 */
export const NoteInvoiceButton = resetOnLeave(function NoteInvoiceButton({
  noteId,
  current,
  others,
}: {
  noteId: string;
  current: string | null;
  /** The customer's other confirmed deliveries in the note's campaign. */
  others: InvoiceCandidate[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isSaving, startSaving] = useTransition();
  const form = useForm<InvoiceFormValues>({
    defaultValues: { taxInvoiceNumber: current ?? "", alsoNoteIds: [] },
  });
  const { errors } = form.formState;
  const [also, setAlso] = useState<Set<string>>(new Set());

  const toggle = (id: string, checked: boolean) =>
    setAlso((previous) => {
      const next = new Set(previous);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });

  const openDialog = () => {
    form.reset({ taxInvoiceNumber: current ?? "", alsoNoteIds: [] });
    setAlso(new Set());
    setOpen(true);
  };

  const submit = form.handleSubmit((values) =>
    startSaving(async () => {
      const result = await setNoteInvoiceAction(noteId, {
        taxInvoiceNumber: values.taxInvoiceNumber,
        alsoNoteIds: [...also],
      });
      if (!result.ok) return applyActionError(form, result.error);
      setOpen(false);
      const cleared = values.taxInvoiceNumber.trim() === "";
      const count = result.data.updated;
      toast.success(
        count === 0
          ? "No había nada que cambiar"
          : cleared
            ? count === 1
              ? "Factura quitada"
              : `Factura quitada de ${count} boletas`
            : count === 1
              ? "Factura anotada"
              : `Factura anotada en ${count} boletas`,
      );
      router.refresh();
    }),
  );

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={openDialog}>
        <ReceiptTextIcon aria-hidden />
        {current ? "Cambiar factura" : "Anotar factura"}
      </Button>
      <AlertDialog open={open} onOpenChange={(next) => !isSaving && setOpen(next)}>
        <AlertDialogContent>
          <form onSubmit={submit} noValidate className="flex flex-col gap-4">
            <AlertDialogHeader>
              <AlertDialogTitle>Factura del SIN</AlertDialogTitle>
              <AlertDialogDescription>
                Es solo una referencia: no cambia la deuda ni el número de la boleta. Para quitarla, deja el
                número vacío.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <Field data-invalid={!!errors.taxInvoiceNumber}>
              <FieldLabel htmlFor="taxInvoiceNumber">N.º de factura</FieldLabel>
              <Input
                id="taxInvoiceNumber"
                className="max-w-48"
                autoComplete="off"
                aria-invalid={!!errors.taxInvoiceNumber}
                {...form.register("taxInvoiceNumber")}
              />
              <FieldError errors={[errors.taxInvoiceNumber]} />
            </Field>
            {others.length > 0 && (
              <fieldset className="flex flex-col gap-2">
                <legend className="text-sm font-medium">¿Cubre también otras boletas?</legend>
                <FieldDescription>
                  Por ejemplo, la factura de fin de campaña. Solo aparecen las boletas confirmadas de este
                  cliente en la misma campaña.
                </FieldDescription>
                <ul className="flex max-h-56 flex-col gap-1 overflow-y-auto rounded-lg border p-2">
                  {others.map((other) => (
                    <li key={other.id}>
                      <label className="flex items-center gap-2 rounded-md px-1 py-1 text-sm hover:bg-accent">
                        <input
                          type="checkbox"
                          className="size-4 accent-primary"
                          checked={also.has(other.id)}
                          onChange={(event) => toggle(other.id, event.target.checked)}
                        />
                        <span className="font-medium tabular-nums">
                          N.º {other.number ?? "—"}
                          {other.imported && " (de planilla)"}
                        </span>
                        <span className="text-muted-foreground tabular-nums">
                          {formatDate(other.noteDate)} · US$ {formatMoney(other.total)}
                        </span>
                        {other.taxInvoiceNumber && (
                          <span className="ml-auto text-xs text-muted-foreground">
                            Factura {other.taxInvoiceNumber}
                          </span>
                        )}
                      </label>
                    </li>
                  ))}
                </ul>
                <FieldError errors={[errors.alsoNoteIds]} />
              </fieldset>
            )}
            <FieldError errors={[errors.root]} />
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isSaving}>Cancelar</AlertDialogCancel>
              <AlertDialogAction type="submit" disabled={isSaving}>
                Guardar
              </AlertDialogAction>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
});
