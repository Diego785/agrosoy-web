import { ChevronLeftIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { AgrosoilLogo } from "./brand/agrosoil-logo";
import { MobileNavigation } from "./mobile-navigation";

export type UserMenuPlacement = "sidebar" | "header";

/**
 * Page chrome: Agrosoil's green sidebar on wide screens, a top bar with a drawer on phones. It
 * reads no request data itself, so it prerenders; the navigation and the user menu depend on the
 * session and arrive as slots wrapped in <Suspense> (D9).
 */
export function AppShell({
  navigation,
  userMenu,
  children,
}: {
  navigation: ReactNode;
  userMenu: (placement: UserMenuPlacement) => ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-svh flex-1">
      <aside className="sticky top-0 hidden h-svh w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground md:flex print:hidden">
        <Link href="/" className="flex items-center gap-3 px-5 pt-6 pb-5">
          <AgrosoilLogo className="h-12" preload />
          <span className="text-xs leading-tight text-sidebar-foreground/70">
            Ventas, cobranzas
            <br />e inventario
          </span>
        </Link>
        <div className="flex-1 overflow-y-auto">{navigation}</div>
        <div className="border-t border-sidebar-border p-3">{userMenu("sidebar")}</div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b bg-card/90 px-3 backdrop-blur md:hidden print:hidden">
          <div className="flex items-center gap-1">
            <MobileNavigation>{navigation}</MobileNavigation>
            <Link href="/" aria-label="Inicio">
              <AgrosoilLogo className="h-9" />
            </Link>
          </div>
          {userMenu("header")}
        </header>
        <main className="mx-auto flex w-full max-w-7xl min-w-0 flex-1 flex-col gap-6 px-4 py-6 md:px-10 md:py-9">
          {children}
        </main>
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  back,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  /** The list this page belongs to, shown as "← Clientes" above the title. */
  back?: { href: string; label: string };
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {back && (
          <Link
            href={back.href}
            className="mb-1.5 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary print:hidden"
          >
            <ChevronLeftIcon className="size-4" aria-hidden />
            {back.label}
          </Link>
        )}
        <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-[1.75rem]">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
