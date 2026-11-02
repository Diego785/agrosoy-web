import { describe, expect, it } from "vitest";
import { z } from "zod";
import { MAX_PAGES, PAGE_SIZE, pageWindow, pagingFields } from "./pagination";

const paging = z.object(pagingFields);

describe("paging", () => {
  it("reads the page and how many pages a phone appended, falling back on bad values", () => {
    expect(paging.parse({})).toEqual({ page: 1, pages: 1 });
    expect(paging.parse({ page: "3", pages: "2" })).toEqual({ page: 3, pages: 2 });
    expect(paging.parse({ page: "-1", pages: "x" })).toEqual({ page: 1, pages: 1 });
    expect(paging.parse({ pages: "500" })).toEqual({ page: 1, pages: MAX_PAGES });
  });

  it("reads the rows of those pages", () => {
    expect(pageWindow({ page: 1, pages: 1 })).toEqual({ limit: PAGE_SIZE, offset: 0 });
    expect(pageWindow({ page: 3, pages: 1 })).toEqual({ limit: PAGE_SIZE, offset: 2 * PAGE_SIZE });
    expect(pageWindow({ page: 1, pages: 3 })).toEqual({ limit: 3 * PAGE_SIZE, offset: 0 });
  });
});
