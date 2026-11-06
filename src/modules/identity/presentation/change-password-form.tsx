"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { KeyRoundIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { applyActionError } from "@/shared/presentation/form-errors";
import { Button } from "@/shared/presentation/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/shared/presentation/ui/field";
import { Input } from "@/shared/presentation/ui/input";
import { changeOwnPasswordSchema, type ChangeOwnPasswordInput } from "../application/user-schemas";
import { MIN_PASSWORD_LENGTH } from "../domain/user-account";
import { HOME_PATH } from "./identity-routes";
import { changeOwnPasswordAction } from "./user-actions";
import { resetOnLeave } from "@/shared/presentation/reset-on-leave";

const EMPTY: ChangeOwnPasswordInput = { currentPassword: "", newPassword: "", confirmation: "" };

export const ChangePasswordForm = resetOnLeave(function ChangePasswordForm() {
  const router = useRouter();
  const [isSaving, startSaving] = useTransition();
  const form = useForm({ resolver: zodResolver(changeOwnPasswordSchema), defaultValues: EMPTY });
  const { errors } = form.formState;

  const submit = form.handleSubmit((values) =>
    startSaving(async () => {
      const result = await changeOwnPasswordAction(values);
      if (!result.ok) {
        if (result.error.code === "INVALID_CREDENTIALS") {
          form.setError(
            "currentPassword",
            { message: "La contraseña actual no es correcta." },
            { shouldFocus: true },
          );
          return;
        }
        applyActionError(form, result.error);
        return;
      }
      toast.success("Contraseña actualizada");
      // No router.refresh(): it would re-render this page, which still sees the old flag
      // until the navigation lands. The action already invalidated the cached routes.
      router.replace(HOME_PATH);
    }),
  );

  return (
    <form
      onSubmit={submit}
      noValidate
      className="flex max-w-md flex-col gap-5 rounded-xl border bg-card p-5 shadow-xs"
    >
      <FieldGroup className="gap-4">
        <Field data-invalid={!!errors.currentPassword}>
          <FieldLabel htmlFor="currentPassword">Contraseña actual</FieldLabel>
          <Input
            id="currentPassword"
            type="password"
            autoComplete="current-password"
            autoFocus
            aria-invalid={!!errors.currentPassword}
            {...form.register("currentPassword")}
          />
          <FieldError errors={[errors.currentPassword]} />
        </Field>
        <Field data-invalid={!!errors.newPassword}>
          <FieldLabel htmlFor="newPassword">Nueva contraseña</FieldLabel>
          <Input
            id="newPassword"
            type="password"
            autoComplete="new-password"
            minLength={MIN_PASSWORD_LENGTH}
            aria-invalid={!!errors.newPassword}
            {...form.register("newPassword")}
          />
          <FieldError errors={[errors.newPassword]} />
        </Field>
        <Field data-invalid={!!errors.confirmation}>
          <FieldLabel htmlFor="confirmation">Repite la nueva contraseña</FieldLabel>
          <Input
            id="confirmation"
            type="password"
            autoComplete="new-password"
            aria-invalid={!!errors.confirmation}
            {...form.register("confirmation")}
          />
          <FieldError errors={[errors.confirmation]} />
        </Field>
      </FieldGroup>

      <FieldError errors={[errors.root]} />

      <Button type="submit" disabled={isSaving} className="self-end">
        <KeyRoundIcon aria-hidden />
        {isSaving ? "Guardando…" : "Cambiar contraseña"}
      </Button>
    </form>
  );
});
