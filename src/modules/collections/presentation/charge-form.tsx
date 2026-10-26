"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { formatCustomerCode } from "@/modules/customers/domain/customer";
import { applyActionError } from "@/shared/presentation/form-errors";
import { Button, buttonVariants } from "@/shared/presentation/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/shared/presentation/ui/field";
import { Input } from "@/shared/presentation/ui/input";
import { NativeSelect, NativeSelectOption } from "@/shared/presentation/ui/native-select";
import { Textarea } from "@/shared/presentation/ui/textarea";
import { chargeSchema, type ChargeInput } from "../application/collection-schemas";
import { recordChargeAction } from "./collection-actions";
import { CHARGES_PATH } from "./collection-routes";

export function ChargeForm({
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
      amount: "",
      reason: "",
    } satisfies ChargeInput,
  });
  const { errors } = form.formState;

  const submit = form.handleSubmit((values) =>
    startSaving(async () => {
      const result = await recordChargeAction(values);
      if (!result.ok) return applyActionError(form, result.error);
      toast.success("Cargo registrado");
      router.push(CHARGES_PATH);
    }),
  );

  return (
    <form onSubmit={submit} noValidate className="flex max-w-2xl flex-col gap-6">
      <FieldGroup>
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
            <Input
              id="chargeDate"
              type="date"
              aria-invalid={!!errors.chargeDate}
              {...form.register("chargeDate")}
            />
            <FieldError errors={[errors.chargeDate]} />
          </Field>
          <Field data-invalid={!!errors.amount}>
            <FieldLabel htmlFor="amount">Monto (US$)</FieldLabel>
            <Input
              id="amount"
              inputMode="decimal"
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
            placeholder="Por ejemplo: interés por mora acordado con el cliente"
            aria-invalid={!!errors.reason}
            {...form.register("reason")}
          />
          <FieldError errors={[errors.reason]} />
        </Field>
      </FieldGroup>
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
}
