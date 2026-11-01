import { notFound } from "next/navigation";
import { requireActor } from "@/modules/identity/presentation/current-user";
import { isDomainError } from "@/shared/domain/domain-error";
import { getDb } from "@/shared/infrastructure/db/client";
import { conversionPreview } from "../application/conversion";
import { conversionDeps } from "../infrastructure/conversion-adapters";
import { CustomerConversion, ProductConversion } from "./conversion-forms";

export async function ConversionPage({ params }: { params: Promise<{ batchId: string }> }) {
  const { batchId } = await params;
  const actor = await requireActor();
  const preview = await conversionPreview(conversionDeps(getDb(), actor), actor, batchId).catch(
    (error: unknown) => {
      if (isDomainError(error) && (error.code === "NOT_FOUND" || error.code === "VALIDATION_FAILED"))
        notFound();
      throw error;
    },
  );

  return (
    <div className="flex max-w-5xl flex-col gap-10">
      <p className="text-sm text-muted-foreground">
        Hoja «{preview.batch.sheetName}» · {preview.batch.campaignLabel ?? "sin campaña"}. Se crean registros
        reales del sistema; la planilla importada no cambia.
      </p>
      <CustomerConversion preview={preview} />
      <ProductConversion preview={preview} />
    </div>
  );
}
