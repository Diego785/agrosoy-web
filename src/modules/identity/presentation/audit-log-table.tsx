import Link from "next/link";
import { getDb } from "@/shared/infrastructure/db/client";
import { formatCount, formatDateTime } from "@/shared/presentation/format";
import { ROLE_LABELS } from "@/shared/presentation/role-labels";
import { isRole } from "@/shared/domain/role";
import { buttonVariants } from "@/shared/presentation/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/presentation/ui/table";
import { listAuditEntries } from "../application/audit-use-cases";
import { drizzleAuditLogReader } from "../infrastructure/drizzle-audit-log-reader";
import { requireActor } from "./current-user";
import { AUDIT_PATH } from "./identity-routes";

/** How each recorded action reads. Unknown actions (from future modules) show their code. */
const ACTION_LABELS: Record<string, string> = {
  "identity.create_user": "Creó el usuario",
  "identity.reset_password": "Restableció la contraseña de",
  "identity.deactivate_user": "Desactivó al usuario",
  "identity.reactivate_user": "Reactivó al usuario",
  "identity.change_own_password": "Cambió su contraseña",
  "identity.update_permissions": "Cambió los permisos de",
  "customers.register": "Registró al cliente",
  "customers.update": "Editó al cliente",
  "customers.create_zone": "Agregó la zona",
  "migration.import_sheet": "Importó la hoja",
  "campaigns.create": "Creó la campaña",
  "campaigns.update": "Editó la campaña",
};

export async function AuditLogTable({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const actor = await requireActor();
  const { items, total, page, pageSize } = await listAuditEntries(
    { auditLog: drizzleAuditLogReader(getDb()) },
    actor,
    { page: Array.isArray(params.page) ? params.page[0] : params.page },
  );
  const lastPage = Math.max(1, Math.ceil(total / pageSize));

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">Todavía no hay cambios registrados.</p>;
  }
  return (
    <div className="flex flex-col gap-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-40">Fecha y hora</TableHead>
            <TableHead className="w-48">Usuario</TableHead>
            <TableHead>Cambio</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((entry) => (
            <TableRow key={entry.id}>
              <TableCell className="text-sm text-muted-foreground tabular-nums">
                {formatDateTime(entry.occurredAt)}
              </TableCell>
              <TableCell>{entry.actorName ?? "Instalación"}</TableCell>
              <TableCell>
                {ACTION_LABELS[entry.action] ?? entry.action}{" "}
                {entry.entityLabel && entry.action !== "identity.change_own_password" && (
                  <span className="font-medium">
                    {entry.entityType === "role" && isRole(entry.entityLabel)
                      ? ROLE_LABELS[entry.entityLabel]
                      : entry.entityLabel}
                  </span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <footer className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{formatCount(total)} cambios</span>
        {lastPage > 1 && (
          <nav className="flex items-center gap-2" aria-label="Páginas">
            {page > 1 && (
              <Link
                href={`${AUDIT_PATH}?page=${page - 1}`}
                className={buttonVariants({ variant: "ghost", size: "sm" })}
              >
                Más recientes
              </Link>
            )}
            <span>
              Página {page} de {lastPage}
            </span>
            {page < lastPage && (
              <Link
                href={`${AUDIT_PATH}?page=${page + 1}`}
                className={buttonVariants({ variant: "ghost", size: "sm" })}
              >
                Anteriores
              </Link>
            )}
          </nav>
        )}
      </footer>
    </div>
  );
}
