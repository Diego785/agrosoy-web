import { z } from "zod";

/** Rows per page in every list (D32). */
export const PAGE_SIZE = 20;

/** A phone appends pages while scrolling; past this many (200 rows) it moves on by link instead. */
export const MAX_PAGES = 10;

/**
 * Paging from the URL: `page` is the first page shown and `pages` how many a phone has appended
 * from it. Bad values fall back instead of failing the page.
 */
export const pagingFields = {
  page: z.coerce.number().int().min(1).catch(1),
  pages: z.coerce
    .number()
    .int()
    .min(1)
    .catch(1)
    .transform((pages) => Math.min(pages, MAX_PAGES)),
};

export type Paging = { page: number; pages: number };

export type Paged<T> = Paging & { items: T[]; total: number; pageSize: number };

/** The rows to read for that paging. */
export function pageWindow({ page, pages }: Paging): { limit: number; offset: number } {
  return { limit: PAGE_SIZE * pages, offset: (page - 1) * PAGE_SIZE };
}

export function paged<T>(paging: Paging, result: { items: T[]; total: number }): Paged<T> {
  return { ...result, ...paging, pageSize: PAGE_SIZE };
}
