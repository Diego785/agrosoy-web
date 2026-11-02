import type { ReactNode } from "react";
import { cn } from "cn";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";

// Placeholders shown while a screen's data loads. Each screen builds its own from these pieces with
// the same layout as the real content (same cards, columns and spacing), so nothing jumps when the
// data arrives. Screen readers hear "Cargando…" once; the shapes themselves are hidden from them.

/** A pulsing bar; size and shape come from `className`. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-md bg-foreground/[0.07]", className)} />;
}

/** Wraps a screen's placeholder and announces it. */
export function Loading({
  label,
  className,
  children,
}: {
  /** "Cargando productos" */
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div role="status" aria-busy="true" className={cn("flex flex-col gap-4", className)}>
      <span className="sr-only">{label}…</span>
      {children}
    </div>
  );
}

/** A list's filters: a search box and/or selects, as they sit above the list. */
export function FiltersSkeleton({ search = true, selects = 0 }: { search?: boolean; selects?: number }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {search && <Skeleton className="h-9 w-full rounded-lg sm:max-w-xs" />}
      {Array.from({ length: selects }, (_, index) => (
        <Skeleton key={index} className="h-9 w-36 rounded-lg" />
      ))}
    </div>
  );
}

/**
 * What a cell holds: plain text, a code, a badge, a name with a line under it, a name with an
 * avatar or a square icon before it, tags, a price field, or the trailing chevron.
 */
export type CellShape =
  "text" | "short" | "code" | "badge" | "stacked" | "avatar" | "icon" | "tags" | "input" | "chevron";

export type ColumnShape = { shape: CellShape; align?: "right"; className?: string };

function Cell({ shape, align }: ColumnShape) {
  const end = align === "right" ? "ml-auto" : "";
  switch (shape) {
    case "short":
      return <Skeleton className={cn("h-3.5 w-14", end)} />;
    case "code":
      return <Skeleton className={cn("h-3 w-10", end)} />;
    case "badge":
      return <Skeleton className={cn("h-5 w-16 rounded-full", end)} />;
    case "stacked":
      return (
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-3.5 w-40" />
          <Skeleton className="h-3 w-28" />
        </div>
      );
    case "avatar":
    case "icon":
      return (
        <div className="flex items-center gap-3">
          <Skeleton className={cn("size-9 shrink-0", shape === "avatar" ? "rounded-full" : "rounded-lg")} />
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-3.5 w-36" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      );
    case "tags":
      return (
        <div className="flex gap-1.5">
          <Skeleton className="h-7 w-28 rounded-md" />
          <Skeleton className="h-7 w-24 rounded-md" />
          <Skeleton className="h-7 w-28 rounded-md" />
        </div>
      );
    case "input":
      return <Skeleton className={cn("h-9 w-24 rounded-lg", end)} />;
    case "chevron":
      return <Skeleton className="size-4" />;
    default:
      return <Skeleton className={cn("h-3.5 w-28", end)} />;
  }
}

/** A table as the real one draws it (same card, header and paddings), with bars for its cells. */
export function TableSkeleton({
  columns,
  rows = 8,
  className,
}: {
  columns: ColumnShape[];
  rows?: number;
  className?: string;
}) {
  return (
    <div className={cn("hidden md:block", className)} aria-hidden>
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((column, index) => (
              <TableHead key={index} className={column.className}>
                {column.shape !== "chevron" && (
                  <Skeleton className={cn("h-3 w-16", column.align === "right" && "ml-auto")} />
                )}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: rows }, (_, row) => (
            <TableRow key={row}>
              {columns.map((column, index) => (
                <TableCell key={index} className={column.className}>
                  <Cell {...column} />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/** A list on a phone: one card per row, like `CardList`. */
export function CardListSkeleton({
  rows = 5,
  leading,
  lines = 2,
  tags = false,
}: {
  rows?: number;
  /** What sits before the title: a round avatar or a square icon. */
  leading?: "avatar" | "icon";
  /** Lines of secondary text under the title. */
  lines?: number;
  tags?: boolean;
}) {
  return (
    <ul aria-hidden className="divide-y overflow-hidden rounded-xl border bg-card shadow-xs md:hidden">
      {Array.from({ length: rows }, (_, row) => (
        <li key={row} className="flex flex-col gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            {leading && (
              <Skeleton
                className={cn("size-9 shrink-0", leading === "avatar" ? "rounded-full" : "rounded-lg")}
              />
            )}
            <div className="flex flex-1 flex-col gap-1.5">
              <Skeleton className="h-4 w-2/3" />
              {Array.from({ length: lines }, (_, line) => (
                <Skeleton key={line} className={cn("h-3", line === 0 ? "w-1/2" : "w-1/3")} />
              ))}
            </div>
          </div>
          {tags && (
            <div className="flex gap-1.5">
              <Skeleton className="h-7 w-28 rounded-md" />
              <Skeleton className="h-7 w-24 rounded-md" />
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

/** The count and pages under a list. */
export function ListFooterSkeleton() {
  return (
    <div aria-hidden className="flex items-center justify-between">
      <Skeleton className="h-3.5 w-24" />
      <Skeleton className="hidden h-7 w-40 md:block" />
    </div>
  );
}

/** A white section card like the detail pages draw, with a title bar and its body. */
export function SectionSkeleton({
  title = true,
  className,
  children,
}: {
  title?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div aria-hidden className={cn("overflow-hidden rounded-xl border bg-card shadow-xs", className)}>
      {title && (
        <div className="border-b px-5 py-4">
          <Skeleton className="h-4 w-32" />
        </div>
      )}
      <div className="flex flex-col gap-4 p-5">{children}</div>
    </div>
  );
}

/** Label and value pairs in a grid, as detail pages show a record's facts. */
export function FactsSkeleton({ count = 6, className }: { count?: number; className?: string }) {
  return (
    <div className={cn("grid gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3", className)}>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="flex flex-col gap-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-4 w-32" />
        </div>
      ))}
    </div>
  );
}

/**
 * Form fields: each number is a row and how many fields sit side by side in it, e.g. [2, 1] is
 * two fields, then one.
 */
export function FieldsSkeleton({ rows }: { rows: number[] }) {
  return (
    <div className="flex flex-col gap-5">
      {rows.map((fields, row) => (
        <div
          key={row}
          className={cn("grid gap-4", fields === 2 && "sm:grid-cols-2", fields >= 3 && "sm:grid-cols-3")}
        >
          {Array.from({ length: fields }, (_, field) => (
            <div key={field} className="flex flex-col gap-2">
              {/* As tall as a label's line, so each row matches the real form. */}
              <div className="flex h-5 items-center">
                <Skeleton className="h-3.5 w-24" />
              </div>
              <Skeleton className="h-9 w-full rounded-lg" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/** Buttons at the end of a form or card. */
export function ActionsSkeleton({ count = 1, className }: { count?: number; className?: string }) {
  return (
    <div aria-hidden className={cn("flex justify-end gap-2", className)}>
      {Array.from({ length: count }, (_, index) => (
        <Skeleton key={index} className={cn("h-9 rounded-lg", index === count - 1 ? "w-32" : "w-24")} />
      ))}
    </div>
  );
}

/** Figure cards: a label, a big number and a note, as the home page and statements show them. */
export function FiguresSkeleton({ count = 4, className }: { count?: number; className?: string }) {
  return (
    <div aria-hidden className={cn("grid gap-3 sm:grid-cols-2 xl:grid-cols-4", className)}>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="flex flex-col gap-3 rounded-xl border bg-card p-5 shadow-xs">
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-3 w-24" />
        </div>
      ))}
    </div>
  );
}
