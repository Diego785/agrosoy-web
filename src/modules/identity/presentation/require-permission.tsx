import { ShieldAlertIcon } from "lucide-react";
import type { ReactNode } from "react";
import { can, type Permission } from "@/shared/application/permissions";
import { EmptyState } from "@/shared/presentation/empty-state";
import { requireActor } from "./current-user";

const NO_ACCESS = (
  <EmptyState icon={<ShieldAlertIcon />} title="Sin acceso">
    Tu usuario no tiene acceso a esta sección.
  </EmptyState>
);

/**
 * Renders its children only for users with the permission; `fallback` otherwise (pass null to
 * hide a button). A convenience for the UI: the use case behind it checks again.
 */
export async function RequirePermission({
  permission,
  fallback = NO_ACCESS,
  children,
}: {
  permission: Permission;
  fallback?: ReactNode;
  children: ReactNode;
}) {
  const actor = await requireActor();
  return can(actor, permission) ? children : fallback;
}
