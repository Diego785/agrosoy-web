"use client";

import { CheckIcon, MinusIcon, SaveIcon } from "lucide-react";
import { Fragment, useState, useTransition } from "react";
import { toast } from "sonner";
import { PERMISSIONS, type Permission } from "@/shared/application/permissions";
import type { Role } from "@/shared/domain/role";
import { errorMessage } from "@/shared/presentation/error-messages";
import { PERMISSION_LABELS } from "@/shared/presentation/permission-labels";
import { ROLE_LABELS } from "@/shared/presentation/role-labels";
import { Button } from "@/shared/presentation/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/presentation/ui/table";
import type { PermissionMatrix } from "../application/permission-use-cases";
import { savePermissionMatrixAction } from "./permission-actions";
import { resetOnLeave } from "@/shared/presentation/reset-on-leave";

export const PermissionMatrixForm = resetOnLeave(function PermissionMatrixForm({
  matrix,
}: {
  matrix: PermissionMatrix;
}) {
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
      <Table className="min-w-[640px]">
        <TableHeader>
          <TableRow>
            <TableHead>Permiso</TableHead>
            {matrix.map((row) => (
              <TableHead key={row.role} className="w-32 text-center">
                {ROLE_LABELS[row.role]}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {PERMISSION_AREAS.map(({ area, permissions }) => (
            <Fragment key={area}>
              <TableRow className="bg-muted/35 hover:bg-muted/35">
                <TableCell
                  colSpan={matrix.length + 1}
                  className="py-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase"
                >
                  {area}
                </TableCell>
              </TableRow>
              {permissions.map((permission) => (
                <TableRow key={permission}>
                  <TableCell className="whitespace-normal">
                    <span className="font-medium">{PERMISSION_LABELS[permission].label}</span>
                    <span className="block text-xs text-muted-foreground">
                      {PERMISSION_LABELS[permission].description}
                    </span>
                  </TableCell>
                  {matrix.map((row) => {
                    const checked = granted.get(row.role)?.has(permission) ?? false;
                    const label = `${PERMISSION_LABELS[permission].label} para ${ROLE_LABELS[row.role]}`;
                    return (
                      <TableCell key={row.role} className="text-center">
                        {row.editable ? (
                          <input
                            type="checkbox"
                            className="size-4.5 cursor-pointer align-middle accent-primary disabled:cursor-not-allowed"
                            checked={checked}
                            disabled={isSaving}
                            onChange={() => toggle(row.role, permission)}
                            aria-label={label}
                          />
                        ) : (
                          // A role that can't be changed shows a plain mark instead of a dead checkbox.
                          <span
                            role="img"
                            aria-label={`${label}: ${checked ? "sí" : "no"}`}
                            className="inline-flex text-primary"
                          >
                            {checked ? (
                              <CheckIcon className="size-4.5" aria-hidden />
                            ) : (
                              <MinusIcon className="size-4.5 text-muted-foreground" aria-hidden />
                            )}
                          </span>
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </Fragment>
          ))}
        </TableBody>
      </Table>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-sm text-muted-foreground">
          Administración siempre tiene todos los permisos. Los cambios valen desde el siguiente clic de cada
          usuario.
        </p>
        <Button onClick={save} disabled={isSaving}>
          <SaveIcon aria-hidden />
          {isSaving ? "Guardando…" : "Guardar permisos"}
        </Button>
      </div>
    </div>
  );
});

/** Which part of the system each permission belongs to, read from its code ("catalog.manage"). */
const AREA_LABELS: Record<string, string> = {
  users: "Administración",
  audit: "Administración",
  customers: "Clientes y cobranzas",
  statements: "Clientes y cobranzas",
  payments: "Clientes y cobranzas",
  imports: "Importación",
  catalog: "Catálogo",
  notes: "Boletas",
};

const PERMISSION_AREAS = groupByArea();

/** The permissions grouped by area, in the order they are declared. */
function groupByArea() {
  const groups = new Map<string, Permission[]>();
  for (const permission of PERMISSIONS) {
    const prefix = permission.split(".")[0] ?? permission;
    const area = AREA_LABELS[prefix] ?? prefix;
    groups.set(area, [...(groups.get(area) ?? []), permission]);
  }
  return [...groups].map(([area, permissions]) => ({ area, permissions }));
}
