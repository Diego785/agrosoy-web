"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { SaveIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { applyActionError } from "@/shared/presentation/form-errors";
import { Button, buttonVariants } from "@/shared/presentation/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/shared/presentation/ui/field";
import { Input } from "@/shared/presentation/ui/input";
import { NativeSelect, NativeSelectOption } from "@/shared/presentation/ui/native-select";
import type { UserSummary } from "../application/ports";
import { updateUserSchema } from "../application/user-schemas";
import type { WorkZoneOption } from "./edit-user";
import { USERS_PATH } from "./identity-routes";
import { updateUserAction } from "./user-actions";
import { resetOnLeave } from "@/shared/presentation/reset-on-leave";

export const EditUserForm = resetOnLeave(function EditUserForm({
  user,
  zones,
}: {
  user: UserSummary;
  zones: WorkZoneOption[];
}) {
  const router = useRouter();
  const [isSaving, startSaving] = useTransition();
  const form = useForm({
    resolver: zodResolver(updateUserSchema),
    defaultValues: {
      name: user.name,
      position: user.position ?? "",
      documentId: user.documentId ?? "",
      workZoneId: user.workZoneId ?? "",
    },
  });
  const { errors } = form.formState;

  const submit = form.handleSubmit((values) =>
    startSaving(async () => {
      const result = await updateUserAction(user.id, values);
      if (!result.ok) {
        applyActionError(form, result.error);
        return;
      }
      toast.success("Usuario actualizado");
      router.push(USERS_PATH);
    }),
  );

  return (
    <form
      onSubmit={submit}
      noValidate
      className="flex max-w-2xl flex-col overflow-hidden rounded-xl border bg-card shadow-xs"
    >
      <FieldSet className="gap-4 p-5">
        <FieldLegend variant="label" className="mb-0 font-semibold">
          Datos de la persona
        </FieldLegend>
        <FieldGroup className="gap-4">
          <Field data-invalid={!!errors.name}>
            <FieldLabel htmlFor="name">Nombre completo</FieldLabel>
            <Input id="name" aria-invalid={!!errors.name} {...form.register("name")} />
            <FieldError errors={[errors.name]} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field data-invalid={!!errors.position}>
              <FieldLabel htmlFor="position">Cargo (opcional)</FieldLabel>
              <Input id="position" aria-invalid={!!errors.position} {...form.register("position")} />
              <FieldDescription>
                Se imprime junto a su firma, por ejemplo Ejecutivo de ventas.
              </FieldDescription>
              <FieldError errors={[errors.position]} />
            </Field>
            <Field data-invalid={!!errors.documentId}>
              <FieldLabel htmlFor="documentId">CI (opcional)</FieldLabel>
              <Input id="documentId" aria-invalid={!!errors.documentId} {...form.register("documentId")} />
              <FieldError errors={[errors.documentId]} />
            </Field>
          </div>
        </FieldGroup>
      </FieldSet>

      {user.role === "sales_technician" && (
        <FieldSet className="gap-4 border-t p-5">
          <FieldLegend variant="label" className="mb-0 font-semibold">
            Trabajo
          </FieldLegend>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field data-invalid={!!errors.workZoneId}>
              <FieldLabel htmlFor="workZoneId">Zona de trabajo</FieldLabel>
              <NativeSelect
                id="workZoneId"
                aria-invalid={!!errors.workZoneId}
                {...form.register("workZoneId")}
              >
                <NativeSelectOption value="">Sin zona</NativeSelectOption>
                {zones.map((zone) => (
                  <NativeSelectOption key={zone.id} value={zone.id}>
                    {zone.label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              <FieldDescription>Aparece en sus informes de viáticos.</FieldDescription>
              <FieldError errors={[errors.workZoneId]} />
            </Field>
          </div>
        </FieldSet>
      )}

      <div className="flex flex-col gap-3 border-t bg-muted/40 px-5 py-4">
        <FieldError errors={[errors.root]} />
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Link href={USERS_PATH} className={buttonVariants({ variant: "ghost" })}>
            Cancelar
          </Link>
          <Button type="submit" disabled={isSaving}>
            <SaveIcon aria-hidden />
            {isSaving ? "Guardando…" : "Guardar cambios"}
          </Button>
        </div>
      </div>
    </form>
  );
});
