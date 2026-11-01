"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "cn";

export type NavigationLink = { label: string; href: string; icon: ReactNode };

/** The module list, with the current module highlighted (its own pages count, e.g. /users/new). */
export function NavigationLinks({ links }: { links: NavigationLink[] }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Módulos" className="flex flex-col gap-1 p-3">
      {links.map(({ label, href, icon }) => {
        const current =
          href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={current ? "page" : undefined}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-muted",
              current && "bg-muted font-medium",
            )}
          >
            {icon}
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
