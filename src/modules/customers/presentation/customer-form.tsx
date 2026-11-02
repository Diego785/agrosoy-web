"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition, type ReactNode } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { applyActionError } from "@/shared/presentation/form-errors";
import { trimDecimalZeros } from "@/shared/presentation/format";
import { Button, buttonVariants } from "@/shared/presentation/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/shared/presentation/ui/field";
import { Input } from "@/shared/presentation/ui/input";
import { NativeSelect, NativeSelectOption } from "@/shared/presentation/ui/native-select";
import { Textarea } from "@/shared/presentation/ui/textarea";
import { customerSchema, type CustomerInput } from "../application/customer-schemas";
import type { CustomerFormData, Technician, Zone } from "../application/ports";
import { formatCustomerCode } from "../domain/customer";
import { registerCustomerAction, updateCustomerAction } from "./customer-actions";
import { CUSTOMERS_PATH, customerPath } from "./customer-routes";
import { resetOnLeave } from "@/shared/presentation/reset-on-leave";

type Props = {
  zones: (Zone & { isActive: boolean })[];
  technicians: Technician[];
  /** Present when editing an existing customer. */
  customer?: CustomerFormData;
};

const DUPLICATE_MESSAGES = {
  name: "Ya hay un cliente con ese nombre. Si es otra persona, agrega algo que los distinga, como la localidad.",
};

