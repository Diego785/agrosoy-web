"use client";

import { MenuIcon, XIcon } from "lucide-react";
import { useState, type MouseEvent, type ReactNode } from "react";
import { AgrosoilLogo } from "./brand/agrosoil-logo";
import { Button } from "./ui/button";
import { Sheet, SheetClose, SheetContent, SheetTitle, SheetTrigger } from "./ui/sheet";

/** Below `md` the sidebar is hidden; the same navigation opens in a drawer from the ☰ button. */
export function MobileNavigation({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  // Following a link leaves the drawer open over the new page unless it closes here.
  function closeOnLink(event: MouseEvent<HTMLDivElement>) {
    if (event.target instanceof Element && event.target.closest("a")) setOpen(false);
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={<Button variant="ghost" size="icon" className="md:hidden" aria-label="Abrir menú" />}
      >
        <MenuIcon aria-hidden />
      </SheetTrigger>
      <SheetContent className="border-sidebar-border bg-sidebar text-sidebar-foreground">
        <div className="flex items-center justify-between px-4 pt-5 pb-4">
          <SheetTitle className="sr-only">Agrosoil</SheetTitle>
          <AgrosoilLogo className="h-11" />
          <SheetClose
            render={
              <Button
                variant="ghost"
                size="icon"
                aria-label="Cerrar menú"
                className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              />
            }
          >
            <XIcon aria-hidden />
          </SheetClose>
        </div>
        <div className="flex-1 overflow-y-auto pb-4" onClick={closeOnLink}>
          {children}
        </div>
      </SheetContent>
    </Sheet>
  );
}
