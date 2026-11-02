import type { ReactNode } from "react";
import { Badge } from "@/shared/presentation/ui/badge";
import type { StatementSource, StatementTotalsView } from "../application/statement-view";

export function StatusBadge({ status }: { status: StatementTotalsView["status"] }) {
  return status === "owing" ? (
    <Badge variant="warning" className="print:border-current">
      Debe
    </Badge>
  ) : (
    <Badge variant="success" className="print:border-current">
      Cancelado
    </Badge>
  );
}

export function SourceNotice({ source }: { source: StatementSource }) {
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
      <span className="font-medium text-foreground">{source.label}</span>
      {source.campaignLabel && (
        <>
          <span aria-hidden>·</span>
          <span>{source.campaignLabel}</span>
        </>
      )}
      {source.isPreview && (
        <Badge variant="info" className="ml-1 print:border-current">
          Vista previa con datos de la planilla
        </Badge>
      )}
    </p>
  );
}

export function Figures({ children }: { children: ReactNode }) {
  return <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">{children}</dl>;
}

export function Figure({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4 shadow-xs print:shadow-none ${emphasis ? "border-warning/40 bg-warning/8 print:bg-transparent" : "bg-card"}`}
    >
      <dt className="text-xs tracking-wide text-muted-foreground uppercase">{label}</dt>
      <dd className="mt-1 text-xl font-semibold tracking-tight tabular-nums">{value}</dd>
    </div>
  );
}
