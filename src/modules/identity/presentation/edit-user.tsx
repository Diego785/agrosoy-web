import { cn } from "cn";
import { notFound } from "next/navigation";
import { listAllZones } from "@/modules/customers/application/customer-use-cases";
import { drizzleZoneRepository } from "@/modules/customers/infrastructure/drizzle-zone-repository";
import type { Actor } from "@/shared/application/actor";
import { isDomainError } from "@/shared/domain/domain-error";
import { getDb } from "@/shared/infrastructure/db/client";
import { ROLE_LABELS } from "@/shared/presentation/role-labels";
import { ActionsSkeleton, FieldsSkeleton, Loading, Skeleton } from "@/shared/presentation/skeletons";
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

/** The edit page while it loads: the user's card, then the form as a sales technician sees it. */
export function EditUserSkeleton() {
  return (
    <Loading label="Cargando usuario" className="gap-6">
      <div aria-hidden className="flex max-w-2xl items-center gap-3 rounded-xl border bg-card p-4 shadow-xs">
        <Skeleton className="size-9 shrink-0 rounded-full" />
        <div className="flex flex-1 flex-col gap-1.5">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3.5 w-32" />
        </div>
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <UserFormSkeleton sections={[[1, 2], [{ half: true }]]} />
    </Loading>
  );
}

/** The new user form while it loads; a new user starts as a sales technician, so the zone shows. */
export function NewUserSkeleton() {
  return (
    <Loading label="Cargando formulario">
      <UserFormSkeleton
        sections={[
          [1, 2, 1],
          [2, { half: true }],
        ]}
      />
    </Loading>
  );
}

/**
 * The user form card: each section is a legend and its field rows (fields side by side, or a
 * single field that takes half the width, like the work zone).
 */
function UserFormSkeleton({ sections }: { sections: (number | { half: true })[][] }) {
  return (
    <div aria-hidden className="flex max-w-2xl flex-col overflow-hidden rounded-xl border bg-card shadow-xs">
      {sections.map((rows, section) => (
        <div key={section} className={cn("flex flex-col gap-4 p-5", section > 0 && "border-t")}>
          <Skeleton className="h-3.5 w-32" />
          <div className="flex flex-col gap-4">
            {rows.map((row, index) =>
              typeof row === "number" ? (
                <FieldsSkeleton key={index} rows={[row]} />
              ) : (
                <div key={index} className="sm:w-[calc(50%-0.5rem)]">
                  <FieldsSkeleton rows={[1]} />
                </div>
              ),
            )}
          </div>
        </div>
      ))}
      <div className="border-t bg-muted/40 px-5 py-4">
        <ActionsSkeleton count={2} />
      </div>
    </div>
  );
}

export type WorkZoneOption = { id: string; label: string };

/** Active zones, plus the user's current one if it was deactivated since. */
async function workZoneOptions(actor: Actor, currentZoneId: string | null = null): Promise<WorkZoneOption[]> {
  const zones = await listAllZones({ zones: drizzleZoneRepository(getDb()) }, actor);
  return zones
    .filter((zone) => zone.isActive || zone.id === currentZoneId)
    .map((zone) => ({ id: zone.id, label: zone.isActive ? zone.name : `${zone.name} (desactivada)` }));
}
