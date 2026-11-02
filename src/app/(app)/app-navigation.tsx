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

export function AppNavigationSkeleton() {
  return (
    <div className="flex flex-col gap-2 px-3 py-2" aria-hidden>
      {[0, 1, 2, 3].map((item) => (
        <div key={item} className="h-9 w-full animate-pulse rounded-lg bg-sidebar-accent/60" />
      ))}
    </div>
  );
}

export async function AppUserMenu({ placement }: { placement: UserMenuPlacement }) {
  const user = await getCurrentUser();
  if (!user) return null;
  return <UserMenu name={user.actor.name} roleLabel={ROLE_LABELS[user.actor.role]} placement={placement} />;
}
