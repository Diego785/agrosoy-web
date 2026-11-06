import { WalletIcon } from "lucide-react";
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
import { EmptyState } from "@/shared/presentation/empty-state";
import { formatDate } from "@/shared/presentation/format";
import { LiveFilterForm } from "@/shared/presentation/live-filter-form";
import { PdfActions } from "@/shared/presentation/pdf-actions";
import { FiltersSkeleton, Loading, Skeleton } from "@/shared/presentation/skeletons";
import { NativeSelect, NativeSelectOption } from "@/shared/presentation/ui/native-select";
import { customerStatement, portfolioStatement } from "../application/statement-use-cases";
import { CustomerStatement, CustomerStatementSkeleton } from "./customer-statement";
import { PortfolioStatement, PortfolioStatementSkeleton } from "./portfolio-statement";
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
      <LiveFilterForm action={STATEMENTS_PATH} className="flex flex-wrap items-center gap-2 print:hidden">
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
      </LiveFilterForm>
      <p className="text-sm text-muted-foreground">
        {campaign ? `Campaña ${campaignLabel(campaign)}` : "Todas las campañas"} · al{" "}
        {formatDate(todayInBolivia())}
      </p>
      {statement.customers.length === 0 ? (
        <EmptyState icon={<WalletIcon />} title="Sin movimientos con estos filtros">
          Las boletas confirmadas y los cobros aparecen aquí.
        </EmptyState>
      ) : (
        <PortfolioStatement
          statement={statement}
          customerHref={(customerId) => customerStatementPath(customerId, campaign?.id)}
        />
      )}
    </div>
  );
}

/** The portfolio while it loads: filters, the date line and the customers. */
export function LedgerPortfolioSkeleton() {
  return (
    <Loading label="Cargando estados de cuenta" className="gap-6">
      <FiltersSkeleton search={false} selects={3} />
      <Skeleton className="my-0.5 h-4 w-52" />
      <PortfolioStatementSkeleton />
    </Loading>
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
          <h2 className="text-xl font-semibold tracking-tight">
            <Link href={customerPath(statement.customerId)} className="hover:text-primary">
              {statement.customerName}
            </Link>
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {campaign ? `Campaña ${campaignLabel(campaign)}` : "Todas las campañas"} · al{" "}
            {formatDate(todayInBolivia())}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <LiveFilterForm
            action={`${STATEMENTS_PATH}/${statement.customerId}`}
            className="flex items-center gap-2 print:hidden"
          >
            <NativeSelect name="campaign" defaultValue={campaign?.id ?? ""} aria-label="Campaña">
              <NativeSelectOption value="">Todas las campañas</NativeSelectOption>
              {statement.campaigns.map((option) => (
                <NativeSelectOption key={option.id} value={option.id}>
                  {campaignLabel(option)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </LiveFilterForm>
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

/** A customer's statement while it loads: name and date, the campaign filter and the statement. */
export function LedgerCustomerStatementSkeleton() {
  return (
    <Loading label="Cargando estado de cuenta" className="gap-6">
      <div aria-hidden className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-6 w-56 max-w-[60vw]" />
          <Skeleton className="h-4 w-44" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-9 w-36 rounded-lg" />
          <Skeleton className="h-9 w-24 rounded-lg" />
          <Skeleton className="h-9 w-24 rounded-lg" />
        </div>
      </div>
      <CustomerStatementSkeleton />
    </Loading>
  );
}
