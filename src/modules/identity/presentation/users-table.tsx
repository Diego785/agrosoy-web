import Link from "next/link";
import { listAllZones } from "@/modules/customers/application/customer-use-cases";
import { drizzleZoneRepository } from "@/modules/customers/infrastructure/drizzle-zone-repository";
import { getDb } from "@/shared/infrastructure/db/client";
import { ROLE_LABELS } from "@/shared/presentation/role-labels";
import { Badge } from "@/shared/presentation/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/presentation/ui/table";
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
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.map((user) => (
          <TableRow key={user.id}>
            <TableCell>
              <Link href={editUserPath(user.id)} className="font-medium hover:underline">
                {user.name}
              </Link>
              {(user.position || user.email) && (
                <span className="block text-xs text-muted-foreground">
                  {[user.position, user.email].filter(Boolean).join(" · ")}
                </span>
              )}
            </TableCell>
            <TableCell className="font-mono text-sm">{user.username}</TableCell>
            <TableCell>
              {ROLE_LABELS[user.role]}
              {user.workZoneId && (
                <span className="block text-xs text-muted-foreground">{zoneNames.get(user.workZoneId)}</span>
              )}
            </TableCell>
            <TableCell>
              {!user.active ? (
                <Badge variant="destructive">Desactivado</Badge>
              ) : user.mustChangePassword ? (
                <Badge variant="outline">Contraseña temporal</Badge>
              ) : (
                <Badge variant="secondary">Activo</Badge>
              )}
            </TableCell>
            <TableCell>
              {user.id !== actor.id && (
                <UserRowActions
                  userId={user.id}
                  name={user.name}
                  username={user.username}
                  active={user.active}
                />
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function UsersTableSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-busy="true" aria-label="Cargando usuarios">
      {Array.from({ length: 5 }, (_, row) => (
        <div key={row} className="h-10 animate-pulse rounded-md bg-muted/60" />
      ))}
    </div>
  );
}
