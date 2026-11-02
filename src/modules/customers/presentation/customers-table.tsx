import { ChevronRightIcon, UsersRoundIcon } from "lucide-react";
import Link from "next/link";
import { requireActor } from "@/modules/identity/presentation/current-user";
import { getDb } from "@/shared/infrastructure/db/client";
import { EmptyState } from "@/shared/presentation/empty-state";
import { SearchInput } from "@/shared/presentation/search-input";
import { NativeSelect, NativeSelectOption } from "@/shared/presentation/ui/native-select";
import { CardList, CardListItem, WideOnly } from "@/shared/presentation/responsive-list";
import { ListPages, listHref, pageRows } from "@/shared/presentation/list-pages";
import { LiveFilterForm } from "@/shared/presentation/live-filter-form";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/presentation/ui/table";
import { listAllZones, searchCustomers } from "../application/customer-use-cases";
import { formatCustomerCode } from "../domain/customer";
import { customerDeps } from "./customer-deps";
import { CUSTOMERS_PATH, customerPath } from "./customer-routes";

type SearchParams = Record<string, string | string[] | undefined>;

export async function CustomersTable({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const actor = await requireActor();
  const deps = customerDeps(getDb());
  const text = firstValue(params.q)?.trim() ?? "";
  const zoneId = firstValue(params.zone) || undefined;
  const status = firstValue(params.status) === "inactive" ? "inactive" : "active";

  const [list, zones] = await Promise.all([
    searchCustomers(deps, actor, {
      text,
      zoneId,
      status,
      page: firstValue(params.page),
      pages: firstValue(params.pages),
    }),
    listAllZones(deps, actor),
  ]);
  const { items } = list;
  const filters = { q: text, zone: zoneId, status: status === "inactive" ? status : undefined };

  return (
    <div className="flex flex-col gap-4">
      {/* Applied as it changes, with the filters in the URL so it can be shared (D33). */}
      <LiveFilterForm action={CUSTOMERS_PATH} className="flex flex-wrap items-center gap-2">
        <SearchInput
          name="q"
          defaultValue={text}
          placeholder="Nombre, código o NIT/CI"
          aria-label="Buscar cliente"
        />
        {zones.length > 0 && (
          <NativeSelect name="zone" defaultValue={zoneId ?? ""} aria-label="Zona">
            <NativeSelectOption value="">Todas las zonas</NativeSelectOption>
            {zones.map((zone) => (
              <NativeSelectOption key={zone.id} value={zone.id}>
                {zone.isActive ? zone.name : `${zone.name} (desactivada)`}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        )}
        <NativeSelect name="status" defaultValue={status} aria-label="Estado">
          <NativeSelectOption value="active">Activos</NativeSelectOption>
          <NativeSelectOption value="inactive">Desactivados</NativeSelectOption>
        </NativeSelect>
      </LiveFilterForm>

      {items.length === 0 ? (
        <EmptyState
          icon={<UsersRoundIcon />}
          title={
            text || zoneId
              ? "Ningún cliente coincide con la búsqueda."
              : "Todavía no hay clientes registrados."
          }
        >
          {text || zoneId
            ? "Prueba con otro nombre, código o NIT/CI, o quita el filtro de zona."
            : status === "inactive"
              ? "No hay clientes desactivados."
              : "Registra el primero con su zona y su técnico de venta."}
        </EmptyState>
      ) : (
        <>
          <WideOnly>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">Código</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>NIT / CI</TableHead>
                  <TableHead>Zona</TableHead>
                  <TableHead>Técnico</TableHead>
                  <TableHead>Teléfono</TableHead>
                  <TableHead className="w-10">
                    <span className="sr-only">Abrir</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows(list).map((customer) => (
                  <TableRow key={customer.id} className="group relative">
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {formatCustomerCode(customer.code)}
                    </TableCell>
                    <TableCell>
                      {/* The link covers the row, so the whole row opens the customer. */}
                      <Link
                        href={customerPath(customer.id)}
                        className="font-medium group-hover:text-primary after:absolute after:inset-0"
                      >
                        {customer.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground tabular-nums">
                      {customer.taxId ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{customer.zoneName ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{customer.technicianName ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground tabular-nums">
                      {customer.phone ?? "—"}
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
          <CardList label="Clientes">
            {items.map((customer) => (
              <CardListItem key={customer.id} className="relative">
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <Link
                      href={customerPath(customer.id)}
                      className="block truncate font-medium after:absolute after:inset-0"
                    >
                      {customer.name}
                    </Link>
                    <span className="font-mono text-xs text-muted-foreground">
                      {formatCustomerCode(customer.code)}
                    </span>
                  </div>
                  <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                </div>
                <span className="text-muted-foreground">
                  {[customer.zoneName, customer.technicianName].filter(Boolean).join(" · ") ||
                    "Sin zona ni técnico"}
                </span>
                {(customer.taxId || customer.phone) && (
                  <span className="text-muted-foreground tabular-nums">
                    {[customer.taxId && `NIT/CI ${customer.taxId}`, customer.phone]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                )}
              </CardListItem>
            ))}
          </CardList>
        </>
      )}

      <ListPages
        list={list}
        href={(paging) => listHref(CUSTOMERS_PATH, filters, paging)}
        noun={["cliente", "clientes"]}
      />
    </div>
  );
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function CustomersTableSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Cargando clientes">
      <div className="h-9 max-w-md animate-pulse rounded-lg bg-muted" />
      <div className="h-80 animate-pulse rounded-xl bg-muted/60" />
    </div>
  );
}
