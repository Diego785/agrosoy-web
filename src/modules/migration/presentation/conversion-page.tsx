import { InfoIcon } from "lucide-react";
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
    <div className="flex max-w-5xl flex-col gap-8">
      <p className="flex items-start gap-3 rounded-xl border border-info/25 bg-info/5 px-4 py-3 text-sm">
        <InfoIcon className="mt-0.5 size-4 shrink-0 text-info" aria-hidden />
        <span>
          <span className="font-medium">Hoja «{preview.batch.sheetName}»</span> ·{" "}
          {preview.batch.campaignLabel ?? "sin campaña"}.{" "}
          <span className="text-muted-foreground">
            Se crean registros reales del sistema; la planilla importada no cambia.
          </span>
        </span>
      </p>
      <CustomerConversion preview={preview} />
      <ProductConversion preview={preview} />
    </div>
  );
}
