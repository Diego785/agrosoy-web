import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { customerStatementPath } from "@/modules/receivables/presentation/statement-routes";
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
    <div className="flex max-w-4xl flex-col gap-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">{customer.name}</h2>
          <p className="mt-1 font-mono text-sm text-muted-foreground">
            Código {formatCustomerCode(customer.code)}
            {!customer.isActive && (
              <Badge variant="destructive" className="ml-2 font-sans">
                Desactivado
              </Badge>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          {can(actor, "statements.view") && (
            <Link
              href={customerStatementPath(customer.id)}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Estado de cuenta
            </Link>
          )}
          {canEdit && (
            <Link
              href={editCustomerPath(customer.id)}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Editar datos
            </Link>
          )}
          {canEdit && (
            <CustomerStatusButton customerId={customer.id} name={customer.name} active={customer.isActive} />
          )}
        </div>
      </header>

      <dl className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
        <Item label="NIT o CI">{customer.taxId}</Item>
        <Item label="Teléfono">{customer.phone}</Item>
        <Item label="Zona">{customer.zoneName}</Item>
        <Item label="Técnico de venta">{customer.technicianName}</Item>
        <Item label="Tipo de cambio">
          {customer.exchangeRateKind === "fixed" && customer.fixedExchangeRate
            ? `Fijo, ${formatRate(customer.fixedExchangeRate)} Bs por US$`
            : "Del día del pago"}
        </Item>
        <Item label="Notas">{customer.notes}</Item>
      </dl>

      <Section title="Propiedades">
        {customer.properties.length === 0 ? (
          <Empty>Sin propiedades registradas.</Empty>
        ) : (
          <ul className="divide-y rounded-lg border">
            {customer.properties.map((property) => (
              <li key={property.id} className="flex items-center justify-between gap-4 px-4 py-2 text-sm">
                <span>
                  <span className="font-medium">{property.name}</span>
                  {property.location && (
                    <span className="block text-muted-foreground">{property.location}</span>
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
        {canEdit && <AddPropertyForm customerId={customer.id} />}
      </Section>

      <Section title="Personas autorizadas para recibir">
        {customer.receivers.length === 0 ? (
          <Empty>Nadie más que el cliente está registrado para recibir.</Empty>
        ) : (
          <ul className="divide-y rounded-lg border">
            {customer.receivers.map((receiver) => (
              <li key={receiver.id} className="flex items-center justify-between gap-4 px-4 py-2 text-sm">
                <span>
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
        {canEdit && <AddReceiverForm customerId={customer.id} />}
      </Section>

      <Section title="Historial de cartera">
        {customer.assignments.length === 0 ? (
          <Empty>Todavía no tuvo técnico asignado.</Empty>
        ) : (
          <ul className="divide-y rounded-lg border text-sm">
            {customer.assignments.map((assignment, index) => (
              <li key={index} className="flex justify-between gap-4 px-4 py-2">
                <span className="font-medium">{assignment.technicianName}</span>
                <span className="text-muted-foreground">
                  desde {formatDateTime(assignment.startsAt)}
                  {assignment.endsAt ? ` hasta ${formatDateTime(assignment.endsAt)}` : " (actual)"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

function Item({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{children || "—"}</dd>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-sm font-medium">{title}</h3>
      {children}
    </section>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}
