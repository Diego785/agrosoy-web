import { notFound } from "next/navigation";
import { requireActor } from "@/modules/identity/presentation/current-user";
import { isDomainError } from "@/shared/domain/domain-error";
import { getDb } from "@/shared/infrastructure/db/client";
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
      <p className="-mt-4 font-mono text-sm text-muted-foreground">
        Código {formatCustomerCode(customer.code)}
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
