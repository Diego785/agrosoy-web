"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { formatCustomerCode } from "@/modules/customers/domain/customer";
import { ExchangeRate } from "@/shared/domain/exchange-rate";
import { Money } from "@/shared/domain/money";
import { applyActionError } from "@/shared/presentation/form-errors";
import { formatDate, formatMoney, trimDecimalZeros } from "@/shared/presentation/format";
import { Button, buttonVariants } from "@/shared/presentation/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/shared/presentation/ui/field";
import { Input } from "@/shared/presentation/ui/input";
import { NativeSelect, NativeSelectOption } from "@/shared/presentation/ui/native-select";
import { Textarea } from "@/shared/presentation/ui/textarea";
import { paymentSchema, type PaymentInput } from "../application/collection-schemas";
import { PAYMENT_METHODS } from "../domain/payment";
import { recordPaymentAction } from "./collection-actions";
import { CURRENCY_LABELS, METHOD_LABELS } from "./collection-labels";
import { NEW_PAYMENT_PATH, PAYMENTS_PATH, newPaymentPath, paymentPath } from "./collection-routes";
import { DateInput } from "@/shared/presentation/date-input";
import { FormSection } from "@/shared/presentation/form-section";
import { resetOnLeave } from "@/shared/presentation/reset-on-leave";

export type PaymentFormProps = {
  customers: { id: string; code: number; name: string }[];
  /** The chosen customer, with what they owe; null until one is chosen. */
  customer: {
    id: string;
    fixedExchangeRate: string | null;
    balances: { campaignId: string; label: string; balance: string }[];
    notes: { id: string; number: number | null; noteDate: string; total: string }[];
  } | null;
  campaigns: { id: string; label: string }[];
  today: string;
  /** The day's rate, if administration recorded it. */
  todayRate: string | null;
};

