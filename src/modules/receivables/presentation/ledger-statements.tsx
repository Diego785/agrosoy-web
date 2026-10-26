import Link from "next/link";
import { notFound } from "next/navigation";
import { campaignLabel } from "@/modules/campaigns/presentation/campaign-labels";
import { technicianOptions } from "@/modules/customers/application/customer-use-cases";
import { customerDeps } from "@/modules/customers/presentation/customer-deps";
import { customerPath } from "@/modules/customers/presentation/customer-routes";
import { requireActor } from "@/modules/identity/presentation/current-user";
import { isDomainError } from "@/shared/domain/domain-error";
import { getDb } from "@/shared/infrastructure/db/client";
import { todayInBolivia } from "@/shared/presentation/business-date";
import { formatDate } from "@/shared/presentation/format";
import { PdfActions } from "@/shared/presentation/pdf-actions";
import { buttonVariants } from "@/shared/presentation/ui/button";
import { NativeSelect, NativeSelectOption } from "@/shared/presentation/ui/native-select";
import { customerStatement, portfolioStatement } from "../application/statement-use-cases";
import { CustomerStatement } from "./customer-statement";
import { PortfolioStatement } from "./portfolio-statement";
import { statementDeps as deps } from "./statement-deps";
import { STATEMENTS_PATH, customerStatementPath, customerStatementPdfPath } from "./statement-routes";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** All customers' debt from the ledger, filtered by campaign and technician. */
export async function LedgerPortfolio({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const actor = await requireActor();
  const campaignId = first(params.campaign);
  const [statement, technicians] = await Promise.all([
    portfolioStatement(deps(), actor, {
      campaignId,
      technicianId: first(params.technician),
      status: first(params.status),
    }),
    technicianOptions(customerDeps(getDb()), actor),
  ]);
  const campaign = statement.campaigns.find((option) => option.id === campaignId);

  return (
    <div className="flex flex-col gap-6">
      <form action={STATEMENTS_PATH} className="flex flex-wrap gap-2 print:hidden">
        <NativeSelect name="campaign" defaultValue={campaign?.id ?? ""} aria-label="Campaña">
          <NativeSelectOption value="">Todas las campañas</NativeSelectOption>
          {statement.campaigns.map((option) => (
            <NativeSelectOption key={option.id} value={option.id}>
              {campaignLabel(option)}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <NativeSelect name="technician" defaultValue={statement.technicianId ?? "all"} aria-label="Técnico">
          <NativeSelectOption value="all">Todos los técnicos</NativeSelectOption>
          {technicians.map((technician) => (
            <NativeSelectOption key={technician.id} value={technician.id}>
              Cartera de {technician.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <NativeSelect name="status" defaultValue={first(params.status) ?? "all"} aria-label="Estado">
          <NativeSelectOption value="all">Todos los clientes</NativeSelectOption>
          <NativeSelectOption value="owing">Solo con deuda</NativeSelectOption>
        </NativeSelect>
        <button type="submit" className={buttonVariants({ variant: "outline" })}>
          Filtrar
        </button>
      </form>
      <p className="text-sm text-muted-foreground">
        {campaign ? `Campaña ${campaignLabel(campaign)}` : "Todas las campañas"} · al{" "}
        {formatDate(todayInBolivia())}
      </p>
      {statement.customers.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          No hay movimientos con estos filtros. Las boletas confirmadas y los pagos aparecen aquí.
        </p>
      ) : (
        <PortfolioStatement
          statement={statement}
          customerHref={(customerId) => customerStatementPath(customerId, campaign?.id)}
        />
      )}
    </div>
  );
}

/** One customer's statement from the ledger, for every campaign or one. */
export async function LedgerCustomerStatement({
  params,
  searchParams,
}: {
  params: Promise<{ customerId: string }>;
  searchParams: SearchParams;
}) {
  const [{ customerId }, query] = await Promise.all([params, searchParams]);
  const actor = await requireActor();
  const campaignId = first(query.campaign);
  const statement = await customerStatement(deps(), actor, customerId, { campaignId }).catch(
    (error: unknown) => {
      if (isDomainError(error) && (error.code === "NOT_FOUND" || error.code === "VALIDATION_FAILED"))
        notFound();
      throw error;
    },
  );
  const campaign = statement.campaigns.find((option) => option.id === campaignId);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">
            <Link href={customerPath(statement.customerId)} className="hover:underline">
              {statement.customerName}
            </Link>
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {campaign ? `Campaña ${campaignLabel(campaign)}` : "Todas las campañas"} · al{" "}
            {formatDate(todayInBolivia())}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <form action={`${STATEMENTS_PATH}/${statement.customerId}`} className="flex gap-2 print:hidden">
            <NativeSelect name="campaign" defaultValue={campaign?.id ?? ""} aria-label="Campaña">
              <NativeSelectOption value="">Todas las campañas</NativeSelectOption>
              {statement.campaigns.map((option) => (
                <NativeSelectOption key={option.id} value={option.id}>
                  {campaignLabel(option)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <button type="submit" className={buttonVariants({ variant: "outline" })}>
              Ver
            </button>
          </form>
          <PdfActions
            href={customerStatementPdfPath(statement.customerId, campaign?.id)}
            fileName={`estado-de-cuenta-${todayInBolivia()}.pdf`}
          />
        </div>
      </header>
      <CustomerStatement statement={statement} />
    </div>
  );
}