export const CustomerForm = resetOnLeave(function CustomerForm({ zones, technicians, customer }: Props) {
  const router = useRouter();
  const [isSaving, startSaving] = useTransition();
  const form = useForm({ resolver: zodResolver(customerSchema), defaultValues: initialValues(customer) });
  const { errors } = form.formState;
  const exchangeRateKind = useWatch({ control: form.control, name: "exchangeRateKind" });

  const submit = form.handleSubmit((values) =>
    startSaving(async () => {
      if (customer) {
        const result = await updateCustomerAction(customer.id, values);
        if (!result.ok) return applyActionError(form, result.error, DUPLICATE_MESSAGES);
        toast.success("Cliente actualizado");
        router.push(customerPath(customer.id));
      } else {
        const result = await registerCustomerAction(values);
        if (!result.ok) return applyActionError(form, result.error, DUPLICATE_MESSAGES);
        toast.success(`Cliente registrado con el código ${formatCustomerCode(result.data.code)}`);
        router.push(customerPath(result.data.id));
      }
    }),
  );

  return (
    <form
      onSubmit={submit}
      noValidate
      className="flex max-w-2xl flex-col divide-y overflow-hidden rounded-xl border bg-card shadow-xs"
    >
      <FormSection title="Datos del cliente">
        <Field data-invalid={!!errors.name}>
          <FieldLabel htmlFor="name">Nombre o razón social</FieldLabel>
          <Input id="name" autoFocus={!customer} aria-invalid={!!errors.name} {...form.register("name")} />
          <FieldError errors={[errors.name]} />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field data-invalid={!!errors.taxId}>
            <FieldLabel htmlFor="taxId">NIT o CI (opcional)</FieldLabel>
            <Input id="taxId" aria-invalid={!!errors.taxId} {...form.register("taxId")} />
            <FieldError errors={[errors.taxId]} />
          </Field>
          <Field data-invalid={!!errors.phone}>
            <FieldLabel htmlFor="phone">Teléfono (opcional)</FieldLabel>
            <Input id="phone" type="tel" aria-invalid={!!errors.phone} {...form.register("phone")} />
            <FieldError errors={[errors.phone]} />
          </Field>
        </div>
      </FormSection>

      <FormSection title="Zona y técnico">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field data-invalid={!!errors.zoneId}>
            <FieldLabel htmlFor="zoneId">Zona</FieldLabel>
            <NativeSelect id="zoneId" aria-invalid={!!errors.zoneId} {...form.register("zoneId")}>
              <NativeSelectOption value="">Sin zona</NativeSelectOption>
              {zones.map((zone) => (
                <NativeSelectOption key={zone.id} value={zone.id}>
                  {zone.isActive ? zone.name : `${zone.name} (desactivada)`}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <FieldError errors={[errors.zoneId]} />
          </Field>
          <Field data-invalid={!!errors.technicianId}>
            <FieldLabel htmlFor="technicianId">Técnico de venta</FieldLabel>
            <NativeSelect
              id="technicianId"
              aria-invalid={!!errors.technicianId}
              {...form.register("technicianId")}
            >
              <NativeSelectOption value="">Sin asignar</NativeSelectOption>
              {technicians.map((technician) => (
                <NativeSelectOption key={technician.id} value={technician.id}>
                  {technician.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <FieldError errors={[errors.technicianId]} />
          </Field>
        </div>
      </FormSection>

      <FormSection title="Tipo de cambio">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field data-invalid={!!errors.exchangeRateKind}>
            <FieldLabel htmlFor="exchangeRateKind">Tipo de cambio acordado</FieldLabel>
            <NativeSelect id="exchangeRateKind" {...form.register("exchangeRateKind")}>
              <NativeSelectOption value="daily">Del día del pago</NativeSelectOption>
              <NativeSelectOption value="fixed">Fijo</NativeSelectOption>
            </NativeSelect>
            <FieldError errors={[errors.exchangeRateKind]} />
          </Field>
          {exchangeRateKind === "fixed" && (
            <Field data-invalid={!!errors.fixedExchangeRate}>
              <FieldLabel htmlFor="fixedExchangeRate">Tipo de cambio fijo (Bs por US$)</FieldLabel>
              <Input
                id="fixedExchangeRate"
                inputMode="decimal"
                selectOnFocus
                placeholder="12.00"
                aria-invalid={!!errors.fixedExchangeRate}
                {...form.register("fixedExchangeRate")}
              />
              <FieldError errors={[errors.fixedExchangeRate]} />
            </Field>
          )}
        </div>
      </FormSection>

      <FormSection title="Notas">
        <Field data-invalid={!!errors.notes}>
          <FieldLabel htmlFor="notes">Notas (opcional)</FieldLabel>
          <Textarea id="notes" rows={3} aria-invalid={!!errors.notes} {...form.register("notes")} />
          <FieldDescription>Por ejemplo, dónde se le entrega o con quién coordinar.</FieldDescription>
          <FieldError errors={[errors.notes]} />
        </Field>
      </FormSection>

      <div className="flex flex-col gap-3 bg-muted/30 px-5 py-4">
        <FieldError errors={[errors.root]} />
        <div className="flex gap-3">
          <Button type="submit" disabled={isSaving}>
            {isSaving ? "Guardando…" : customer ? "Guardar cambios" : "Registrar cliente"}
          </Button>
          <Link
            href={customer ? customerPath(customer.id) : CUSTOMERS_PATH}
            className={buttonVariants({ variant: "ghost" })}
          >
            Cancelar
          </Link>
        </div>
      </div>
    </form>
  );
});

function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 p-5">
      <h3 className="text-sm font-semibold">{title}</h3>
      <FieldGroup>{children}</FieldGroup>
    </div>
  );
}

function initialValues(customer: CustomerFormData | undefined): CustomerInput {
  return {
    name: customer?.name ?? "",
    taxId: customer?.taxId ?? "",
    phone: customer?.phone ?? "",
    zoneId: customer?.zoneId ?? "",
    technicianId: customer?.technicianId ?? "",
    exchangeRateKind: customer?.exchangeRateKind ?? "daily",
    // "6.9600" from the database reads better as "6.96".
    fixedExchangeRate: customer?.fixedExchangeRate ? trimDecimalZeros(customer.fixedExchangeRate) : "",
    notes: customer?.notes ?? "",
  };
}
