"use server";

import { revalidatePath } from "next/cache";
import { requireActor } from "@/modules/identity/presentation/current-user";
import { updateCompanyProfile, type CompanyProfileInput } from "@/shared/application/company-profile";
import { drizzleAuditTrail } from "@/shared/infrastructure/audit/drizzle-audit-trail";
import { drizzleSettingsStore } from "@/shared/infrastructure/db/app-settings";
import { withTransaction } from "@/shared/infrastructure/db/client";
import type { ActionResult } from "./action-result";
import { runAction } from "./run-action";

export async function updateCompanyProfileAction(input: CompanyProfileInput): Promise<ActionResult<null>> {
  return runAction(async () => {
    const actor = await requireActor();
    await withTransaction((tx) =>
      updateCompanyProfile(
        { settings: drizzleSettingsStore(tx), audit: drizzleAuditTrail(tx) },
        actor,
        input,
      ),
    );
    revalidatePath("/settings/company");
    return null;
  });
}
