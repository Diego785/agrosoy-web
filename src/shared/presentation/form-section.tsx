import type { ReactNode } from "react";
import { Skeleton } from "./skeletons";

/** A white card with a small title, one for each group of a form's fields. */
export function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-xs">
      <fieldset className="flex min-w-0 flex-col gap-4">
        <legend className="mb-4 text-sm font-semibold">{title}</legend>
        {children}
      </fieldset>
    </div>
  );
}

/** `FormSection` while it loads. */
export function FormSectionSkeleton({ children }: { children: ReactNode }) {
  return (
    <div aria-hidden className="rounded-xl border bg-card p-5 shadow-xs">
      <div className="mb-4 py-0.5">
        <Skeleton className="h-4 w-32" />
      </div>
      <div className="flex flex-col gap-4">{children}</div>
    </div>
  );
}
