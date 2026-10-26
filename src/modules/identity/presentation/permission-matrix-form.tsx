"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { PERMISSIONS, type Permission } from "@/shared/application/permissions";
import type { Role } from "@/shared/domain/role";
import { errorMessage } from "@/shared/presentation/error-messages";
import { PERMISSION_LABELS } from "@/shared/presentation/permission-labels";
import { ROLE_LABELS } from "@/shared/presentation/role-labels";
import { Button } from "@/shared/presentation/ui/button";
import type { PermissionMatrix } from "../application/permission-use-cases";
import { savePermissionMatrixAction } from "./permission-actions";

export function PermissionMatrixForm({ matrix }: { matrix: PermissionMatrix }) {
  const [granted, setGranted] = useState(
    () => new Map(matrix.map((row) => [row.role, new Set<Permission>(row.permissions)])),
  );
  const [isSaving, startSaving] = useTransition();
  const editable = matrix.filter((row) => row.editable).map((row) => row.role);

  function toggle(role: Role, permission: Permission) {
    setGranted((current) => {
      const next = new Map(current);
      const permissions = new Set(next.get(role));
      if (permissions.has(permission)) permissions.delete(permission);
      else permissions.add(permission);
      next.set(role, permissions);
      return next;
    });
  }

  function save() {
    startSaving(async () => {
      const result = await savePermissionMatrixAction(
        editable.map((role) => ({ role, permissions: [...(granted.get(role) ?? [])] })),
      );
      if (result.ok) toast.success("Permisos guardados");
      else toast.error(errorMessage(result.error));
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b">
              <th className="py-2 pr-4 text-left font-medium">Permiso</th>
              {matrix.map((row) => (
                <th key={row.role} className="px-3 py-2 text-center font-medium">
                  {ROLE_LABELS[row.role]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERMISSIONS.map((permission) => (
              <tr key={permission} className="border-b last:border-0">
                <td className="py-3 pr-4">
                  <span className="font-medium">{PERMISSION_LABELS[permission].label}</span>
                  <span className="block text-xs text-muted-foreground">
                    {PERMISSION_LABELS[permission].description}
                  </span>
                </td>
                {matrix.map((row) => (
                  <td key={row.role} className="px-3 py-3 text-center">
                    <input
                      type="checkbox"
                      className="size-4 accent-primary"
                      checked={granted.get(row.role)?.has(permission) ?? false}
                      disabled={!row.editable || isSaving}
                      onChange={() => toggle(row.role, permission)}
                      aria-label={`${PERMISSION_LABELS[permission].label} para ${ROLE_LABELS[row.role]}`}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-sm text-muted-foreground">
        Administración siempre tiene todos los permisos. Los cambios valen desde el siguiente clic de cada
        usuario.
      </p>
      <Button onClick={save} disabled={isSaving} className="self-start">
        {isSaving ? "Guardando…" : "Guardar permisos"}
      </Button>
    </div>
  );
}
