"use client";

import { ChevronDownIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/shared/presentation/ui/button";
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

export function UserMenu({ name, roleLabel }: { name: string; roleLabel: string }) {
  const router = useRouter();

  async function signOut() {
    await authClient.signOut();
    router.replace(LOGIN_PATH);
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" className="gap-1" />}>
        <span className="max-w-40 truncate">{name}</span>
        <ChevronDownIcon className="size-4" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>
            <span className="block truncate font-medium text-foreground">{name}</span>
            <span className="block text-xs font-normal">{roleLabel}</span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href={CHANGE_PASSWORD_PATH} />}>Cambiar contraseña</DropdownMenuItem>
        <DropdownMenuItem onClick={signOut}>Cerrar sesión</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
