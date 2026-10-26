"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { ROLES } from "@/shared/domain/role";
import { applyActionError } from "@/shared/presentation/form-errors";
import { ROLE_LABELS } from "@/shared/presentation/role-labels";
import { Button, buttonVariants } from "@/shared/presentation/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/shared/presentation/ui/field";
import { Input } from "@/shared/presentation/ui/input";
import { NativeSelect, NativeSelectOption } from "@/shared/presentation/ui/native-select";
import { createUserSchema, type CreateUserInput } from "../application/user-schemas";
import { normalizeUsername } from "../domain/user-account";
import { TemporaryPasswordNotice } from "./temporary-password-notice";
import { createUserAction } from "./user-actions";
import { USERS_PATH } from "./identity-routes";

const EMPTY: CreateUserInput = { name: "", username: "", email: "", role: "sales_technician" };

const DUPLICATE_MESSAGES = {
  username: "Ese usuario ya existe. Prueba con otro, por ejemplo agregando la inicial del apellido.",
  email: "Ese correo ya pertenece a otro usuario.",
};

export function CreateUserForm() {
  const [created, setCreated] = useState<{ username: string; password: string }>();
  const [isSaving, startSaving] = useTransition();
  const form = useForm({ resolver: zodResolver(createUserSchema), defaultValues: EMPTY });
  const { errors } = form.formState;

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
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => {
              form.reset(EMPTY);
              setCreated(undefined);
            }}
          >
            Crear otro usuario
          </Button>
          <Link href={USERS_PATH} className={buttonVariants({ variant: "ghost" })}>
            Volver a usuarios
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="flex max-w-xl flex-col gap-6">
      <FieldGroup>
        <Field data-invalid={!!errors.name}>
          <FieldLabel htmlFor="name">Nombre completo</FieldLabel>
          <Input id="name" autoFocus aria-invalid={!!errors.name} {...form.register("name")} />
          <FieldError errors={[errors.name]} />
        </Field>
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
        <Field data-invalid={!!errors.email}>
          <FieldLabel htmlFor="email">Correo (opcional)</FieldLabel>
          <Input id="email" type="email" aria-invalid={!!errors.email} {...form.register("email")} />
          <FieldDescription>Para recibir avisos del sistema.</FieldDescription>
          <FieldError errors={[errors.email]} />
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
      </FieldGroup>

      <FieldError errors={[errors.root]} />

      <div className="flex gap-3">
        <Button type="submit" disabled={isSaving}>
          {isSaving ? "Creando…" : "Crear usuario"}
        </Button>
        <Link href={USERS_PATH} className={buttonVariants({ variant: "ghost" })}>
          Cancelar
        </Link>
      </div>
    </form>
  );
}
