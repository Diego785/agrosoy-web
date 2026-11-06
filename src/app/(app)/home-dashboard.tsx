import {
  ArrowRightIcon,
  ClipboardListIcon,
  PackageIcon,
  PlusIcon,
  SproutIcon,
  UsersRoundIcon,
  WalletIcon,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { listCampaigns } from "@/modules/campaigns/application/campaign-use-cases";
import { campaignOn } from "@/modules/campaigns/domain/campaign";
import { drizzleCampaignRepository } from "@/modules/campaigns/infrastructure/drizzle-campaign-repository";
import { campaignLabel } from "@/modules/campaigns/presentation/campaign-labels";
import { CAMPAIGNS_PATH } from "@/modules/campaigns/presentation/campaign-routes";
import { productsPage } from "@/modules/catalog/application/catalog-use-cases";
import { catalogDeps } from "@/modules/catalog/presentation/catalog-deps";
import { PRODUCTS_PATH } from "@/modules/catalog/presentation/catalog-routes";
import { searchCustomers } from "@/modules/customers/application/customer-use-cases";
import { customerDeps } from "@/modules/customers/presentation/customer-deps";
import { CUSTOMERS_PATH } from "@/modules/customers/presentation/customer-routes";
import { requireActor } from "@/modules/identity/presentation/current-user";
import { STATEMENTS_PATH } from "@/modules/receivables/presentation/statement-routes";
import { listNotes } from "@/modules/sales/application/note-use-cases";
import { drizzleNoteRepository } from "@/modules/sales/infrastructure/drizzle-note-repository";
import { NEW_NOTE_PATH, NOTES_PATH } from "@/modules/sales/presentation/note-routes";
import { can, type Permission } from "@/shared/application/permissions";
import type { Actor } from "@/shared/application/actor";
import { getDb } from "@/shared/infrastructure/db/client";
import { todayInBolivia } from "@/shared/presentation/business-date";
import { formatCount } from "@/shared/presentation/format";
import { ROLE_LABELS } from "@/shared/presentation/role-labels";
import { FiguresSkeleton, Loading, Skeleton } from "@/shared/presentation/skeletons";

const SHORTCUTS: readonly {
  title: string;
  text: string;
  href: string;
  icon: LucideIcon;
  permission: Permission;
}[] = [
  {
    title: "Nueva boleta",
    text: "Registrar una entrega",
    href: NEW_NOTE_PATH,
    icon: PlusIcon,
    permission: "notes.manage",
  },
  {
    title: "Clientes",
    text: "Buscar o registrar",
    href: CUSTOMERS_PATH,
    icon: UsersRoundIcon,
    permission: "customers.view",
  },
  {
    title: "Productos",
    text: "Presentaciones y precios",
    href: PRODUCTS_PATH,
    icon: PackageIcon,
    permission: "catalog.view",
  },
  {
    title: "Estados de cuenta",
    text: "Lo que debe cada cliente",
    href: STATEMENTS_PATH,
    icon: WalletIcon,
    permission: "statements.view",
  },
];

/** "Buenos días" until noon in Bolivia, "Buenas tardes" until 7 p.m., then "Buenas noches". */
function greeting(now = new Date()) {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", { timeZone: "America/La_Paz", hour: "numeric", hour12: false }).format(
      now,
    ),
  );
  return hour < 12 ? "Buenos días" : hour < 19 ? "Buenas tardes" : "Buenas noches";
}

/** "lunes, 2 de noviembre de 2026" */
function longToday() {
  return new Intl.DateTimeFormat("es-BO", { dateStyle: "full", timeZone: "America/La_Paz" }).format(
    new Date(),
  );
}

