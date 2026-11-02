"use client";

import { CopyIcon, KeyRoundIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/shared/presentation/ui/button";

/** Shown once after creating a user or resetting a password; the password isn't stored in clear text. */
export function TemporaryPasswordNotice({ username, password }: { username: string; password: string }) {
  async function copy() {
    try {
      await navigator.clipboard.writeText(`Usuario: ${username}\nContraseña temporal: ${password}`);
      toast.success("Datos copiados");
    } catch {
      toast.error("No se pudo copiar; anótalos a mano.");
    }
  }

  return (
    <div className="flex gap-3 rounded-xl border border-warning/30 bg-warning/8 p-4">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-warning/15 text-warning">
        <KeyRoundIcon className="size-4" aria-hidden />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <dl className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2 text-sm">
          <dt className="text-muted-foreground">Usuario</dt>
          <dd className="font-mono font-medium">{username}</dd>
          <dt className="text-muted-foreground">Contraseña temporal</dt>
          <dd>
            <span className="inline-block rounded-md border bg-card px-2 py-0.5 font-mono text-base font-semibold tracking-wide">
              {password}
            </span>
          </dd>
        </dl>
        <p className="text-sm text-muted-foreground">
          Entrégale estos datos. Al ingresar por primera vez tendrá que elegir su propia contraseña. Esta
          contraseña no se vuelve a mostrar.
        </p>
        <Button type="button" variant="outline" size="sm" className="self-start bg-card" onClick={copy}>
          <CopyIcon aria-hidden /> Copiar
        </Button>
      </div>
    </div>
  );
}
