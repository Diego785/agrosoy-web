import Image from "next/image";
import { cn } from "cn";
import logo from "./agrosoil-logo.png";

/** Agrosoil's logo as the company supplied it (the green oval with "Agro Soil"). */
export function AgrosoilLogo({ className, preload }: { className?: string; preload?: boolean }) {
  return <Image src={logo} alt="Agrosoil" preload={preload} className={cn("h-10 w-auto", className)} />;
}
