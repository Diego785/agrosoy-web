"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeftIcon, UserPlusIcon } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { ROLES } from "@/shared/domain/role";
import { applyActionError } from "@/shared/presentation/form-errors";
import { ROLE_LABELS } from "@/shared/presentation/role-labels";
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
import { createUserSchema, type CreateUserInput } from "../application/user-schemas";
import { normalizeUsername } from "../domain/user-account";
import { TemporaryPasswordNotice } from "./temporary-password-notice";
import type { WorkZoneOption } from "./edit-user";
import { createUserAction } from "./user-actions";
import { USERS_PATH } from "./identity-routes";
import { resetOnLeave } from "@/shared/presentation/reset-on-leave";

const EMPTY: CreateUserInput = {
  name: "",
  username: "",
  email: "",
  role: "sales_technician",
  position: "",
  documentId: "",
  workZoneId: "",
};

const DUPLICATE_MESSAGES = {
  username: "Ese usuario ya existe. Prueba con otro, por ejemplo agregando la inicial del apellido.",
  email: "Ese correo ya pertenece a otro usuario.",
};

export const CreateUserForm = resetOnLeave(function CreateUserForm({ zones }: { zones: WorkZoneOption[] }) {
  const [created, setCreated] = useState<{ username: string; password: string }>();
  const [isSaving, startSaving] = useTransition();
  const form = useForm({ resolver: zodResolver(createUserSchema), defaultValues: EMPTY });
  const { errors } = form.formState;
  const isTechnician = useWatch({ control: form.control, name: "role" }) === "sales_technician";

  const submit = form.handleSubmit((values) =>
    startSaving(async () => {
      const result = await createUserAction(values);
      if (!result.ok) {
        applyActionError(form, result.error, DUPLICATE_MESSAGES);
        return;
      }
      setCreated({ username: normalizeUsername(values.username), password: result.data.temporaryPassword });
    }),
  );

  if (created) {
    return (
      <div className="flex max-w-xl flex-col gap-4">
        <TemporaryPasswordNotice username={created.username} password={created.password} />
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => {
              form.reset(EMPTY);
              setCreated(undefined);
            }}
          >
            <UserPlusIcon aria-hidden />
            Crear otro usuario
          </Button>
          <Link href={USERS_PATH} className={buttonVariants({ variant: "ghost" })}>
            <ArrowLeftIcon aria-hidden />
            Volver a usuarios
          </Link>
        </div>
      </div>
    );
  }

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
            <Input id="name" autoFocus aria-invalid={!!errors.name} {...form.register("name")} />
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
          <Field data-invalid={!!errors.email}>
            <FieldLabel htmlFor="email">Correo (opcional)</FieldLabel>
            <Input id="email" type="email" aria-invalid={!!errors.email} {...form.register("email")} />
            <FieldDescription>Para recibir avisos del sistema.</FieldDescription>
            <FieldError errors={[errors.email]} />
          </Field>
        </FieldGroup>
      </FieldSet>

      <FieldSet className="gap-4 border-t p-5">
        <FieldLegend variant="label" className="mb-0 font-semibold">
          Acceso al sistema
        </FieldLegend>
        <FieldGroup className="gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field data-invalid={!!errors.username}>
              <FieldLabel htmlFor="username">Usuario</FieldLabel>
              <Input
                id="username"
                autoCapitalize="none"
                autoCorrect="off"
                aria-invalid={!!errors.username}
                {...form.register("username")}
              />
              <FieldDescription>Con esto ingresa al sistema, por ejemplo fanez.</FieldDescription>
              <FieldError errors={[errors.username]} />
            </Field>
            <Field data-invalid={!!errors.role}>
              <FieldLabel htmlFor="role">Rol</FieldLabel>
              <NativeSelect id="role" aria-invalid={!!errors.role} {...form.register("role")}>
                {ROLES.map((role) => (
                  <NativeSelectOption key={role} value={role}>
                    {ROLE_LABELS[role]}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              <FieldError errors={[errors.role]} />
            </Field>
          </div>
          {isTechnician && (
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
          )}
        </FieldGroup>
      </FieldSet>

      <div className="flex flex-col gap-3 border-t bg-muted/40 px-5 py-4">
        <FieldError errors={[errors.root]} />
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Link href={USERS_PATH} className={buttonVariants({ variant: "ghost" })}>
            Cancelar
          </Link>
          <Button type="submit" disabled={isSaving}>
            <UserPlusIcon aria-hidden />
            {isSaving ? "Creando…" : "Crear usuario"}
          </Button>
        </div>
      </div>
    </form>
  );
});
