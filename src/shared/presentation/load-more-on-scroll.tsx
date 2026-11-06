"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useTransition } from "react";

/**
 * At the end of a list on a phone: when it comes into view, the next page is appended by asking
 * for one more page in the URL. The link does the same by hand.
 */
export function LoadMoreOnScroll({ href }: { href: string }) {
  const router = useRouter();
  const sentinel = useRef<HTMLDivElement>(null);
  const [isLoading, startLoading] = useTransition();

  useEffect(() => {
    const element = sentinel.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        startLoading(() => router.replace(href, { scroll: false }));
      },
      { rootMargin: "300px 0px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [href, router]);

  return (
    <div ref={sentinel} className="py-2 text-center">
      <Link href={href} replace scroll={false} className="text-sm font-medium hover:underline">
        {isLoading ? "Cargando…" : "Ver más"}
      </Link>
    </div>
  );
}
