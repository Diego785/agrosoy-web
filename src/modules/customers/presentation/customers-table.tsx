import Link from "next/link";
import { requireActor } from "@/modules/identity/presentation/current-user";
import { can } from "@/shared/application/permissions";
import { getDb } from "@/shared/infrastructure/db/client";
import { buttonVariants } from "@/shared/presentation/ui/button";
import { Input } from "@/shared/presentation/ui/input";
import { NativeSelect, NativeSelectOption } from "@/shared/presentation/ui/native-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/presentation/ui/table";
import { listZones, searchCustomers } from "../application/customer-use-cases";
import { formatCustomerCode } from "../domain/customer";
import { customerDeps } from "./customer-deps";
import { CUSTOMERS_PATH, editCustomerPath } from "./customer-routes";

type SearchParams = Record<string, string | string[] | undefined>;

export async function CustomersTable({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const actor = await requireActor();
  const deps = customerDeps(getDb());
  const text = firstValue(params.q)?.trim() ?? "";
  const zoneId = firstValue(params.zone) || undefined;

  const [{ items, total, page, pageSize }, zones] = await Promise.all([
    searchCustomers(deps, actor, { text, zoneId, page: firstValue(params.page) }),
    listZones(deps, actor),
  ]);
  const canEdit = can(actor, "customers.manage");
  const lastPage = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="flex flex-col gap-4">
      {/* A plain GET form: works before JavaScript loads and the URL can be shared. */}
      <form action={CUSTOMERS_PATH} className="flex flex-wrap gap-2">
        <Input
          name="q"
          defaultValue={text}
          placeholder="Nombre, código o NIT/CI"
          aria-label="Buscar cliente"
          className="max-w-xs"
        />
        {zones.length > 0 && (
          <NativeSelect name="zone" defaultValue={zoneId ?? ""} aria-label="Zona">
            <NativeSelectOption value="">Todas las zonas</NativeSelectOption>
            {zones.map((zone) => (
              <NativeSelectOption key={zone.id} value={zone.id}>
                {zone.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        )}
        <button type="submit" className={buttonVariants({ variant: "outline" })}>
          Buscar
        </button>
      </form>

      {items.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          {text || zoneId
            ? "Ningún cliente coincide con la búsqueda."
            : "Todavía no hay clientes registrados."}
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-20">Código</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>NIT / CI</TableHead>
              <TableHead>Zona</TableHead>
              <TableHead>Técnico</TableHead>
              <TableHead>Teléfono</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((customer) => (
              <TableRow key={customer.id}>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {formatCustomerCode(customer.code)}
                </TableCell>
                <TableCell className="font-medium">
                  {canEdit ? (
                    <Link href={editCustomerPath(customer.id)} className="hover:underline">
                      {customer.name}
                    </Link>
                  ) : (
                    customer.name
                  )}
                </TableCell>
                <TableCell>{customer.taxId ?? "—"}</TableCell>
                <TableCell>{customer.zoneName ?? "—"}</TableCell>
                <TableCell>{customer.technicianName ?? "—"}</TableCell>
                <TableCell>{customer.phone ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <footer className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{total === 1 ? "1 cliente" : `${total.toLocaleString("es-BO")} clientes`}</span>
        {lastPage > 1 && (
          <nav className="flex items-center gap-2" aria-label="Páginas">
            {page > 1 && <PageLink params={{ q: text, zone: zoneId }} page={page - 1} label="Anterior" />}
            <span>
              Página {page} de {lastPage}
            </span>
            {page < lastPage && (
              <PageLink params={{ q: text, zone: zoneId }} page={page + 1} label="Siguiente" />
            )}
          </nav>
        )}
      </footer>
    </div>
  );
}

function PageLink({
  params,
  page,
  label,
}: {
  params: { q: string; zone?: string };
  page: number;
  label: string;
}) {
  const query = new URLSearchParams({
    ...(params.q && { q: params.q }),
    ...(params.zone && { zone: params.zone }),
    page: String(page),
  });
  return (
    <Link href={`${CUSTOMERS_PATH}?${query}`} className={buttonVariants({ variant: "ghost", size: "sm" })}>
      {label}
    </Link>
  );
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function CustomersTableSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-busy="true" aria-label="Cargando clientes">
      <div className="h-8 max-w-md animate-pulse rounded-md bg-muted" />
      {Array.from({ length: 6 }, (_, row) => (
        <div key={row} className="h-10 animate-pulse rounded-md bg-muted/60" />
      ))}
    </div>
  );
}
