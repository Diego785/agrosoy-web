"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "cn";

export type NavigationLink = { label: string; href: string; icon: ReactNode };
export type NavigationSection = { title?: string; links: NavigationLink[] };

/** The modules in sections, with the current one highlighted (its own pages count, e.g. /users/new). */
export function NavigationLinks({ sections }: { sections: NavigationSection[] }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Módulos" className="flex flex-col gap-5 px-3 py-2">
      {sections.map((section, index) => (
        <div key={section.title ?? index} className="flex flex-col gap-0.5">
          {section.title && (
            <p className="px-3 pb-1 text-[0.7rem] font-semibold tracking-wider text-sidebar-foreground/50 uppercase">
              {section.title}
            </p>
          )}
          {section.links.map(({ label, href, icon }) => {
            const current =
              href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/85 transition-colors hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground [&>svg]:text-sidebar-foreground/60",
                  current &&
                    "bg-sidebar-accent font-medium text-sidebar-accent-foreground before:absolute before:inset-y-2 before:left-0 before:w-1 before:rounded-r-full before:bg-sidebar-primary [&>svg]:text-sidebar-primary",
                )}
              >
                {icon}
                {label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
