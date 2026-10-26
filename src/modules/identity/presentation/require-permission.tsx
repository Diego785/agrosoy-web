import type { ReactNode } from "react";
import { can, type Permission } from "@/shared/application/permissions";
import { requireActor } from "./current-user";

const NO_ACCESS = <p className="text-sm text-muted-foreground">Tu usuario no tiene acceso a esta sección.</p>;

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
