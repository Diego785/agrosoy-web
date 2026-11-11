"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { companyProfileSchema, type CompanyProfileInput } from "@/shared/application/company-profile";
import type { CompanyProfile } from "@/shared/domain/company-profile";
import { updateCompanyProfileAction } from "./company-profile-actions";
import { applyActionError } from "./form-errors";
import { FormSection } from "./form-section";
import { resetOnLeave } from "./reset-on-leave";
import { Button } from "./ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "./ui/field";
import { Input } from "./ui/input";

const FIELDS: { name: keyof CompanyProfileInput; label: string; type?: string }[][] = [
  [
    { name: "brand", label: "Nombre en los documentos" },
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
          Salen en el encabezado de las boletas, los recibos y los estados de cuenta, desde el próximo que se
          imprima.
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
      <FieldError errors={[errors.root]} />
      <div>
        <Button type="submit" disabled={isSaving}>
          {isSaving ? "Guardando…" : "Guardar"}
        </Button>
      </div>
    </form>
  );
});
