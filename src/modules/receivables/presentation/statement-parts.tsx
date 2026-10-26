import type { ReactNode } from "react";
import { Badge } from "@/shared/presentation/ui/badge";
import type { StatementSource, StatementTotalsView } from "../application/statement-view";

export function StatusBadge({ status }: { status: StatementTotalsView["status"] }) {
  return status === "owing" ? (
    <Badge
      variant="outline"
      className="border-amber-300 text-amber-800 dark:border-amber-700 dark:text-amber-200"
    >
      Debe
    </Badge>
  ) : (
    <Badge variant="secondary">Cancelado</Badge>
  );
}

export function SourceNotice({ source }: { source: StatementSource }) {
  return (
    <p className="text-sm text-muted-foreground">
      {source.label}
      {source.campaignLabel && <> · {source.campaignLabel}</>}
      {source.isPreview && (
        <span className="ml-2 rounded-sm bg-muted px-1.5 py-0.5 text-xs text-foreground print:border">
          Vista previa con datos de la planilla
        </span>
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
    <div className="rounded-lg border px-4 py-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd
        className={`mt-1 text-lg font-semibold tabular-nums ${emphasis ? "text-amber-800 dark:text-amber-200" : ""}`}
      >
        {value}
      </dd>
    </div>
  );
}
