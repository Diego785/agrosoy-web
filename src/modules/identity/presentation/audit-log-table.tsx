import { HistoryIcon } from "lucide-react";
import { getDb } from "@/shared/infrastructure/db/client";
import { EmptyState } from "@/shared/presentation/empty-state";
import { formatDateTime } from "@/shared/presentation/format";
import { Badge } from "@/shared/presentation/ui/badge";
import { CardList, CardListItem, WideOnly } from "@/shared/presentation/responsive-list";
import { ListPages, listHref, pageRows } from "@/shared/presentation/list-pages";
import { ROLE_LABELS } from "@/shared/presentation/role-labels";
import { ListFooterSkeleton, Loading, Skeleton, TableSkeleton } from "@/shared/presentation/skeletons";
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
  "migration.convert_sales": "Pasó al sistema las ventas y pagos de la hoja",
  "migration.undo_sales": "Deshizo el paso de ventas y pagos de la hoja",
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
  "sales.confirm": "Confirmó la boleta N.º",
  "sales.void": "Anuló la boleta N.º",
  "sales.set_next_number": "Fijó la numeración de boletas desde el N.º",
  "sales.register_return": "Registró la devolución N.º",
  "sales.register_transfer": "Registró el traspaso N.º",
  "collections.record_payment": "Registró el recibo N.º",
  "collections.void_payment": "Anuló el recibo N.º",
  "collections.record_charge": "Registró un cargo a",
  "collections.void_charge": "Anuló un cargo de",
  "collections.set_daily_rate": "Registró el tipo de cambio del día",
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
    return <EmptyState icon={<HistoryIcon />} title="Todavía no hay cambios registrados" />;
  }
  return (
    <div className="flex flex-col gap-4">
      <WideOnly>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-44">Fecha y hora</TableHead>
              <TableHead className="w-48">Usuario</TableHead>
              <TableHead className="w-32">Área</TableHead>
              <TableHead>Cambio</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageRows(list).map((entry) => (
              <TableRow key={entry.id}>
                <TableCell className="text-xs text-muted-foreground tabular-nums">
                  {formatDateTime(entry.occurredAt)}
                </TableCell>
                <TableCell>
                  <ActorName entry={entry} />
                </TableCell>
                <TableCell>
                  <AreaBadge action={entry.action} />
                </TableCell>
                <TableCell className="whitespace-normal">
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
            <div className="flex items-center justify-between gap-3">
              <AreaBadge action={entry.action} />
              <span className="text-xs text-muted-foreground tabular-nums">
                {formatDateTime(entry.occurredAt)}
              </span>
            </div>
            <span>
              <ChangeDescription entry={entry} />
            </span>
            <span className="text-xs">
              <ActorName entry={entry} />
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

/** The change log while it loads, laid out like `AuditLogTable`. */
export function AuditLogTableSkeleton() {
  return (
    <Loading label="Cargando registro de cambios">
      <TableSkeleton
        columns={[
          { shape: "short", className: "w-44" },
          { shape: "text", className: "w-48" },
          { shape: "badge", className: "w-32" },
          { shape: "text" },
        ]}
      />
      {/* Built here instead of `CardListSkeleton`: each card starts with the area badge and the time. */}
      <ul aria-hidden className="divide-y overflow-hidden rounded-xl border bg-card shadow-xs md:hidden">
        {Array.from({ length: 5 }, (_, row) => (
          <li key={row} className="flex flex-col gap-1.5 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/3" />
          </li>
        ))}
      </ul>
      <ListFooterSkeleton />
    </Loading>
  );
}

/** The part of the system an action belongs to, read from its code ("catalog.save_prices"). */
const AREA_LABELS: Record<string, string> = {
  identity: "Usuarios",
  customers: "Clientes",
  campaigns: "Campañas",
  catalog: "Catálogo",
  sales: "Boletas",
  collections: "Cobros",
  migration: "Importación",
};

function AreaBadge({ action }: { action: string }) {
  const area = action.split(".")[0] ?? "";
  return <Badge variant="neutral">{AREA_LABELS[area] ?? area}</Badge>;
}

function ActorName({ entry }: { entry: AuditLogEntry }) {
  return entry.actorName ? (
    <span className="font-medium">{entry.actorName}</span>
  ) : (
    <span className="text-muted-foreground">Instalación</span>
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
