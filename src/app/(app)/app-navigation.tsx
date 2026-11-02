import {
  ClipboardListIcon,
  FileSpreadsheetIcon,
  HistoryIcon,
  LayoutDashboardIcon,
  PackageIcon,
  SproutIcon,
  TagsIcon,
  UserCogIcon,
  UsersRoundIcon,
  WalletIcon,
  type LucideIcon,
} from "lucide-react";
import { getCurrentUser, requireActor } from "@/modules/identity/presentation/current-user";
import { UserMenu } from "@/modules/identity/presentation/user-menu";
import { can, type Permission } from "@/shared/application/permissions";
import type { UserMenuPlacement } from "@/shared/presentation/app-shell";
import { NavigationLinks, type NavigationSection } from "@/shared/presentation/navigation-links";
import { ROLE_LABELS } from "@/shared/presentation/role-labels";
import { Skeleton } from "@/shared/presentation/skeletons";

type NavigationItem = { label: string; href: string; icon: LucideIcon; permission?: Permission };

/** Only modules that already work are listed; each appears as it is delivered. */
const NAVIGATION: readonly { title?: string; items: readonly NavigationItem[] }[] = [
  { items: [{ label: "Inicio", href: "/", icon: LayoutDashboardIcon }] },
  {
    title: "Ventas",
    items: [
      { label: "Boletas", href: "/notes", icon: ClipboardListIcon, permission: "notes.view" },
      { label: "Clientes", href: "/customers", icon: UsersRoundIcon, permission: "customers.view" },
    ],
  },
  {
    title: "Catálogo",
    items: [
      { label: "Productos", href: "/products", icon: PackageIcon, permission: "catalog.view" },
      { label: "Precios", href: "/prices", icon: TagsIcon, permission: "catalog.view" },
      { label: "Campañas", href: "/campaigns", icon: SproutIcon, permission: "catalog.view" },
    ],
  },
  {
    title: "Cobranzas",
    items: [
      { label: "Estados de cuenta", href: "/statements", icon: WalletIcon, permission: "statements.view" },
      {
        label: "Importar planillas",
        href: "/imports",
        icon: FileSpreadsheetIcon,
        permission: "imports.manage",
      },
    ],
  },
  {
    title: "Administración",
    items: [
      { label: "Usuarios", href: "/users", icon: UserCogIcon, permission: "users.manage" },
      { label: "Registro de cambios", href: "/audit", icon: HistoryIcon, permission: "audit.view" },
    ],
  },
];

export async function AppNavigation() {
  const actor = await requireActor({ allowPendingPasswordChange: true });
  // Icons are rendered here: a component can't be passed to a client component, an element can.
  const sections: NavigationSection[] = NAVIGATION.map(({ title, items }) => ({
    title,
    links: items
      .filter((item) => !item.permission || can(actor, item.permission))
      .map(({ label, href, icon: Icon }) => ({
        label,
        href,
        icon: <Icon className="size-[1.1rem]" aria-hidden />,
      })),
  })).filter((section) => section.links.length > 0);
  return <NavigationLinks sections={sections} />;
}

/** The sections while the permissions load, laid out like `NavigationLinks` in the sidebar's colors. */
export function AppNavigationSkeleton() {
  return (
    <div className="flex flex-col gap-5 px-3 py-2" aria-hidden>
      {NAVIGATION.map(({ title, items }, section) => (
        <div key={section} className="flex flex-col gap-0.5">
          {title && (
            <div className="px-3 pb-1">
              <Skeleton className="h-2.5 w-16 bg-sidebar-accent/70" />
            </div>
          )}
          {items.map(({ href }) => (
            <div key={href} className="flex h-9 items-center gap-3 px-3">
              <Skeleton className="size-[1.1rem] shrink-0 bg-sidebar-accent" />
              <Skeleton className="h-3.5 w-24 bg-sidebar-accent" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export async function AppUserMenu({ placement }: { placement: UserMenuPlacement }) {
  const user = await getCurrentUser();
  if (!user) return null;
  return <UserMenu name={user.actor.name} roleLabel={ROLE_LABELS[user.actor.role]} placement={placement} />;
}
