"use server";

import { revalidatePath } from "next/cache";
import { requireActor } from "@/modules/identity/presentation/current-user";
import { DomainError } from "@/shared/domain/domain-error";
import { withTransaction } from "@/shared/infrastructure/db/client";
import type { ActionResult } from "@/shared/presentation/action-result";
import { runAction } from "@/shared/presentation/run-action";
import { importSalesWorkbook, type ImportedSheetResult } from "../application/import-use-cases";
import { migrationDeps } from "./migration-deps";
import { IMPORTS_PATH } from "./migration-routes";

export async function importWorkbookAction(
  formData: FormData,
): Promise<ActionResult<{ sheets: ImportedSheetResult[]; skippedSheets: string[] }>> {
  return runAction(async () => {
    const actor = await requireActor();
    const file = formData.get("file");
    if (!(file instanceof File)) throw new DomainError("INVALID_FILE");

    const content = new Uint8Array(await file.arrayBuffer());
    const result = await withTransaction((tx) =>
      importSalesWorkbook(migrationDeps(tx), actor, { fileName: file.name, content }),
    );
    revalidatePath(IMPORTS_PATH);
    return result;
  });
}
