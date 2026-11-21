"use client";

import { PercentIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { DateInput } from "@/shared/presentation/date-input";
import { applyActionError } from "@/shared/presentation/form-errors";
import { formatDate } from "@/shared/presentation/format";
import { resetOnLeave } from "@/shared/presentation/reset-on-leave";
import { Button } from "@/shared/presentation/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/shared/presentation/ui/field";
import { Input } from "@/shared/presentation/ui/input";
import type { InterestSettingsInput } from "../application/collection-schemas";
import type { InterestSettings } from "../domain/interest";
import { updateInterestSettingsAction } from "./collection-actions";
import { interestRule } from "./collection-labels";

/**
 * The rate, the days after a due date and the first day interest applies (D38). Until that day is
 * saved, nothing is proposed.
 */
export const InterestSettingsForm = resetOnLeave(function InterestSettingsForm({
  settings,
  suggestedStart,
}: {
  settings: InterestSettings;
  /** The next due date from today, offered while no start is saved. */
  suggestedStart: string;
}) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(settings.startsOn === null);
  const [isSaving, startSaving] = useTransition();
  const initial = (): InterestSettingsInput => ({
    ratePercent: settings.ratePercent.replace(".", ","),
    graceDays: String(settings.graceDays),
    startsOn: settings.startsOn ?? suggestedStart,
  });
  const form = useForm<InterestSettingsInput>({ defaultValues: initial() });
  const { errors } = form.formState;

  const submit = form.handleSubmit((values) =>
    startSaving(async () => {
      const result = await updateInterestSettingsAction(values);
      if (!result.ok) return applyActionError(form, result.error);
      toast.success("Interés por mora guardado");
      setIsEditing(false);
      router.refresh();
    }),
  );

  if (!isEditing && settings.startsOn) {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border bg-card px-4 py-3 text-sm shadow-xs">
        <span className="flex size-7 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
          <PercentIcon className="size-4" aria-hidden />
        </span>
        <span className="text-muted-foreground">Interés por mora</span>
        <span className="font-semibold">{interestRule(settings)}</span>
        <span className="text-xs text-muted-foreground tabular-nums">
          desde el {formatDate(settings.startsOn)}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="ml-auto"
          onClick={() => {
            form.reset(initial());
            setIsEditing(true);
          }}
        >
          Cambiar
        </Button>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      noValidate
      className="flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-xs"
    >
      <div>
        <h2 className="text-sm font-semibold">Interés por mora</h2>
        {!settings.startsOn && (
          <p className="mt-1 text-sm text-muted-foreground">
            Elige desde cuándo se cobra. Al terminar cada mes, el sistema propone el interés de quien siga
            debiendo.
          </p>
        )}
      </div>
      <div className="grid gap-5 sm:grid-cols-3">
        <Field data-invalid={!!errors.ratePercent}>
          <FieldLabel htmlFor="ratePercent">Tasa (%)</FieldLabel>
          <Input
            id="ratePercent"
            inputMode="decimal"
            selectOnFocus
            className="max-w-32"
            aria-invalid={!!errors.ratePercent}
            {...form.register("ratePercent")}
          />
          <FieldDescription>La misma para todos los clientes.</FieldDescription>
          <FieldError errors={[errors.ratePercent]} />
        </Field>
        <Field data-invalid={!!errors.graceDays}>
          <FieldLabel htmlFor="graceDays">Días después del vencimiento</FieldLabel>
          <Input
            id="graceDays"
            inputMode="numeric"
            selectOnFocus
            className="max-w-32"
            aria-invalid={!!errors.graceDays}
            {...form.register("graceDays")}
          />
          <FieldDescription>
            Con 30, lo que vence el 30/11 paga desde enero. Con 0, desde diciembre.
          </FieldDescription>
          <FieldError errors={[errors.graceDays]} />
        </Field>
        <Field data-invalid={!!errors.startsOn}>
          <FieldLabel htmlFor="startsOn">Desde</FieldLabel>
          <Controller
            control={form.control}
            name="startsOn"
            render={({ field }) => <DateInput id="startsOn" invalid={!!errors.startsOn} {...field} />}
          />
          <FieldDescription>
            Los meses anteriores no se proponen: las planillas ya traen su interés.
          </FieldDescription>
          <FieldError errors={[errors.startsOn]} />
        </Field>
      </div>
      <FieldError errors={[errors.root]} />
      <div className="flex gap-2">
        <Button type="submit" disabled={isSaving}>
          {isSaving ? "Guardando…" : "Guardar"}
        </Button>
        {settings.startsOn && (
          <Button type="button" variant="ghost" disabled={isSaving} onClick={() => setIsEditing(false)}>
            Cancelar
          </Button>
        )}
      </div>
    </form>
  );
});
