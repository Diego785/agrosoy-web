import { MapPinIcon } from "lucide-react";
import { requireActor } from "@/modules/identity/presentation/current-user";
import { can } from "@/shared/application/permissions";
import { getDb } from "@/shared/infrastructure/db/client";
import { EmptyState } from "@/shared/presentation/empty-state";
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
