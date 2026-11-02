import { getDb } from "@/shared/infrastructure/db/client";
import { formatDateTime } from "@/shared/presentation/format";
import { CardList, CardListItem, WideOnly } from "@/shared/presentation/responsive-list";
import { ListPages, listHref, pageRows } from "@/shared/presentation/list-pages";
import { ROLE_LABELS } from "@/shared/presentation/role-labels";
import { isRole } from "@/shared/domain/role";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/presentation/ui/table";
import { listAuditEntries } from "../application/audit-use-cases";
import type { AuditLogEntry } from "../application/ports";
import { drizzleAuditLogReader } from "../infrastructure/drizzle-audit-log-reader";
import { requireActor } from "./current-user";
import { AUDIT_PATH } from "./identity-routes";

/** How each recorded action reads. Unknown actions (from future modules) show their code. */
const ACTION_LABELS: Record<string, string> = {
  "identity.create_user": "Creó el usuario",
  "identity.update_user": "Editó al usuario",
  "identity.reset_password": "Restableció la contraseña de",
  "identity.deactivate_user": "Desactivó al usuario",
  "identity.reactivate_user": "Reactivó al usuario",
  "identity.change_own_password": "Cambió su contraseña",
  "identity.update_permissions": "Cambió los permisos de",
  "customers.register": "Registró al cliente",
  "customers.update": "Editó al cliente",
  "customers.create_zone": "Agregó la zona",
  "customers.deactivate": "Desactivó al cliente",
  "customers.reactivate": "Reactivó al cliente",
  "customers.add_property": "Agregó una propiedad a",
  "customers.remove_property": "Quitó una propiedad de",
  "customers.add_receiver": "Agregó una persona autorizada a",
  "customers.remove_receiver": "Quitó una persona autorizada de",
  "customers.rename_zone": "Renombró la zona",
  "customers.deactivate_zone": "Desactivó la zona",
  "customers.reactivate_zone": "Reactivó la zona",
  "migration.import_sheet": "Importó la hoja",
  "migration.convert_customers": "Pasó al sistema los clientes de la hoja",
  "migration.convert_products": "Pasó al sistema los productos de la hoja",
  "campaigns.create": "Creó la campaña",
  "campaigns.update": "Editó la campaña",
  "catalog.create_product": "Creó el producto",
  "catalog.update_product": "Editó el producto",
  "catalog.add_presentation": "Agregó una presentación a",
  "catalog.deactivate_product": "Desactivó el producto",
  "catalog.reactivate_product": "Reactivó el producto",
  "catalog.deactivate_presentation": "Desactivó una presentación de",
  "catalog.reactivate_presentation": "Reactivó una presentación de",
  "catalog.save_prices": "Actualizó precios de referencia",
  "migration.import_product_list": "Importó la lista de productos",
  "sales.create_draft": "Creó un borrador de boleta",
  "sales.update_draft": "Editó un borrador de boleta",
  "sales.discard_draft": "Descartó un borrador de boleta",
};

export async function AuditLogTable({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const actor = await requireActor();
  const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
  const list = await listAuditEntries({ auditLog: drizzleAuditLogReader(getDb()) }, actor, {
    page: first(params.page),
    pages: first(params.pages),
  });
  const { items } = list;

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">Todavía no hay cambios registrados.</p>;
  }
  return (
    <div className="flex flex-col gap-4">
      <WideOnly>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-40">Fecha y hora</TableHead>
              <TableHead className="w-48">Usuario</TableHead>
              <TableHead>Cambio</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageRows(list).map((entry) => (
              <TableRow key={entry.id}>
                <TableCell className="text-sm text-muted-foreground tabular-nums">
                  {formatDateTime(entry.occurredAt)}
                </TableCell>
                <TableCell>{entry.actorName ?? "Instalación"}</TableCell>
                <TableCell>
                  <ChangeDescription entry={entry} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </WideOnly>
      <CardList label="Cambios">
        {items.map((entry) => (
          <CardListItem key={entry.id}>
            <span>
              <ChangeDescription entry={entry} />
            </span>
            <span className="text-muted-foreground">
              {entry.actorName ?? "Instalación"} ·{" "}
              <span className="tabular-nums">{formatDateTime(entry.occurredAt)}</span>
            </span>
          </CardListItem>
        ))}
      </CardList>
      <ListPages
        list={list}
        href={(paging) => listHref(AUDIT_PATH, {}, paging)}
        noun={["cambio", "cambios"]}
      />
    </div>
  );
}

function ChangeDescription({ entry }: { entry: AuditLogEntry }) {
  return (
    <>
      {ACTION_LABELS[entry.action] ?? entry.action}{" "}
      {entry.entityLabel && entry.action !== "identity.change_own_password" && (
        <span className="font-medium">
          {entry.entityType === "role" && isRole(entry.entityLabel)
            ? ROLE_LABELS[entry.entityLabel]
            : entry.entityLabel}
        </span>
      )}
    </>
  );
}
