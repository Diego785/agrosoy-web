"use server";

import { revalidatePath } from "next/cache";
import { drizzleAuditTrail } from "@/shared/infrastructure/audit/drizzle-audit-trail";
import { withTransaction } from "@/shared/infrastructure/db/client";
import type { ActionResult } from "@/shared/presentation/action-result";
import { runAction } from "@/shared/presentation/run-action";
import { updateRolePermissions } from "../application/permission-use-cases";
import { drizzlePermissionSettings } from "../infrastructure/drizzle-permission-settings";
import { requireActor } from "./current-user";
import { HOME_PATH } from "./identity-routes";

/** Saves every edited role at once: all of them apply, or none. */
export async function savePermissionMatrixAction(
  roles: { role: string; permissions: string[] }[],
): Promise<ActionResult<null>> {
  return runAction(async () => {
    const actor = await requireActor();
    await withTransaction(async (tx) => {
      const deps = { permissions: drizzlePermissionSettings(tx), audit: drizzleAuditTrail(tx) };
      for (const input of roles) await updateRolePermissions(deps, actor, input);
    });
    // Navigation and pages depend on permissions everywhere.
    revalidatePath(HOME_PATH, "layout");
    return null;
  });
}
