import { getDb } from "@/shared/infrastructure/db/client";
import { getPermissionMatrix } from "../application/permission-use-cases";
import { drizzlePermissionSettings } from "../infrastructure/drizzle-permission-settings";
import { requireActor } from "./current-user";
import { PermissionMatrixForm } from "./permission-matrix-form";

export async function PermissionMatrix() {
  const actor = await requireActor();
  const matrix = await getPermissionMatrix({ permissions: drizzlePermissionSettings(getDb()) }, actor);
  return <PermissionMatrixForm matrix={matrix} />;
}
