"use client";

import { FileDownIcon, Share2Icon } from "lucide-react";
import { buttonVariants } from "./ui/button";

/**
 * Opens the server-made PDF, or hands it to the phone's share sheet (WhatsApp included) where the
 * browser can share files; elsewhere sharing falls back to opening it (D12).
 */
export function PdfActions({ href, fileName }: { href: string; fileName: string }) {
  async function share() {
    try {
      const response = await fetch(href);
      if (response.ok) {
        const file = new File([await response.blob()], fileName, { type: "application/pdf" });
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file], title: fileName });
          return;
        }
      }
    } catch (error) {
      // Closing the share sheet is not a failure.
      if (error instanceof DOMException && error.name === "AbortError") return;
    }
    window.open(href, "_blank", "noopener");
  }

  return (
    <div className="flex gap-2 print:hidden">
      <a
        href={href}
        target="_blank"
        rel="noopener"
        className={buttonVariants({ variant: "outline", size: "sm" })}
      >
        <FileDownIcon aria-hidden /> PDF
      </a>
      <button type="button" onClick={share} className={buttonVariants({ variant: "outline", size: "sm" })}>
        <Share2Icon aria-hidden /> Compartir
      </button>
    </div>
  );
}
