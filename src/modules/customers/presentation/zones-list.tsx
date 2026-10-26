import { requireActor } from "@/modules/identity/presentation/current-user";
import { can } from "@/shared/application/permissions";
import { getDb } from "@/shared/infrastructure/db/client";
import { listZones } from "../application/customer-use-cases";
import { CreateZoneForm } from "./create-zone-form";
import { customerDeps } from "./customer-deps";

export async function ZonesList() {
  const actor = await requireActor();
  const zones = await listZones(customerDeps(getDb()), actor);

  return (
    <div className="flex max-w-md flex-col gap-6">
      {zones.length === 0 ? (
        <p className="text-sm text-muted-foreground">Todavía no hay zonas.</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {zones.map((zone) => (
            <li key={zone.id} className="px-4 py-2.5 text-sm">
              {zone.name}
            </li>
          ))}
        </ul>
      )}
      {can(actor, "customers.manage") && <CreateZoneForm />}
    </div>
  );
}