export async function HomeDashboard() {
  const actor = await requireActor();
  const shortcuts = SHORTCUTS.filter((shortcut) => can(actor, shortcut.permission));
  const figures = await homeFigures(actor);

  return (
    <div className="flex flex-col gap-8">
      <header className="relative overflow-hidden rounded-2xl bg-sidebar px-6 py-7 text-sidebar-foreground shadow-sm md:px-8">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(40rem_16rem_at_100%_0%,color-mix(in_oklch,var(--brand-orange)_28%,transparent),transparent_65%),radial-gradient(30rem_18rem_at_0%_120%,color-mix(in_oklch,var(--brand-green-light)_40%,transparent),transparent_65%)]"
        />
        <p className="relative text-sm text-sidebar-foreground/70 first-letter:uppercase">{longToday()}</p>
        <h1 className="relative mt-1 text-2xl font-semibold tracking-tight text-white md:text-3xl">
          {greeting()}, {actor.name.split(" ")[0]}
        </h1>
        <p className="relative mt-1 text-sm text-sidebar-foreground/80">
          {ROLE_LABELS[actor.role]}
          {figures.campaign && (
            <>
              {" · Campaña "}
              <span className="font-medium text-white">{figures.campaign}</span>
            </>
          )}
        </p>
      </header>

      {shortcuts.length > 0 && (
        <section aria-label="Accesos directos" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {shortcuts.map(({ title, text, href, icon: Icon }, index) => (
            <Link
              key={href}
              href={href}
              className="group flex items-center gap-4 rounded-xl border bg-card p-4 shadow-xs transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
            >
              <span
                className={
                  index === 0
                    ? "flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground"
                    : "flex size-11 items-center justify-center rounded-xl bg-secondary text-secondary-foreground"
                }
              >
                <Icon className="size-5" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{title}</span>
                <span className="block truncate text-sm text-muted-foreground">{text}</span>
              </span>
              <ArrowRightIcon
                className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
                aria-hidden
              />
            </Link>
          ))}
        </section>
      )}

      {figures.items.length > 0 && (
        <section aria-label="Resumen" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {figures.items.map(({ label, value, note, href, icon: Icon }) => (
            <Link
              key={label}
              href={href}
              className="flex flex-col gap-3 rounded-xl border bg-card p-5 shadow-xs transition-colors hover:border-primary/40"
            >
              <span className="flex items-center justify-between text-sm text-muted-foreground">
                {label}
                <Icon className="size-4 text-highlight" aria-hidden />
              </span>
              <span className="text-3xl font-semibold tracking-tight tabular-nums">{value}</span>
              {note && <span className="text-xs text-muted-foreground">{note}</span>}
            </Link>
          ))}
        </section>
      )}
    </div>
  );
}

/** The home page while it loads: the green greeting, the shortcuts and the figures. */
export function HomeDashboardSkeleton() {
  return (
    <Loading label="Cargando inicio" className="gap-8">
      <div aria-hidden className="flex flex-col gap-2.5 rounded-2xl bg-sidebar px-6 py-7 md:px-8">
        <Skeleton className="h-3.5 w-48 bg-white/15" />
        <Skeleton className="h-8 w-64 bg-white/20" />
        <Skeleton className="h-3.5 w-56 bg-white/15" />
      </div>
      <div aria-hidden className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((index) => (
          <div key={index} className="flex items-center gap-4 rounded-xl border bg-card p-4 shadow-xs">
            <Skeleton className="size-11 shrink-0 rounded-xl" />
            <div className="flex flex-1 flex-col gap-1.5">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-32" />
            </div>
          </div>
        ))}
      </div>
      <FiguresSkeleton />
    </Loading>
  );
}

type Figure = { label: string; value: string; note?: string; href: string; icon: LucideIcon };

/** The counts the home page shows, each only to who may see that list. */
async function homeFigures(actor: Actor): Promise<{ campaign?: string; items: Figure[] }> {
  const db = getDb();
  const [drafts, customers, products, campaigns] = await Promise.all([
    can(actor, "notes.view")
      ? listNotes({ notes: drizzleNoteRepository(db) }, actor, { status: "draft" })
      : undefined,
    can(actor, "customers.view") ? searchCustomers(customerDeps(db), actor, {}) : undefined,
    can(actor, "catalog.view") ? productsPage(catalogDeps(db), actor, {}) : undefined,
    can(actor, "catalog.view")
      ? listCampaigns({ campaigns: drizzleCampaignRepository(db) }, actor)
      : undefined,
  ]);
  const current = campaigns && (campaignOn(campaigns, todayInBolivia()) ?? campaigns[0]);
  const items: Figure[] = [];
  if (drafts)
    items.push({
      label: "Boletas en borrador",
      value: formatCount(drafts.total),
      note: drafts.total > 0 ? "Pendientes de confirmar" : "Ninguna pendiente",
      href: `${NOTES_PATH}?status=draft`,
      icon: ClipboardListIcon,
    });
  if (customers)
    items.push({
      label: "Clientes activos",
      value: formatCount(customers.total),
      href: CUSTOMERS_PATH,
      icon: UsersRoundIcon,
    });
  if (products)
    items.push({
      label: "Productos activos",
      value: formatCount(products.total),
      href: PRODUCTS_PATH,
      icon: PackageIcon,
    });
  if (campaigns)
    items.push({
      label: "Campaña",
      value: current ? campaignLabel(current) : "Sin campaña",
      note: current ? undefined : "Crea la campaña para cargar precios",
      href: CAMPAIGNS_PATH,
      icon: SproutIcon,
    });
  return { campaign: current ? campaignLabel(current) : undefined, items };
}
