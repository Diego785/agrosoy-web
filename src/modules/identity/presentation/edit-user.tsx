import { notFound } from "next/navigation";
import { listAllZones } from "@/modules/customers/application/customer-use-cases";
import { drizzleZoneRepository } from "@/modules/customers/infrastructure/drizzle-zone-repository";
import type { Actor } from "@/shared/application/actor";
import { isDomainError } from "@/shared/domain/domain-error";
import { getDb } from "@/shared/infrastructure/db/client";
import { ROLE_LABELS } from "@/shared/presentation/role-labels";
import { getUser } from "../application/user-use-cases";
import { drizzleUserDirectory } from "../infrastructure/drizzle-user-directory";
import { requireActor } from "./current-user";
import { CreateUserForm } from "./create-user-form";
import { EditUserForm } from "./edit-user-form";
import { UserInitials, UserStatus } from "./users-table";

export async function EditUser({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requireActor();
  const user = await getUser({ users: drizzleUserDirectory(getDb()) }, actor, { userId: id }).catch(
    (error: unknown) => {
      if (isDomainError(error) && (error.code === "NOT_FOUND" || error.code === "VALIDATION_FAILED"))
        notFound();
      throw error;
    },
  );

  return (
    <>
      <div className="flex max-w-2xl flex-wrap items-center gap-3 rounded-xl border bg-card p-4 shadow-xs">
        <UserInitials name={user.name} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{user.name}</p>
          <p className="truncate text-sm text-muted-foreground">
            <span className="font-mono text-xs">{user.username}</span> · {ROLE_LABELS[user.role]}
          </p>
        </div>
        <UserStatus user={user} />
      </div>
      <EditUserForm user={user} zones={await workZoneOptions(actor, user.workZoneId)} />
    </>
  );
}

export async function NewUser() {
  const actor = await requireActor();
  return <CreateUserForm zones={await workZoneOptions(actor)} />;
}

export type WorkZoneOption = { id: string; label: string };

/** Active zones, plus the user's current one if it was deactivated since. */
async function workZoneOptions(actor: Actor, currentZoneId: string | null = null): Promise<WorkZoneOption[]> {
  const zones = await listAllZones({ zones: drizzleZoneRepository(getDb()) }, actor);
  return zones
    .filter((zone) => zone.isActive || zone.id === currentZoneId)
    .map((zone) => ({ id: zone.id, label: zone.isActive ? zone.name : `${zone.name} (desactivada)` }));
}
