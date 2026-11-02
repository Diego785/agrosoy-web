import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { requireActor } from "@/modules/identity/presentation/current-user";
import { isDomainError } from "@/shared/domain/domain-error";
import { getDb } from "@/shared/infrastructure/db/client";
import { FieldsSkeleton, Loading, Skeleton } from "@/shared/presentation/skeletons";
import { customerFormOptions, getCustomerForEdit } from "../application/customer-use-cases";
import { formatCustomerCode } from "../domain/customer";
import { CustomerForm } from "./customer-form";
import { customerDeps } from "./customer-deps";

/** Loads the customer and the form options, then renders the edit form. */
export async function EditCustomer({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requireActor();
  const deps = customerDeps(getDb());

  const customer = await getCustomerForEdit(deps, actor, id).catch((error: unknown) => {
    if (isDomainError(error) && (error.code === "NOT_FOUND" || error.code === "VALIDATION_FAILED"))
      notFound();
    throw error;
  });
  const options = await customerFormOptions(deps, actor, customer.zoneId);

  return (
    <>
      <p className="-mt-3 text-sm text-muted-foreground">
        Código <span className="font-mono">{formatCustomerCode(customer.code)}</span>
      </p>
      <CustomerForm {...options} customer={customer} />
    </>
  );
}

export async function NewCustomer() {
  const actor = await requireActor();
  const options = await customerFormOptions(customerDeps(getDb()), actor);
  return <CustomerForm {...options} />;
}

/**
 * The customer form while it loads, section by section like `CustomerForm`; when editing, with the
 * code line `EditCustomer` shows above it.
 */
export function CustomerFormSkeleton({ editing = false }: { editing?: boolean }) {
  return (
    // gap-6 is the page's own gap: the code line and the form are its children in the real page.
    <Loading label="Cargando formulario" className="gap-6">
      {editing && <Skeleton className="-mt-2.5 mb-0.5 h-4 w-28" />}
      <div
        aria-hidden
        className="flex max-w-2xl flex-col divide-y overflow-hidden rounded-xl border bg-card shadow-xs"
      >
        <FormSectionSkeleton>
          <FieldsSkeleton rows={[1, 2]} />
        </FormSectionSkeleton>
        <FormSectionSkeleton>
          <FieldsSkeleton rows={[2]} />
        </FormSectionSkeleton>
        <FormSectionSkeleton>
          {/* One field in a half-width column: the fixed rate field only shows for a fixed rate. */}
          <div className="grid gap-5 sm:grid-cols-2">
            <FieldsSkeleton rows={[1]} />
          </div>
        </FormSectionSkeleton>
        <FormSectionSkeleton>
          <div className="flex flex-col gap-2">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-16 w-full rounded-lg" />
            <Skeleton className="h-3.5 w-72 max-w-full" />
          </div>
        </FormSectionSkeleton>
        <div className="flex gap-3 bg-muted/30 px-5 py-4">
          <Skeleton className="h-9 w-36 rounded-lg" />
          <Skeleton className="h-9 w-24 rounded-lg" />
        </div>
      </div>
    </Loading>
  );
}

function FormSectionSkeleton({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 p-5">
      <Skeleton className="my-0.5 h-4 w-32" />
      {children}
    </div>
  );
}
