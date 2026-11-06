import Link from "next/link";
import type { Paged, Paging } from "@/shared/application/pagination";
import { MAX_PAGES } from "@/shared/application/pagination";
import { formatCount } from "./format";
import { LoadMoreOnScroll } from "./load-more-on-scroll";
import { buttonVariants } from "./ui/button";

/** The rows of the page a table shows; a phone may have appended more pages after them. */
export function pageRows<T>(list: Paged<T>): T[] {
  return list.items.slice(0, list.pageSize);
}

/**
 * Below a paged list (D32). Wide screens get "Anterior / Siguiente"; phones append the next page
 * when the end of the list comes into view. `href` builds the list's URL, filters included.
 */
export function ListPages({
  list,
  href,
  noun,
}: {
  list: Paged<unknown>;
  href: (paging: Partial<Paging>) => string;
  /** Singular and plural: ["cliente", "clientes"]. */
  noun: [string, string];
}) {
  const { total, page, pages, pageSize } = list;
  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const count = `${formatCount(total)} ${total === 1 ? noun[0] : noun[1]}`;
  const loadedUntil = Math.min(total, (page - 1 + pages) * pageSize);

  return (
    <>
      <footer className="hidden items-center justify-between gap-4 text-sm text-muted-foreground md:flex">
        <span>
          {lastPage > 1
            ? `${formatCount(first)}–${formatCount(Math.min(total, page * pageSize))} de ${count}`
            : count}
        </span>
        {lastPage > 1 && (
          <nav className="flex items-center gap-2" aria-label="Páginas">
            {page > 1 && <PageLink href={href({ page: page - 1 })} label="Anterior" />}
            <span>
              Página {page} de {lastPage}
            </span>
            {page < lastPage && <PageLink href={href({ page: page + 1 })} label="Siguiente" />}
          </nav>
        )}
      </footer>
      <footer className="flex flex-col items-center gap-1 text-sm text-muted-foreground md:hidden">
        {loadedUntil < total &&
          (pages < MAX_PAGES ? (
            <LoadMoreOnScroll href={href({ page, pages: pages + 1 })} />
          ) : (
            <PageLink href={href({ page: page + pages })} label="Siguientes" />
          ))}
        <span>
          {page > 1 || loadedUntil < total ? `${formatCount(first)}–${formatCount(loadedUntil)} de ` : ""}
          {count}
        </span>
        {page > 1 && <PageLink href={href({ page: 1 })} label="Volver al inicio" />}
      </footer>
    </>
  );
}

function PageLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className={buttonVariants({ variant: "ghost", size: "sm" })}>
      {label}
    </Link>
  );
}

/** The list's URL with its filters and the paging; defaults are left out. */
export function listHref(path: string, filters: Record<string, string | undefined>, paging: Partial<Paging>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value) query.set(key, value);
  if (paging.page && paging.page > 1) query.set("page", String(paging.page));
  if (paging.pages && paging.pages > 1) query.set("pages", String(paging.pages));
  const text = query.toString();
  return text ? `${path}?${text}` : path;
}
