"use client";

import { CopyIcon } from "lucide-react";
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
    <div className="flex flex-col gap-3 rounded-lg border bg-muted/40 p-4">
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-muted-foreground">Usuario</dt>
        <dd className="font-mono">{username}</dd>
        <dt className="text-muted-foreground">Contraseña temporal</dt>
        <dd className="font-mono text-base font-semibold tracking-wide">{password}</dd>
      </dl>
      <p className="text-sm text-muted-foreground">
        Entrégale estos datos. Al ingresar por primera vez tendrá que elegir su propia contraseña. Esta
        contraseña no se vuelve a mostrar.
      </p>
      <Button type="button" variant="outline" size="sm" className="self-start" onClick={copy}>
        <CopyIcon aria-hidden /> Copiar
      </Button>
    </div>
  );
}
