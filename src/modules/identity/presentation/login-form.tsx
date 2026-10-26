"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { Button } from "@/shared/presentation/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/shared/presentation/ui/field";
import { Input } from "@/shared/presentation/ui/input";
import { authClient } from "./auth-client";
import { HOME_PATH } from "./identity-routes";

const SIGN_IN_ERRORS: Record<string, string> = {
  BANNED_USER: "Tu usuario está desactivado. Habla con administración.",
  TOO_MANY_REQUESTS: "Demasiados intentos. Espera un minuto y vuelve a probar.",
};
const WRONG_CREDENTIALS = "Usuario o contraseña incorrectos.";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [isSigningIn, startSigningIn] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startSigningIn(async () => {
      setError(undefined);
      const { error: signInError } = await authClient.signIn.username({
        username: String(data.get("username") ?? "").trim(),
        password: String(data.get("password") ?? ""),
      });
      if (signInError) {
        const code = signInError.status === 429 ? "TOO_MANY_REQUESTS" : (signInError.code ?? "");
        setError(SIGN_IN_ERRORS[code] ?? WRONG_CREDENTIALS);
        return;
      }
      router.replace(HOME_PATH);
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-6">
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="username">Usuario</FieldLabel>
          <Input
            id="username"
            name="username"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            required
            autoFocus
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="password">Contraseña</FieldLabel>
          <Input id="password" name="password" type="password" autoComplete="current-password" required />
        </Field>
      </FieldGroup>
      {error && <FieldError>{error}</FieldError>}
      <Button type="submit" disabled={isSigningIn}>
        {isSigningIn ? "Ingresando…" : "Ingresar"}
      </Button>
    </form>
  );
}
