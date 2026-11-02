import { MapPinIcon } from "lucide-react";
import { requireActor } from "@/modules/identity/presentation/current-user";
import { can } from "@/shared/application/permissions";
import { getDb } from "@/shared/infrastructure/db/client";
import { EmptyState } from "@/shared/presentation/empty-state";
import { Loading, Skeleton } from "@/shared/presentation/skeletons";
import { listAllZones } from "../application/customer-use-cases";
import { CreateZoneForm } from "./create-zone-form";
import { customerDeps } from "./customer-deps";
import { ZoneName, ZoneRow } from "./zone-controls";

export async function ZonesList() {
  const actor = await requireActor();
  const zones = await listAllZones(customerDeps(getDb()), actor);
  const canEdit = can(actor, "customers.manage");

  return (
    <div className="flex max-w-xl flex-col gap-6">
      {zones.length === 0 ? (
        <EmptyState icon={<MapPinIcon />} title="Todavía no hay zonas.">
          {canEdit && "Agrega la primera para agrupar a los clientes."}
        </EmptyState>
      ) : (
        <ul aria-label="Zonas" className="divide-y overflow-hidden rounded-xl border bg-card shadow-xs">
          {zones.map((zone) => (
            <li key={zone.id} className="px-4 py-3 text-sm">
              {canEdit ? <ZoneRow zone={zone} /> : <ZoneName zone={zone} />}
            </li>
          ))}
        </ul>
      )}
      {canEdit && (
        <section className="rounded-xl border bg-card p-5 shadow-xs">
          <CreateZoneForm />
        </section>
      )}
    </div>
  );
}

/** The zones while they load: rows like `ZoneRow`, then the new zone form. */
export function ZonesListSkeleton() {
  return (
    <Loading label="Cargando zonas" className="max-w-xl gap-6">
      <ul aria-hidden className="divide-y overflow-hidden rounded-xl border bg-card shadow-xs">
        {[0, 1, 2, 3].map((row) => (
          <li key={row} className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="flex items-center gap-3">
              <Skeleton className="size-8 shrink-0 rounded-lg" />
              <div className="flex flex-col gap-1.5 py-0.5">
                <Skeleton className="h-3.5 w-32" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
            <div className="flex gap-1">
              <Skeleton className="h-7 w-24 rounded-lg" />
              <Skeleton className="h-7 w-20 rounded-lg" />
            </div>
          </li>
        ))}
      </ul>
      <div aria-hidden className="flex flex-col gap-2 rounded-xl border bg-card p-5 shadow-xs">
        <Skeleton className="my-0.5 h-4 w-24" />
        <div className="flex gap-2">
          <Skeleton className="h-9 flex-1 rounded-lg" />
          <Skeleton className="h-9 w-24 rounded-lg" />
        </div>
      </div>
    </Loading>
  );
}
