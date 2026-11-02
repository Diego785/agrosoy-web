import { MapPinIcon, PencilIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "cn";
import { requireActor } from "@/modules/identity/presentation/current-user";
import { can } from "@/shared/application/permissions";
import { isDomainError } from "@/shared/domain/domain-error";
import { getDb } from "@/shared/infrastructure/db/client";
import { formatDateTime, formatRate } from "@/shared/presentation/format";
import { Badge } from "@/shared/presentation/ui/badge";
import { buttonVariants } from "@/shared/presentation/ui/button";
import { getCustomerDetail } from "../application/customer-use-cases";
import { formatCustomerCode } from "../domain/customer";
import {
  AddPropertyForm,
  AddReceiverForm,
  CustomerStatusButton,
  RemovePropertyButton,
  RemoveReceiverButton,
} from "./customer-contact-forms";
import { customerDeps } from "./customer-deps";
import { editCustomerPath } from "./customer-routes";

export async function CustomerDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requireActor();
  const customer = await getCustomerDetail(customerDeps(getDb()), actor, id).catch((error: unknown) => {
    if (isDomainError(error) && (error.code === "NOT_FOUND" || error.code === "VALIDATION_FAILED"))
      notFound();
    throw error;
  });
  const canEdit = can(actor, "customers.manage");

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <section className="rounded-xl border bg-card shadow-xs">
        <header className="flex flex-wrap items-start justify-between gap-4 p-5">
          <div className="flex min-w-0 items-center gap-4">
            <span
              aria-hidden
              className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-secondary text-base font-semibold text-secondary-foreground"
            >
              {initials(customer.name)}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-semibold tracking-tight">{customer.name}</h2>
                {customer.isActive ? (
                  <Badge variant="success">Activo</Badge>
                ) : (
                  <Badge variant="destructive">Desactivado</Badge>
                )}
              </div>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Código <span className="font-mono">{formatCustomerCode(customer.code)}</span>
              </p>
            </div>
          </div>
          {canEdit && (
            <div className="flex flex-wrap gap-2">
              <Link
                href={editCustomerPath(customer.id)}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                <PencilIcon aria-hidden />
                Editar datos
              </Link>
              <CustomerStatusButton
                customerId={customer.id}
                name={customer.name}
                active={customer.isActive}
              />
            </div>
          )}
        </header>

        <dl className="grid gap-x-8 gap-y-4 border-t p-5 sm:grid-cols-2 lg:grid-cols-3">
          <Fact label="NIT o CI">{customer.taxId}</Fact>
          <Fact label="Teléfono">{customer.phone}</Fact>
          <Fact label="Zona">{customer.zoneName}</Fact>
          <Fact label="Técnico de venta">{customer.technicianName}</Fact>
          <Fact label="Tipo de cambio">
            {customer.exchangeRateKind === "fixed" && customer.fixedExchangeRate
              ? `Fijo, ${formatRate(customer.fixedExchangeRate)} Bs por US$`
              : "Del día del pago"}
          </Fact>
          <Fact label="Notas" className="sm:col-span-2 lg:col-span-3">
            {customer.notes && <span className="font-normal whitespace-pre-line">{customer.notes}</span>}
          </Fact>
        </dl>
      </section>

      <Section
        title="Propiedades"
        count={customer.properties.length}
        footer={canEdit && <AddPropertyForm customerId={customer.id} />}
      >
        {customer.properties.length === 0 ? (
          <Empty>Sin propiedades registradas.</Empty>
        ) : (
          <ul className="divide-y">
            {customer.properties.map((property) => (
              <li key={property.id} className="flex items-center justify-between gap-4 px-5 py-3 text-sm">
                <span className="min-w-0">
                  <span className="font-medium">{property.name}</span>
                  {property.location && (
                    <span className="mt-0.5 flex items-center gap-1 text-muted-foreground">
                      <MapPinIcon className="size-3.5 shrink-0" aria-hidden />
                      {property.location}
                    </span>
                  )}
                </span>
                {canEdit && (
                  <RemovePropertyButton
                    customerId={customer.id}
                    propertyId={property.id}
                    name={property.name}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section
        title="Personas autorizadas para recibir"
        count={customer.receivers.length}
        footer={canEdit && <AddReceiverForm customerId={customer.id} />}
      >
        {customer.receivers.length === 0 ? (
          <Empty>Nadie más que el cliente está registrado para recibir.</Empty>
        ) : (
          <ul className="divide-y">
            {customer.receivers.map((receiver) => (
              <li key={receiver.id} className="flex items-center justify-between gap-4 px-5 py-3 text-sm">
                <span className="min-w-0">
                  <span className="font-medium">{receiver.name}</span>
                  <span className="block text-muted-foreground">
                    {receiver.relationship}
                    {receiver.documentId && ` · CI ${receiver.documentId}`}
                  </span>
                </span>
                {canEdit && (
                  <RemoveReceiverButton
                    customerId={customer.id}
                    receiverId={receiver.id}
                    name={receiver.name}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Historial de cartera">
        {customer.assignments.length === 0 ? (
          <Empty>Todavía no tuvo técnico asignado.</Empty>
        ) : (
          <ul className="divide-y text-sm">
            {customer.assignments.map((assignment, index) => (
              <li
                key={index}
                className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-5 py-3"
              >
                <span className="flex items-center gap-2 font-medium">
                  {assignment.technicianName}
                  {!assignment.endsAt && <Badge variant="success">Actual</Badge>}
                </span>
                <span className="text-muted-foreground tabular-nums">
                  desde {formatDateTime(assignment.startsAt)}
                  {assignment.endsAt && ` hasta ${formatDateTime(assignment.endsAt)}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

/** "Agropecuaria San Juan" → "AS": the profile's mark. */
function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return words
    .slice(0, 2)
    .map((word) => word[0]!.toUpperCase())
    .join("");
}

function Fact({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <div className={cn("min-w-0", className)}>
      <dt className="text-xs tracking-wide text-muted-foreground uppercase">{label}</dt>
      <dd className="mt-1 font-medium">{children || <span className="text-muted-foreground">—</span>}</dd>
    </div>
  );
}

function Section({
  title,
  count,
  footer,
  children,
}: {
  title: string;
  count?: number;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-xl border bg-card shadow-xs">
      <header className="flex items-center gap-2 border-b px-5 py-3.5">
        <h3 className="text-sm font-semibold">{title}</h3>
        {count !== undefined && count > 0 && <Badge variant="neutral">{count}</Badge>}
      </header>
      {children}
      {footer && <div className="border-t bg-muted/30 px-5 py-4">{footer}</div>}
    </section>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="px-5 py-4 text-sm text-muted-foreground">{children}</p>;
}
