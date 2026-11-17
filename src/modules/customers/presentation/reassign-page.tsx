import { requireActor } from "@/modules/identity/presentation/current-user";
import { getDb } from "@/shared/infrastructure/db/client";
import { Loading, Skeleton, TableSkeleton } from "@/shared/presentation/skeletons";
import { reassignmentOptions } from "../application/customer-use-cases";
import { customerDeps } from "./customer-deps";
import { ReassignTechnician } from "./reassign-technician";

/** Loads every active customer with today's technician, to hand several to another one (D46). */
export async function ReassignCustomers() {
  const actor = await requireActor();
  const { portfolio, technicians } = await reassignmentOptions(customerDeps(getDb()), actor);
  return <ReassignTechnician portfolio={portfolio} technicians={technicians} />;
}

export function ReassignCustomersSkeleton() {
  return (
    <Loading label="Cargando clientes" className="max-w-4xl gap-4">
      <div aria-hidden className="flex gap-2">
        <Skeleton className="h-9 w-56 rounded-lg" />
        <Skeleton className="h-9 w-64 rounded-lg" />
      </div>
      <TableSkeleton className="block" rows={8} columns={[{ shape: "text" }, { shape: "text" }]} />
    </Loading>
  );
}
