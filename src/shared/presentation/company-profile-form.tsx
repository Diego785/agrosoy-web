"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";
import { companyProfileSchema, type CompanyProfileInput } from "@/shared/application/company-profile";
import { BANK_ACCOUNT_KINDS, type CompanyProfile } from "@/shared/domain/company-profile";
import { BANK_ACCOUNT_CURRENCY_LABELS, BANK_ACCOUNT_KIND_LABELS } from "./bank-accounts";
import { updateCompanyProfileAction } from "./company-profile-actions";
import { applyActionError } from "./form-errors";
import { FormSection } from "./form-section";
import { resetOnLeave } from "./reset-on-leave";
import { Button } from "./ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "./ui/field";
import { Input } from "./ui/input";
import { NativeSelect, NativeSelectOption } from "./ui/native-select";

type TextField = Exclude<keyof CompanyProfileInput, "bankAccounts">;

const FIELDS: { name: TextField; label: string; type?: string }[][] = [
  [
    { name: "brand", label: "Nombre comercial" },
    { name: "legalName", label: "Razón social" },
    { name: "taxId", label: "NIT" },
  ],
  [
    { name: "city", label: "Ciudad" },
    { name: "country", label: "País" },
  ],
  [
    { name: "phone", label: "Teléfono de oficina", type: "tel" },
    { name: "mobile", label: "Celulares", type: "tel" },
    { name: "email", label: "Correo", type: "email" },
  ],
  [
    { name: "website", label: "Página web" },
    { name: "facebook", label: "Facebook" },
  ],
];

/** The company's details printed on notes, receipts and statements (D26). */
export const CompanyProfileForm = resetOnLeave(function CompanyProfileForm({
  profile,
}: {
  profile: CompanyProfile;
}) {
  const router = useRouter();
  const [isSaving, startSaving] = useTransition();
  const form = useForm<CompanyProfileInput>({
    resolver: zodResolver(companyProfileSchema),
    defaultValues: profile,
  });
  const { errors } = form.formState;
  const accounts = useFieldArray({ control: form.control, name: "bankAccounts" });

  const submit = form.handleSubmit((values) =>
    startSaving(async () => {
      const result = await updateCompanyProfileAction(values);
      if (!result.ok) return applyActionError(form, result.error);
      toast.success("Datos de la empresa guardados");
      router.refresh();
    }),
  );

  return (
    <form onSubmit={submit} noValidate className="flex max-w-3xl flex-col gap-6">
      <FormSection title="Datos de la empresa">
        <FieldDescription>
          Salen en las boletas, los recibos y los estados de cuenta, desde el próximo que se imprima.
        </FieldDescription>
        {FIELDS.map((row, index) => (
          <div key={index} className="grid gap-5 sm:grid-cols-3">
            {row.map((field) => (
              <Field key={field.name} data-invalid={!!errors[field.name]}>
                <FieldLabel htmlFor={field.name}>{field.label}</FieldLabel>
                <Input
                  id={field.name}
                  type={field.type}
                  aria-invalid={!!errors[field.name]}
                  {...form.register(field.name)}
                />
                <FieldError errors={[errors[field.name]]} />
              </Field>
            ))}
          </div>
        ))}
      </FormSection>

      <FormSection title="Cuentas para pagar">
        <FieldDescription>
          Salen al pie de los estados de cuenta, a nombre de la razón social y con el NIT de arriba. Una
          cuenta con número en bolivianos y en dólares va en dos filas con el mismo banco.
        </FieldDescription>
        {accounts.fields.map((account, index) => {
          const accountErrors = errors.bankAccounts?.[index];
          return (
            <div
              key={account.id}
              className="grid items-start gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)_5.5rem_minmax(0,2fr)_auto]"
            >
              <Field data-invalid={!!accountErrors?.bank}>
                <FieldLabel htmlFor={`bank-${index}`}>Banco</FieldLabel>
                <Input
                  id={`bank-${index}`}
                  placeholder="Banco BISA S.A."
                  aria-invalid={!!accountErrors?.bank}
                  {...form.register(`bankAccounts.${index}.bank`)}
                />
                <FieldError errors={[accountErrors?.bank]} />
              </Field>
              <Field>
                <FieldLabel htmlFor={`kind-${index}`}>Tipo</FieldLabel>
                <NativeSelect id={`kind-${index}`} {...form.register(`bankAccounts.${index}.kind`)}>
                  {BANK_ACCOUNT_KINDS.map((kind) => (
                    <NativeSelectOption key={kind} value={kind}>
                      {BANK_ACCOUNT_KIND_LABELS[kind]}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
              <Field>
                <FieldLabel htmlFor={`currency-${index}`}>Moneda</FieldLabel>
                <NativeSelect id={`currency-${index}`} {...form.register(`bankAccounts.${index}.currency`)}>
                  <NativeSelectOption value="BOB">{BANK_ACCOUNT_CURRENCY_LABELS.BOB}</NativeSelectOption>
                  <NativeSelectOption value="USD">{BANK_ACCOUNT_CURRENCY_LABELS.USD}</NativeSelectOption>
                </NativeSelect>
              </Field>
              <Field data-invalid={!!accountErrors?.number}>
                <FieldLabel htmlFor={`number-${index}`}>Número de cuenta</FieldLabel>
                <Input
                  id={`number-${index}`}
                  inputMode="numeric"
                  aria-invalid={!!accountErrors?.number}
                  {...form.register(`bankAccounts.${index}.number`)}
                />
                <FieldError errors={[accountErrors?.number]} />
              </Field>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="sm:mt-6"
                aria-label={`Quitar la cuenta ${index + 1}`}
                onClick={() => accounts.remove(index)}
              >
                <Trash2Icon aria-hidden />
              </Button>
            </div>
          );
        })}
        <div>
          <Button
            type="button"
            variant="outline"
            disabled={accounts.fields.length >= 10}
            onClick={() => accounts.append({ bank: "", kind: "checking", currency: "BOB", number: "" })}
          >
            <PlusIcon aria-hidden /> Agregar cuenta
          </Button>
        </div>
      </FormSection>
      <FieldError errors={[errors.root]} />
      <div>
        <Button type="submit" disabled={isSaving}>
          {isSaving ? "Guardando…" : "Guardar"}
        </Button>
      </div>
    </form>
  );
});
