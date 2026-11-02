import { InfoIcon } from "lucide-react";
import { notFound } from "next/navigation";
import { requireActor } from "@/modules/identity/presentation/current-user";
import { isDomainError } from "@/shared/domain/domain-error";
import { getDb } from "@/shared/infrastructure/db/client";
import { Loading, Skeleton, TableSkeleton } from "@/shared/presentation/skeletons";
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

/** The conversion while it loads: the notice, then the customers and the products to create. */
export function ConversionPageSkeleton() {
  return (
    <Loading label="Cargando clientes y productos" className="max-w-5xl gap-8">
      <div
        aria-hidden
        className="flex items-start gap-3 rounded-xl border border-info/25 bg-info/5 px-4 py-3"
      >
        <Skeleton className="mt-0.5 size-4 shrink-0" />
        <Skeleton className="my-[3px] h-3.5 w-full max-w-lg" />
      </div>
      <div aria-hidden className="flex flex-col gap-3">
        <Skeleton className="my-1 h-4 w-20" />
        {/* These tables show on phones too, unlike most lists. */}
        <TableSkeleton className="block" columns={[{ shape: "text" }, { shape: "badge" }]} />
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-9 w-48 rounded-lg" />
          <Skeleton className="h-9 w-56 rounded-lg" />
        </div>
      </div>
      <div aria-hidden className="flex flex-col gap-3">
        <Skeleton className="my-1 h-4 w-24" />
        <div className="flex flex-col gap-1.5 py-0.5">
          <Skeleton className="h-3.5 w-full max-w-2xl" />
          <Skeleton className="h-3.5 w-1/2" />
        </div>
        <TableSkeleton
          className="block"
          rows={6}
          columns={[{ shape: "stacked" }, { shape: "badge" }, { shape: "input" }, { shape: "input" }]}
        />
        <Skeleton className="h-9 w-52 rounded-lg" />
      </div>
    </Loading>
  );
}