export const PaymentForm = resetOnLeave(function PaymentForm({
  customers,
  customer,
  campaigns,
  today,
  todayRate,
}: PaymentFormProps) {
  const router = useRouter();
  const [isSaving, startSaving] = useTransition();
  const suggestedRate = customer?.fixedExchangeRate ?? todayRate;
  const form = useForm({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      customerId: customer?.id ?? "",
      paymentDate: today,
      amount: "",
      exchangeRate: suggestedRate ? trimDecimalZeros(suggestedRate) : "",
      currency: "USD",
      method: "transfer",
      inKindDescription: "",
      reference: "",
      target: "oldest_debt",
      campaignId: "",
      noteId: "",
      observations: "",
    } satisfies PaymentInput,
  });
  const { errors } = form.formState;
  const [currency, amount, exchangeRate, method, target] = useWatch({
    control: form.control,
    name: ["currency", "amount", "exchangeRate", "method", "target"],
  });

  const submit = form.handleSubmit((values) =>
    startSaving(async () => {
      const result = await recordPaymentAction(values);
      if (!result.ok) return applyActionError(form, result.error);
      toast.success(`Recibo N.º ${result.data.receiptNumber} registrado`);
      router.push(paymentPath(result.data.id));
    }),
  );

  return (
    <form onSubmit={submit} noValidate className="flex max-w-4xl flex-col gap-6">
      <FormSection title="Cliente">
        <Field data-invalid={!!errors.customerId}>
          <FieldLabel htmlFor="customerId">Cliente</FieldLabel>
          <NativeSelect
            id="customerId"
            value={customer?.id ?? ""}
            aria-invalid={!!errors.customerId}
            onChange={(event) =>
              router.push(event.target.value ? newPaymentPath(event.target.value) : NEW_PAYMENT_PATH)
            }
          >
            <NativeSelectOption value="">Elegir cliente…</NativeSelectOption>
            {customers.map((option) => (
              <NativeSelectOption key={option.id} value={option.id}>
                {formatCustomerCode(option.code)} · {option.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <FieldError errors={[errors.customerId]} />
        </Field>

        {customer && <Balances balances={customer.balances} />}
      </FormSection>

      {customer && (
        <>
          <FormSection title="Pago">
            <div className="grid gap-5 sm:grid-cols-3">
              <Field data-invalid={!!errors.paymentDate}>
                <FieldLabel htmlFor="paymentDate">Fecha</FieldLabel>
                <Controller
                  control={form.control}
                  name="paymentDate"
                  render={({ field }) => (
                    <DateInput id="paymentDate" invalid={!!errors.paymentDate} {...field} />
                  )}
                />
                <FieldError errors={[errors.paymentDate]} />
              </Field>
              <Field>
                <FieldLabel htmlFor="currency">Moneda</FieldLabel>
                <NativeSelect id="currency" {...form.register("currency")}>
                  <NativeSelectOption value="USD">{CURRENCY_LABELS.USD}</NativeSelectOption>
                  <NativeSelectOption value="BOB">{CURRENCY_LABELS.BOB}</NativeSelectOption>
                </NativeSelect>
              </Field>
              <Field data-invalid={!!errors.amount}>
                <FieldLabel htmlFor="amount">Monto ({currency === "USD" ? "US$" : "Bs"})</FieldLabel>
                <Input
                  id="amount"
                  inputMode="decimal"
                  selectOnFocus
                  aria-invalid={!!errors.amount}
                  {...form.register("amount")}
                />
                <FieldError errors={[errors.amount]} />
              </Field>
              <Field data-invalid={!!errors.exchangeRate}>
                <FieldLabel htmlFor="exchangeRate">Tipo de cambio (Bs por US$)</FieldLabel>
                <Input
                  id="exchangeRate"
                  inputMode="decimal"
                  selectOnFocus
                  aria-invalid={!!errors.exchangeRate}
                  {...form.register("exchangeRate")}
                />
                <FieldDescription>
                  {customer.fixedExchangeRate
                    ? "Tipo de cambio fijo del cliente."
                    : todayRate
                      ? "Tipo de cambio del día."
                      : "Todavía no se registró el tipo de cambio de hoy."}
                </FieldDescription>
                <FieldError errors={[errors.exchangeRate]} />
              </Field>
              <Field>
                <FieldLabel htmlFor="method">Forma de pago</FieldLabel>
                <NativeSelect id="method" {...form.register("method")}>
                  {PAYMENT_METHODS.map((option) => (
                    <NativeSelectOption key={option} value={option}>
                      {METHOD_LABELS[option]}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
              <Field data-invalid={!!errors.reference}>
                <FieldLabel htmlFor="reference">Referencia (opcional)</FieldLabel>
                <Input
                  id="reference"
                  placeholder="N.º de transferencia o depósito"
                  {...form.register("reference")}
                />
                <FieldError errors={[errors.reference]} />
              </Field>
            </div>
            {method === "in_kind" && (
              <Field data-invalid={!!errors.inKindDescription}>
                <FieldLabel htmlFor="inKindDescription">Qué entregó y valor acordado</FieldLabel>
                <Input
                  id="inKindDescription"
                  placeholder="Por ejemplo: 10 t de soya a US$ 300 la tonelada"
                  aria-invalid={!!errors.inKindDescription}
                  {...form.register("inKindDescription")}
                />
                <FieldError errors={[errors.inKindDescription]} />
              </Field>
            )}
            <dl className="flex flex-wrap items-baseline justify-end gap-x-3 gap-y-1 border-t pt-4 text-sm">
              <dt className="text-muted-foreground">
                Baja la deuda en{currency === "BOB" && " (Bs ÷ tipo de cambio)"}
              </dt>
              <dd className="text-xl font-semibold tracking-tight tabular-nums">
                US$ {formatMoney(usdValue(currency, amount, exchangeRate) ?? "0")}
              </dd>
            </dl>
          </FormSection>

          <FormSection title="Aplicar a">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                value="oldest_debt"
                className="size-4 accent-primary"
                {...form.register("target")}
              />
              La deuda más antigua primero
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                value="campaign"
                className="size-4 accent-primary"
                {...form.register("target")}
              />
              Una campaña
            </label>
            {target === "campaign" && (
              <Field data-invalid={!!errors.campaignId} className="ml-6 max-w-sm">
                <NativeSelect
                  aria-label="Campaña"
                  aria-invalid={!!errors.campaignId}
                  {...form.register("campaignId")}
                >
                  <NativeSelectOption value="">Elegir campaña…</NativeSelectOption>
                  {campaigns.map((campaign) => (
                    <NativeSelectOption key={campaign.id} value={campaign.id}>
                      {campaign.label}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
                <FieldError errors={[errors.campaignId]} />
              </Field>
            )}
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                value="note"
                className="size-4 accent-primary"
                disabled={customer.notes.length === 0}
                {...form.register("target")}
              />
              Una boleta
              {customer.notes.length === 0 && (
                <span className="text-muted-foreground">(no tiene boletas confirmadas)</span>
              )}
            </label>
            {target === "note" && (
              <Field data-invalid={!!errors.noteId} className="ml-6 max-w-sm">
                <NativeSelect aria-label="Boleta" aria-invalid={!!errors.noteId} {...form.register("noteId")}>
                  <NativeSelectOption value="">Elegir boleta…</NativeSelectOption>
                  {customer.notes.map((note) => (
                    <NativeSelectOption key={note.id} value={note.id}>
                      N.º {note.number} · {formatDate(note.noteDate)} · US$ {formatMoney(note.total)}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
                <FieldError errors={[errors.noteId]} />
              </Field>
            )}
          </FormSection>

          <FormSection title="Observaciones">
            <Field data-invalid={!!errors.observations}>
              <FieldLabel htmlFor="observations">Observaciones (opcional)</FieldLabel>
              <Textarea id="observations" {...form.register("observations")} />
              <FieldError errors={[errors.observations]} />
            </Field>
          </FormSection>

          <FieldError errors={[errors.root]} />
          <div className="flex gap-2">
            <Button type="submit" disabled={isSaving}>
              Registrar pago
            </Button>
            <Link href={PAYMENTS_PATH} className={buttonVariants({ variant: "ghost" })}>
              Cancelar
            </Link>
          </div>
        </>
      )}
    </form>
  );
});

function Balances({ balances }: { balances: NonNullable<PaymentFormProps["customer"]>["balances"] }) {
  const owing = balances.filter((row) => Number(row.balance) !== 0);
  if (owing.length === 0) return <p className="text-sm text-muted-foreground">No tiene deuda registrada.</p>;
  return (
    <dl className="flex flex-wrap gap-3 text-sm">
      {owing.map((row) => (
        <div key={row.campaignId} className="rounded-lg border border-warning/40 bg-warning/8 px-3 py-2">
          <dt className="text-xs text-muted-foreground">Debe en {row.label}</dt>
          <dd className="font-semibold tabular-nums">US$ {formatMoney(row.balance)}</dd>
        </div>
      ))}
    </dl>
  );
}

/** The payment's value in dollars while typing; null until amount and rate are readable. */
function usdValue(currency: string, amount: string, rate: string): string | null {
  try {
    const money = Money.parse(amount.replace(",", "."), currency === "BOB" ? "BOB" : "USD");
    if (money.currency === "USD") return money.toDecimalString();
    return ExchangeRate.parse(rate.replace(",", ".")).toUsd(money).toDecimalString();
  } catch {
    return null;
  }
}
