import type { ReactNode } from "react";
import { cn } from "cn";

// Tables are for wide screens. Below `md` the same rows are shown as cards, one per row, so a phone
// never needs to scroll sideways. Each list renders both and CSS shows the one that fits.

export function WideOnly({ children }: { children: ReactNode }) {
  return <div className="hidden md:block">{children}</div>;
}

export function CardList({ label, children }: { label: string; children: ReactNode }) {
  return (
    <ul aria-label={label} className="divide-y overflow-hidden rounded-xl border bg-card shadow-xs md:hidden">
      {children}
    </ul>
  );
}

export function CardListItem({ className, children }: { className?: string; children: ReactNode }) {
  return <li className={cn("flex flex-col gap-1.5 px-4 py-3 text-sm", className)}>{children}</li>;
}

/** A label and its value on one line, for the secondary fields of a card. */
export function CardField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right tabular-nums">{children}</span>
    </div>
  );
}
