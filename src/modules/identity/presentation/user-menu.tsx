"use client";

import { ChevronsUpDownIcon, KeyRoundIcon, LogOutIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "cn";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/presentation/ui/dropdown-menu";
import { authClient } from "./auth-client";
import { CHANGE_PASSWORD_PATH, LOGIN_PATH } from "./identity-routes";

/** "Diego Hurtado" → "DH" */
function initials(name: string) {
  const words = name.trim().split(/\s+/);
  const last = words.length > 1 ? words[words.length - 1] : "";
  return `${words[0]?.[0] ?? ""}${last?.[0] ?? ""}`.toUpperCase();
}

/**
 * Who is signed in. At the foot of the sidebar it shows the name and role; in a phone's top bar,
 * only the initials.
 */
export function UserMenu({
  name,
  roleLabel,
  placement,
}: {
  name: string;
  roleLabel: string;
  placement: "sidebar" | "header";
}) {
  const router = useRouter();

  async function signOut() {
    await authClient.signOut();
    router.replace(LOGIN_PATH);
    router.refresh();
  }

  const inSidebar = placement === "sidebar";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Cuenta de ${name}`}
        className={cn(
          "flex items-center gap-3 rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-ring",
          inSidebar ? "w-full px-2 py-2 hover:bg-sidebar-accent/70" : "p-1 hover:bg-muted",
        )}
      >
        <span
          aria-hidden
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-highlight text-xs font-semibold text-white"
        >
          {initials(name)}
        </span>
        {inSidebar && (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-sidebar-accent-foreground">
                {name}
              </span>
              <span className="block truncate text-xs text-sidebar-foreground/60">{roleLabel}</span>
            </span>
            <ChevronsUpDownIcon className="size-4 text-sidebar-foreground/50" aria-hidden />
          </>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side={inSidebar ? "top" : "bottom"}
        align={inSidebar ? "start" : "end"}
        className="w-56"
      >
        <DropdownMenuGroup>
          <DropdownMenuLabel>
            <span className="block truncate font-medium text-foreground">{name}</span>
            <span className="block text-xs font-normal">{roleLabel}</span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href={CHANGE_PASSWORD_PATH} />}>
          <KeyRoundIcon aria-hidden />
          Cambiar contraseña
        </DropdownMenuItem>
        <DropdownMenuItem onClick={signOut}>
          <LogOutIcon aria-hidden />
          Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
