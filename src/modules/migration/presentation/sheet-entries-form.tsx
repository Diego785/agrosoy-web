"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { applyActionError } from "@/shared/presentation/form-errors";
import { Button } from "@/shared/presentation/ui/button";
import { Field, FieldError, FieldLabel } from "@/shared/presentation/ui/field";
import { Input } from "@/shared/presentation/ui/input";
import { correctSheetEntrySchema, type CorrectSheetEntryInput } from "../application/sheet-entry-schemas";
import { correctSheetEntryAction } from "./conversion-actions";

/** One payment or return the sheet brought in: its new amount and why (D60). */
export function SheetEntryForm({
  batchId,
  entryId,
  amount,
}: {
  batchId: string;
  entryId: string;
  amount: string;
}) {
  const router = useRouter();
  const [isSaving, startSaving] = useTransition();
  const form = useForm({
    resolver: zodResolver(correctSheetEntrySchema),
    defaultValues: {
      batchId,
      entryId,
      amount,
      reason: "",
    } satisfies CorrectSheetEntryInput,
  });
  const { errors } = form.formState;
  const submit = form.handleSubmit((values) =>
    startSaving(async () => {
      const result = await correctSheetEntryAction(values);
      if (!result.ok) return applyActionError(form, result.error);
      toast.success("Corregido");
      router.refresh();
    }),
  );
  return (
    <form onSubmit={submit} noValidate className="flex flex-wrap items-end gap-3">
      <Field data-invalid={!!errors.amount} className="w-36">
        <FieldLabel htmlFor={`amount-${entryId}`}>Monto US$</FieldLabel>
        <Input
          id={`amount-${entryId}`}
          inputMode="decimal"
          className="text-right"
          aria-invalid={!!errors.amount}
          {...form.register("amount")}
        />
      </Field>
      <Field data-invalid={!!errors.reason} className="min-w-56 flex-1">
        <FieldLabel htmlFor={`reason-${entryId}`}>Motivo</FieldLabel>
        <Input
          id={`reason-${entryId}`}
          placeholder="Por qué cambia"
          aria-invalid={!!errors.reason}
          {...form.register("reason")}
        />
      </Field>
      <Button type="submit" variant="outline" disabled={isSaving}>
        Guardar
      </Button>
      <FieldError className="w-full" errors={[errors.amount, errors.reason, errors.root]} />
    </form>
  );
}
