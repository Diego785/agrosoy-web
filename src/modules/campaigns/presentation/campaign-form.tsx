"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useTransition } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { DateInput } from "@/shared/presentation/date-input";
import { applyActionError } from "@/shared/presentation/form-errors";
import { resetOnLeave } from "@/shared/presentation/reset-on-leave";
import { Button, buttonVariants } from "@/shared/presentation/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/shared/presentation/ui/field";
import { Input } from "@/shared/presentation/ui/input";
import { NativeSelect, NativeSelectOption } from "@/shared/presentation/ui/native-select";
import type { Campaign } from "../application/campaign-ports";
import { campaignSchema, type CampaignInput } from "../application/campaign-schemas";
import { SEASONS, defaultDueOn } from "../domain/campaign";
import { createCampaignAction, updateCampaignAction } from "./campaign-actions";
import { SEASON_LABELS } from "./campaign-labels";
import { CAMPAIGNS_PATH } from "./campaign-routes";

export const CampaignForm = resetOnLeave(function CampaignForm({ campaign }: { campaign?: Campaign }) {
  const router = useRouter();
  const [isSaving, startSaving] = useTransition();
  const form = useForm({
    resolver: zodResolver(campaignSchema),
    defaultValues: {
      season: campaign?.season ?? "summer",
      year: campaign?.year ?? new Date().getFullYear(),
      startsOn: campaign?.startsOn ?? "",
      endsOn: campaign?.endsOn ?? "",
      dueOn: campaign?.dueOn ?? "",
    } satisfies CampaignInput,
  });
  const { errors } = form.formState;
  const [season, endsOn] = useWatch({ control: form.control, name: ["season", "endsOn"] });

  // A new campaign's due date follows its season and end until someone writes another (D37).
  useEffect(() => {
    if (campaign || form.getFieldState("dueOn").isDirty) return;
    if (/^\d{4}-\d{2}-\d{2}$/.test(endsOn)) form.setValue("dueOn", defaultDueOn(season, endsOn));
  }, [campaign, form, season, endsOn]);

  const submit = form.handleSubmit((values) =>
    startSaving(async () => {
      const result = campaign
        ? await updateCampaignAction(campaign.id, values)
        : await createCampaignAction(values);
      if (!result.ok) {
        applyActionError(form, result.error, { year: "Ya existe una campaña de esa temporada en ese año." });
        return;
      }
      toast.success(campaign ? "Campaña actualizada" : "Campaña creada");
      router.push(CAMPAIGNS_PATH);
    }),
  );

  return (
    <form
      onSubmit={submit}
      noValidate
      className="flex max-w-xl flex-col divide-y overflow-hidden rounded-xl border bg-card shadow-xs"
    >
      <FieldGroup className="gap-4 p-5">
        <h3 className="text-sm font-semibold">Temporada</h3>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field data-invalid={!!errors.season}>
            <FieldLabel htmlFor="season">Temporada</FieldLabel>
            <NativeSelect id="season" {...form.register("season")}>
              {SEASONS.map((season) => (
                <NativeSelectOption key={season} value={season}>
                  {SEASON_LABELS[season]}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <FieldError errors={[errors.season]} />
          </Field>
          <Field data-invalid={!!errors.year}>
            <FieldLabel htmlFor="year">Año en que empieza</FieldLabel>
            <Input
              id="year"
              inputMode="numeric"
              selectOnFocus
              aria-invalid={!!errors.year}
              {...form.register("year")}
            />
            <FieldError errors={[errors.year]} />
          </Field>
        </div>
      </FieldGroup>
      <FieldGroup className="gap-4 p-5">
        <h3 className="text-sm font-semibold">Fechas</h3>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field data-invalid={!!errors.startsOn}>
            <FieldLabel htmlFor="startsOn">Desde</FieldLabel>
            <Controller
              control={form.control}
              name="startsOn"
              render={({ field }) => <DateInput id="startsOn" invalid={!!errors.startsOn} {...field} />}
            />
            <FieldError errors={[errors.startsOn]} />
          </Field>
          <Field data-invalid={!!errors.endsOn}>
            <FieldLabel htmlFor="endsOn">Hasta</FieldLabel>
            <Controller
              control={form.control}
              name="endsOn"
              render={({ field }) => <DateInput id="endsOn" invalid={!!errors.endsOn} {...field} />}
            />
            <FieldError errors={[errors.endsOn]} />
          </Field>
        </div>
        <FieldDescription>Las ventas con fecha en este período son de esta campaña.</FieldDescription>
      </FieldGroup>
      <FieldGroup className="gap-4 p-5">
        <h3 className="text-sm font-semibold">Cobro</h3>
        <Field data-invalid={!!errors.dueOn} className="sm:max-w-[calc(50%-0.625rem)]">
          <FieldLabel htmlFor="dueOn">Vence la deuda el</FieldLabel>
          <Controller
            control={form.control}
            name="dueOn"
            render={({ field }) => (
              <DateInput id="dueOn" invalid={!!errors.dueOn} {...field} value={field.value ?? ""} />
            )}
          />
          <FieldDescription>
            Invierno: 30 de noviembre; verano: 31 de mayo del año siguiente. Después, lo que se deba queda
            como vencido. A un cliente se le puede dar más plazo desde su estado de cuenta.
          </FieldDescription>
          <FieldError errors={[errors.dueOn]} />
        </Field>
      </FieldGroup>
      <div className="flex flex-col gap-3 bg-muted/30 px-5 py-4">
        <FieldError errors={[errors.root]} />
        <div className="flex gap-3">
          <Button type="submit" disabled={isSaving}>
            {isSaving ? "Guardando…" : campaign ? "Guardar cambios" : "Crear campaña"}
          </Button>
          <Link href={CAMPAIGNS_PATH} className={buttonVariants({ variant: "ghost" })}>
            Cancelar
          </Link>
        </div>
      </div>
    </form>
  );
});
