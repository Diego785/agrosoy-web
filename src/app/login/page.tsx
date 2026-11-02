import { ClipboardListIcon, PackageIcon, WalletIcon } from "lucide-react";
import type { Metadata } from "next";
import { LoginForm } from "@/modules/identity/presentation/login-form";
import { AgrosoilLogo } from "@/shared/presentation/brand/agrosoil-logo";

export const metadata: Metadata = { title: "Ingresar" };

const HIGHLIGHTS = [
  { icon: ClipboardListIcon, text: "Boletas de entrega desde el campo o la oficina" },
  { icon: WalletIcon, text: "Cobranzas y estados de cuenta al día" },
  { icon: PackageIcon, text: "Productos y precios por campaña" },
];

export default function LoginPage() {
  return (
    <main className="grid flex-1 lg:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden overflow-hidden bg-sidebar text-sidebar-foreground lg:flex lg:flex-col lg:justify-between lg:p-12">
        {/* Soft light from the logo's colors, so the panel isn't a flat block. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(60rem_30rem_at_-10%_110%,color-mix(in_oklch,var(--brand-green-light)_45%,transparent),transparent_60%),radial-gradient(30rem_20rem_at_110%_-10%,color-mix(in_oklch,var(--brand-orange)_30%,transparent),transparent_60%)]"
        />
        <AgrosoilLogo className="relative h-20 self-start" preload />
        <div className="relative flex max-w-md flex-col gap-8">
          <div>
            <h1 className="text-4xl leading-tight font-semibold tracking-tight text-white">
              Todo el campo,
              <br />
              en un solo lugar.
            </h1>
            <p className="mt-3 text-base text-sidebar-foreground/80">
              El sistema de ventas, cobranzas e inventario de Agrosoil.
            </p>
          </div>
          <ul className="flex flex-col gap-3">
            {HIGHLIGHTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-sm">
                <span className="flex size-9 items-center justify-center rounded-lg bg-white/10 text-highlight">
                  <Icon className="size-[1.1rem]" aria-hidden />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-sidebar-foreground/50">AGROSOILBOLIVIA S.R.L.</p>
      </section>
      <section className="flex items-center justify-center p-6">
        <div className="flex w-full max-w-sm flex-col gap-8">
          <AgrosoilLogo className="h-16 self-center lg:hidden" preload />
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Ingresar</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Usa el usuario y la contraseña que te dio administración.
            </p>
          </div>
          <LoginForm />
        </div>
      </section>
    </main>
  );
}
