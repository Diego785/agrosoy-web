import {
  CalendarRangeIcon,
  ClipboardListIcon,
  ContactIcon,
  FileSpreadsheetIcon,
  HistoryIcon,
  HomeIcon,
  PackageIcon,
  ReceiptTextIcon,
  UsersIcon,
  WalletIcon,
  type LucideIcon,
} from "lucide-react";
import { getCurrentUser, requireActor } from "@/modules/identity/presentation/current-user";
import { UserMenu } from "@/modules/identity/presentation/user-menu";
import { can, type Permission } from "@/shared/application/permissions";
import { NavigationLinks } from "@/shared/presentation/navigation-links";
import { ROLE_LABELS } from "@/shared/presentation/role-labels";

type NavigationItem = { label: string; href: string; icon: LucideIcon; permission?: Permission };

/** Only modules that already work are listed; each appears as it is delivered. */
const NAVIGATION: readonly NavigationItem[] = [
  { label: "Inicio", href: "/", icon: HomeIcon },
  { label: "Boletas", href: "/notes", icon: ClipboardListIcon, permission: "notes.view" },
  { label: "Cobranzas", href: "/payments", icon: WalletIcon, permission: "payments.manage" },
  { label: "Clientes", href: "/customers", icon: ContactIcon, permission: "customers.view" },
  { label: "Productos", href: "/products", icon: PackageIcon, permission: "catalog.view" },
  { label: "Campañas", href: "/campaigns", icon: CalendarRangeIcon, permission: "catalog.view" },
  { label: "Estados de cuenta", href: "/statements", icon: ReceiptTextIcon, permission: "statements.view" },
  { label: "Importar planillas", href: "/imports", icon: FileSpreadsheetIcon, permission: "imports.manage" },
  { label: "Usuarios", href: "/users", icon: UsersIcon, permission: "users.manage" },
  { label: "Registro de cambios", href: "/audit", icon: HistoryIcon, permission: "audit.view" },
];

export async function AppNavigation() {
  const actor = await requireActor({ allowPendingPasswordChange: true });
  const items = NAVIGATION.filter((item) => !item.permission || can(actor, item.permission));

  // Icons are rendered here: a component can't be passed to a client component, an element can.
  const links = items.map(({ label, href, icon: Icon }) => ({
    label,
    href,
    icon: <Icon className="size-4" aria-hidden />,
  }));
  return <NavigationLinks links={links} />;
}

export function AppNavigationSkeleton() {
  return (
    <div className="flex flex-col gap-2 p-3" aria-hidden>
      {[0, 1, 2].map((item) => (
        <div key={item} className="h-9 w-full animate-pulse rounded-md bg-muted" />
      ))}
    </div>
  );
}

export async function AppUserMenu() {
  const user = await getCurrentUser();
  if (!user) return null;
  return <UserMenu name={user.actor.name} roleLabel={ROLE_LABELS[user.actor.role]} />;
}
