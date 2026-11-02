import { FlaskConicalIcon, SproutIcon, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { cn } from "cn";
import { formatMoney } from "@/shared/presentation/format";
import type { ProductView } from "../application/catalog-ports";
import type { ProductLine } from "../domain/product";
import { contentLabel, priceUnitLabel } from "./catalog-labels";

const LINE_LOOK: Record<ProductLine, { icon: LucideIcon; tile: string }> = {
  agrochemicals: { icon: FlaskConicalIcon, tile: "bg-info/10 text-info" },
  fertilizers: { icon: SproutIcon, tile: "bg-success/12 text-success" },
};

/** The product's line as a small colored tile: a flask for agrochemicals, a sprout for fertilizers. */
export function LineMark({ line, className }: { line: ProductLine; className?: string }) {
  const { icon: Icon, tile } = LINE_LOOK[line];
  return (
    <span
      aria-hidden
      className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", tile, className)}
    >
      <Icon className="size-[1.15rem]" />
    </span>
  );
}

const SHORT_UNITS: Record<string, string> = { envase: "", litro: "/L", kilo: "/kg", unidad: "/u" };

/** How many presentations a row shows before "+N"; the rest are on the product's page. */
export const VISIBLE_PRESENTATIONS = 4;

/**
 * A product's presentations as tags on one line: code, content and, with a campaign, its price.
 * A presentation without a price shows a dashed tag, so the gaps are easy to spot.
 */
export function PresentationTags({
  presentations,
  prices,
  href,
  limit = VISIBLE_PRESENTATIONS,
}: {
  presentations: ProductView["presentations"];
  prices?: Map<string, string>;
  href: string;
  limit?: number;
}) {
  if (presentations.length === 0) {
    return <span className="text-sm text-muted-foreground">Sin presentaciones activas</span>;
  }
  const shown = presentations.slice(0, limit);
  const hidden = presentations.length - shown.length;
  return (
    <ul className="flex flex-wrap items-center gap-1.5">
      {shown.map((presentation) => {
        const price = prices?.get(presentation.id);
        const unit = priceUnitLabel(presentation);
        return (
          <li
            key={presentation.id}
            title={price ? `US$ ${formatMoney(price)} por ${unit}` : prices ? "Sin precio" : undefined}
            className={cn(
              "inline-flex h-7 items-center gap-1.5 rounded-md border px-2 text-xs tabular-nums",
              !prices || price ? "border-border bg-card" : "border-dashed bg-muted/40 text-muted-foreground",
            )}
          >
            <span className="font-mono text-[0.7rem] text-muted-foreground">{presentation.code}</span>
            <span className="font-medium text-foreground">{contentLabel(presentation)}</span>
            {prices &&
              (price ? (
                <span className="font-semibold text-primary">
                  {formatMoney(price)}
                  <span className="font-normal text-muted-foreground">{SHORT_UNITS[unit] ?? ""}</span>
                </span>
              ) : (
                <span>sin precio</span>
              ))}
          </li>
        );
      })}
      {hidden > 0 && (
        <li>
          <Link
            href={href}
            className="relative z-10 inline-flex h-7 items-center rounded-md px-2 text-xs font-medium text-primary hover:bg-accent"
          >
            +{hidden} más
          </Link>
        </li>
      )}
    </ul>
  );
}

/** "5 presentaciones"; the tags show which have a price. */
export function presentationCount(presentations: ProductView["presentations"]) {
  return presentations.length === 1 ? "1 presentación" : `${presentations.length} presentaciones`;
}
