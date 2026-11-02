import { ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import { listAllZones } from "@/modules/customers/application/customer-use-cases";
import { drizzleZoneRepository } from "@/modules/customers/infrastructure/drizzle-zone-repository";
import { getDb } from "@/shared/infrastructure/db/client";
import { CardList, CardListItem, WideOnly } from "@/shared/presentation/responsive-list";
import { ROLE_LABELS } from "@/shared/presentation/role-labels";
import { Loading, Skeleton, TableSkeleton } from "@/shared/presentation/skeletons";
import { Badge } from "@/shared/presentation/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/presentation/ui/table";
import type { UserSummary } from "../application/ports";
import { listUsers } from "../application/user-use-cases";
import { drizzleUserDirectory } from "../infrastructure/drizzle-user-directory";
import { requireActor } from "./current-user";
import { editUserPath } from "./identity-routes";
import { UserRowActions } from "./user-row-actions";

export async function UsersTable() {
  const actor = await requireActor();
  const db = getDb();
  const [users, zones] = await Promise.all([
    listUsers({ users: drizzleUserDirectory(db) }, actor),
    listAllZones({ zones: drizzleZoneRepository(db) }, actor),
  ]);
  const zoneNames = new Map(zones.map((zone) => [zone.id, zone.name]));

  return (
    <>
      <WideOnly>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Usuario</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="w-12">
                <span className="sr-only">Acciones</span>
              </TableHead>
              <TableHead className="w-10">
                <span className="sr-only">Abrir</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id} className="group relative">
                <TableCell>
                  <div className="flex items-center gap-3">
                    <UserInitials name={user.name} />
                    <div className="min-w-0">
                      {/* The link covers the row, so the whole row opens the user. */}
                      <Link
                        href={editUserPath(user.id)}
                        className="block truncate font-medium group-hover:text-primary after:absolute after:inset-0"
                      >
                        {user.name}
                      </Link>
                      {(user.position || user.email) && (
                        <span className="block truncate text-xs text-muted-foreground">
                          {[user.position, user.email].filter(Boolean).join(" · ")}
                        </span>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{user.username}</TableCell>
                <TableCell>
                  {ROLE_LABELS[user.role]}
                  {user.workZoneId && (
                    <span className="block text-xs text-muted-foreground">
                      {zoneNames.get(user.workZoneId)}
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  <UserStatus user={user} />
                </TableCell>
                <TableCell>
                  {user.id !== actor.id && (
                    // Above the row's link, so the menu opens instead of the user.
                    <div className="relative z-10">
                      <UserRowActions
                        userId={user.id}
                        name={user.name}
                        username={user.username}
                        active={user.active}
                      />
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  <ChevronRightIcon
                    className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
                    aria-hidden
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </WideOnly>
      <CardList label="Usuarios">
        {users.map((user) => (
          <CardListItem key={user.id} className="relative gap-3">
            <div className="flex items-center gap-3">
              <UserInitials name={user.name} />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <Link
                  href={editUserPath(user.id)}
                  className="truncate font-medium after:absolute after:inset-0"
                >
                  {user.name}
                </Link>
                <span className="truncate text-xs text-muted-foreground">
                  <span className="font-mono">{user.username}</span> · {ROLE_LABELS[user.role]}
                  {user.workZoneId && ` · ${zoneNames.get(user.workZoneId) ?? ""}`}
                </span>
                {user.position && (
                  <span className="truncate text-xs text-muted-foreground">{user.position}</span>
                )}
              </div>
              {user.id !== actor.id ? (
                <div className="relative z-10">
                  <UserRowActions
                    userId={user.id}
                    name={user.name}
                    username={user.username}
                    active={user.active}
                  />
                </div>
              ) : (
                <ChevronRightIcon className="size-4 text-muted-foreground" aria-hidden />
              )}
            </div>
            <div className="pl-12">
              <UserStatus user={user} />
            </div>
          </CardListItem>
        ))}
      </CardList>
    </>
  );
}

/** "Diego Hurtado" → "DH" */
function initials(name: string) {
  const words = name.trim().split(/\s+/);
  const last = words.length > 1 ? words[words.length - 1] : "";
  return `${words[0]?.[0] ?? ""}${last?.[0] ?? ""}`.toUpperCase();
}

export function UserInitials({ name }: { name: string }) {
  return (
    <span
      aria-hidden
      className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground"
    >
      {initials(name)}
    </span>
  );
}

export function UserStatus({ user }: { user: UserSummary }) {
  if (!user.active) return <Badge variant="destructive">Desactivado</Badge>;
  if (user.mustChangePassword) return <Badge variant="warning">Contraseña temporal</Badge>;
  return <Badge variant="success">Activo</Badge>;
}

/** The users list while it loads, laid out like `UsersTable`. */
export function UsersTableSkeleton() {
  return (
    <Loading label="Cargando usuarios">
      <TableSkeleton
        columns={[
          { shape: "avatar" },
          { shape: "code" },
          { shape: "text" },
          { shape: "badge" },
          // The row menu shows only its icon, the size of the chevron.
          { shape: "chevron", className: "w-12" },
          { shape: "chevron", className: "w-10" },
        ]}
      />
      {/* Built here instead of `CardListSkeleton`: each card ends with the status badge under the name. */}
      <ul aria-hidden className="divide-y overflow-hidden rounded-xl border bg-card shadow-xs md:hidden">
        {Array.from({ length: 5 }, (_, row) => (
          <li key={row} className="flex flex-col gap-3 px-4 py-3">
            <div className="flex items-center gap-3">
              <Skeleton className="size-9 shrink-0 rounded-full" />
              <div className="flex flex-1 flex-col gap-1.5">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/2" />
              </div>
              <Skeleton className="size-4" />
            </div>
            <div className="pl-12">
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
          </li>
        ))}
      </ul>
    </Loading>
  );
}
