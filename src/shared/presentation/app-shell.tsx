import type { ReactNode } from "react";
import { MobileNavigation } from "./mobile-navigation";

/**
 * Page chrome. It reads no request data itself, so it prerenders; the navigation and the user
 * menu depend on the session and arrive as slots wrapped in <Suspense> (D9).
 */
export function AppShell({
  navigation,
  userMenu,
  children,
}: {
  navigation: ReactNode;
  userMenu: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-svh flex-1 flex-col">
      <header className="flex h-14 items-center justify-between gap-4 border-b px-4 md:px-6 print:hidden">
        <div className="flex items-center gap-1">
          <MobileNavigation>{navigation}</MobileNavigation>
          <span className="text-lg font-semibold tracking-tight">Agrosoil</span>
        </div>
        {userMenu}
      </header>
      <div className="flex flex-1">
        <aside className="hidden w-56 shrink-0 border-r md:block print:hidden">{navigation}</aside>
        <main className="flex min-w-0 flex-1 flex-col gap-6 px-4 py-6 md:px-8">{children}</main>
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions}
    </header>
  );
}
