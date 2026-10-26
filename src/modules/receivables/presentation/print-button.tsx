"use client";

import { PrinterIcon } from "lucide-react";
import { Button } from "@/shared/presentation/ui/button";

/** Prints the page or saves it as PDF from the browser's dialog; server-side PDFs come in week 3 (D12). */
export function PrintButton() {
  return (
    <Button type="button" variant="outline" className="print:hidden" onClick={() => window.print()}>
      <PrinterIcon aria-hidden /> Imprimir o guardar PDF
    </Button>
  );
}
