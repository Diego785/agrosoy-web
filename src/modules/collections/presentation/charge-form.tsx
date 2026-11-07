"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { formatCustomerCode } from "@/modules/customers/domain/customer";
import { applyActionError } from "@/shared/presentation/form-errors";
import { Button, buttonVariants } from "@/shared/presentation/ui/button";
import { Field, FieldError, FieldLabel } from "@/shared/presentation/ui/field";
import { Input } from "@/shared/presentation/ui/input";
import { NativeSelect, NativeSelectOption } from "@/shared/presentation/ui/native-select";
import { Textarea } from "@/shared/presentation/ui/textarea";
import { chargeSchema, type ChargeInput } from "../application/collection-schemas";
import { CHARGE_CONCEPTS, canLowerDebt, type ChargeConcept } from "../domain/payment";
import { recordChargeAction } from "./collection-actions";
import { CHARGE_CONCEPT_LABELS } from "./collection-labels";
import { CHARGES_PATH } from "./collection-routes";
import { DateInput } from "@/shared/presentation/date-input";
import { FormSection } from "@/shared/presentation/form-section";
import { resetOnLeave } from "@/shared/presentation/reset-on-leave";

export const ChargeForm = resetOnLeave(function ChargeForm({
  customers,
  campaigns,
  today,
  currentCampaignId,
}: {
  customers: { id: string; code: number; name: string }[];
  /** Open campaigns; closed ones take no new charges. */
  campaigns: { id: string; label: string }[];
  today: string;
  currentCampaignId: string | null;
}) {
  const router = useRouter();
  const [isSaving, startSaving] = useTransition();
  const form = useForm({
    resolver: zodResolver(chargeSchema),
    defaultValues: {
      customerId: "",
      campaignId: currentCampaignId ?? "",
      chargeDate: today,
      concept: "interest",
      direction: "debit",
      amount: "",
      reason: "",
    } satisfies ChargeInput,
  });
  const { errors } = form.formState;
  const concept = useWatch({ control: form.control, name: "concept" }) as ChargeConcept;

  const submit = form.handleSubmit((values) =>
    startSaving(async () => {
      // Only an adjustment asks which way it goes; anything else raises the debt.
      const result = await recordChargeAction({
        ...values,
        direction: canLowerDebt(values.concept as ChargeConcept) ? values.direction : "debit",
      });
      if (!result.ok) return applyActionError(form, result.error);
      toast.success("Cargo registrado");
      router.push(CHARGES_PATH);
    }),
  );

  return (
    <form onSubmit={submit} noValidate className="flex max-w-3xl flex-col gap-6">
      <FormSection title="Cargo">
        <Field data-invalid={!!errors.customerId}>
          <FieldLabel htmlFor="customerId">Cliente</FieldLabel>
          <NativeSelect id="customerId" aria-invalid={!!errors.customerId} {...form.register("customerId")}>
            <NativeSelectOption value="">Elegir cliente…</NativeSelectOption>
            {customers.map((option) => (
              <NativeSelectOption key={option.id} value={option.id}>
                {formatCustomerCode(option.code)} · {option.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <FieldError errors={[errors.customerId]} />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field data-invalid={!!errors.concept}>
            <FieldLabel htmlFor="concept">Concepto</FieldLabel>
            <NativeSelect id="concept" aria-invalid={!!errors.concept} {...form.register("concept")}>
              {CHARGE_CONCEPTS.map((option) => (
                <NativeSelectOption key={option} value={option}>
                  {CHARGE_CONCEPT_LABELS[option]}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <FieldError errors={[errors.concept]} />
          </Field>
          {canLowerDebt(concept) && (
            <Field data-invalid={!!errors.direction}>
              <FieldLabel htmlFor="direction">Efecto en la deuda</FieldLabel>
              <NativeSelect id="direction" aria-invalid={!!errors.direction} {...form.register("direction")}>
                <NativeSelectOption value="debit">Sube la deuda</NativeSelectOption>
                <NativeSelectOption value="credit">Baja la deuda</NativeSelectOption>
              </NativeSelect>
              <FieldError errors={[errors.direction]} />
            </Field>
          )}
        </div>
        <div className="grid gap-5 sm:grid-cols-3">
          <Field data-invalid={!!errors.campaignId}>
            <FieldLabel htmlFor="campaignId">Campaña</FieldLabel>
            <NativeSelect id="campaignId" aria-invalid={!!errors.campaignId} {...form.register("campaignId")}>
              <NativeSelectOption value="">Elegir campaña…</NativeSelectOption>
              {campaigns.map((campaign) => (
                <NativeSelectOption key={campaign.id} value={campaign.id}>
                  {campaign.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <FieldError errors={[errors.campaignId]} />
          </Field>
          <Field data-invalid={!!errors.chargeDate}>
            <FieldLabel htmlFor="chargeDate">Fecha</FieldLabel>
            <Controller
              control={form.control}
              name="chargeDate"
              render={({ field }) => <DateInput id="chargeDate" invalid={!!errors.chargeDate} {...field} />}
            />
            <FieldError errors={[errors.chargeDate]} />
          </Field>
          <Field data-invalid={!!errors.amount}>
            <FieldLabel htmlFor="amount">Monto (US$)</FieldLabel>
            <Input
              id="amount"
              inputMode="decimal"
              selectOnFocus
              aria-invalid={!!errors.amount}
              {...form.register("amount")}
            />
            <FieldError errors={[errors.amount]} />
          </Field>
        </div>
        <Field data-invalid={!!errors.reason}>
          <FieldLabel htmlFor="reason">Motivo</FieldLabel>
          <Textarea
            id="reason"
            placeholder="Por ejemplo: mora de 60 días acordada con el cliente"
            aria-invalid={!!errors.reason}
            {...form.register("reason")}
          />
          <FieldError errors={[errors.reason]} />
        </Field>
      </FormSection>
      <FieldError errors={[errors.root]} />
      <div className="flex gap-2">
        <Button type="submit" disabled={isSaving}>
          Registrar cargo
        </Button>
        <Link href={CHARGES_PATH} className={buttonVariants({ variant: "ghost" })}>
          Cancelar
        </Link>
      </div>
    </form>
  );
});
