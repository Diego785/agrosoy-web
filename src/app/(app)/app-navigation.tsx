import { ContactIcon, HomeIcon, UsersIcon, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { getCurrentUser, requireActor } from "@/modules/identity/presentation/current-user";
import { UserMenu } from "@/modules/identity/presentation/user-menu";
import { can, type Permission } from "@/shared/application/permissions";
import { ROLE_LABELS } from "@/shared/presentation/role-labels";

type NavigationItem = { label: string; href: string; icon: LucideIcon; permission?: Permission };

/** Only modules that already work are listed; each appears as it is delivered. */
const NAVIGATION: readonly NavigationItem[] = [
  { label: "Inicio", href: "/", icon: HomeIcon },
  { label: "Clientes", href: "/customers", icon: ContactIcon, permission: "customers.view" },
  { label: "Usuarios", href: "/users", icon: UsersIcon, permission: "users.manage" },
];

export async function AppNavigation() {
  const actor = await requireActor({ allowPendingPasswordChange: true });
  const items = NAVIGATION.filter((item) => !item.permission || can(actor, item.permission));

  return (
    <nav aria-label="Módulos" className="flex gap-1 overflow-x-auto p-2 md:flex-col md:p-3">
      {items.map(({ label, href, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className="flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-muted"
        >
          <Icon className="size-4" aria-hidden />
          {label}
        </Link>
      ))}
    </nav>
  );
}

export function AppNavigationSkeleton() {
  return (
    <div className="flex gap-2 p-2 md:flex-col md:p-3" aria-hidden>
      {[0, 1, 2].map((item) => (
        <div key={item} className="h-9 w-28 animate-pulse rounded-md bg-muted md:w-full" />
      ))}
    </div>
  );
}

export async function AppUserMenu() {
  const user = await getCurrentUser();
  if (!user) return null;
  return <UserMenu name={user.actor.name} roleLabel={ROLE_LABELS[user.actor.role]} />;
}
