"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { formatCustomerCode } from "@/modules/customers/domain/customer";
import { DateInput } from "@/shared/presentation/date-input";
import { applyActionError } from "@/shared/presentation/form-errors";
import { FormSection } from "@/shared/presentation/form-section";
import { resetOnLeave } from "@/shared/presentation/reset-on-leave";
import { Button, buttonVariants } from "@/shared/presentation/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/shared/presentation/ui/field";
import { Input } from "@/shared/presentation/ui/input";
import { NativeSelect, NativeSelectOption } from "@/shared/presentation/ui/native-select";
import { Textarea } from "@/shared/presentation/ui/textarea";
import { openingBalanceSchema, type OpeningBalanceInput } from "../application/collection-schemas";
import { recordOpeningBalanceAction } from "./collection-actions";
import { OPENING_BALANCES_PATH } from "./collection-routes";

/**
 * Debt a customer carries in when the system starts, without its notes and payments (D29): what
 * they owe in one campaign, as of the cut-off date.
 */
export const OpeningBalanceForm = resetOnLeave(function OpeningBalanceForm({
  customers,
  campaigns,
  today,
}: {
  customers: { id: string; code: number; name: string }[];
  /** Every campaign, closed ones included: old debt is what this is for. */
  campaigns: { id: string; label: string }[];
  today: string;
}) {
  const router = useRouter();
  const [isSaving, startSaving] = useTransition();
  const form = useForm({
    resolver: zodResolver(openingBalanceSchema),
    defaultValues: {
      customerId: "",
      campaignId: "",
      balanceDate: today,
      amount: "",
      direction: "owes",
      note: "",
    } satisfies OpeningBalanceInput,
  });
  const { errors } = form.formState;

  const submit = form.handleSubmit((values) =>
    startSaving(async () => {
      const result = await recordOpeningBalanceAction(values);
      if (!result.ok) return applyActionError(form, result.error);
      toast.success("Saldo inicial registrado");
      router.push(OPENING_BALANCES_PATH);
    }),
  );

  return (
    <form onSubmit={submit} noValidate className="flex max-w-3xl flex-col gap-6">
      <FormSection title="Saldo inicial">
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
          <Field data-invalid={!!errors.balanceDate}>
            <FieldLabel htmlFor="balanceDate">Al día</FieldLabel>
            <Controller
              control={form.control}
              name="balanceDate"
              render={({ field }) => <DateInput id="balanceDate" invalid={!!errors.balanceDate} {...field} />}
            />
            <FieldDescription>La fecha de corte: desde ahí, todo se registra en el sistema.</FieldDescription>
            <FieldError errors={[errors.balanceDate]} />
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
          <Field>
            <FieldLabel htmlFor="direction">El cliente</FieldLabel>
            <NativeSelect id="direction" {...form.register("direction")}>
              <NativeSelectOption value="owes">Debe ese monto</NativeSelectOption>
              <NativeSelectOption value="in_favor">Tiene ese monto a favor</NativeSelectOption>
            </NativeSelect>
          </Field>
        </div>
        <Field data-invalid={!!errors.note}>
          <FieldLabel htmlFor="note">Nota (opcional)</FieldLabel>
          <Textarea
            id="note"
            placeholder="Por ejemplo: deuda según la planilla de Favio al 30/09/2026"
            aria-invalid={!!errors.note}
            {...form.register("note")}
          />
          <FieldError errors={[errors.note]} />
        </Field>
      </FormSection>
      <FieldError errors={[errors.root]} />
      <div className="flex gap-2">
        <Button type="submit" disabled={isSaving}>
          Registrar saldo inicial
        </Button>
        <Link href={OPENING_BALANCES_PATH} className={buttonVariants({ variant: "ghost" })}>
          Cancelar
        </Link>
      </div>
    </form>
  );
});
