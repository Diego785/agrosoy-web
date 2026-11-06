"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useTransition, type FormEvent, type ReactNode } from "react";

/** How long typing must pause before the list follows it. */
export const TYPING_DELAY_MS = 350;

/**
 * A list's filters, applied as they change (D33): a choice at once, typing once it pauses, Enter
 * right away. The filters go in the URL, replacing it, and leave out the page, so a new search
 * starts on page 1. Fields keep what is being typed while results arrive; when the URL changes from
 * elsewhere (the menu, the back button, coming back to the screen) they show it again.
 */
export function LiveFilterForm({
  action,
  className,
  children,
}: {
  /** The list's path. */
  action: string;
  className?: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const form = useRef<HTMLFormElement>(null);
  const typing = useRef<ReturnType<typeof setTimeout>>(undefined);
  // The filters last asked for, to tell the list's own answer from a change made elsewhere.
  const applied = useRef<string | null>(null);
  const [isSearching, startSearching] = useTransition();

  const apply = useCallback(() => {
    clearTimeout(typing.current);
    typing.current = undefined;
    const element = form.current;
    if (!element) return;
    const query = formFilters(element);
    applied.current = query;
    if (query === urlFilters(element, new URLSearchParams(window.location.search))) return;
    startSearching(() => router.replace(query ? `${action}?${query}` : action, { scroll: false }));
  }, [action, router]);

  useEffect(() => {
    const element = form.current;
    // While typing or waiting for results the fields are ahead of the URL; leave them alone.
    if (!element || isSearching || typing.current) return;
    const shown = urlFilters(element, params);
    if (applied.current === null) {
      // First render: the fields came with this URL, unless one was changed before the page could
      // react to it; then that change is applied instead of lost.
      applied.current = shown;
      if (formFilters(element) !== renderedFilters(element)) apply();
      return;
    }
    if (shown === applied.current) return;
    showFilters(element, params);
    applied.current = shown;
  }, [params, isSearching, apply]);

  useEffect(() => () => clearTimeout(typing.current), []);

  function changed(event: FormEvent<HTMLFormElement>) {
    if (isTyped(event.target)) {
      clearTimeout(typing.current);
      typing.current = setTimeout(apply, TYPING_DELAY_MS);
    } else {
      apply();
    }
  }

  return (
    <form
      ref={form}
      action={action}
      role="search"
      className={className}
      onChange={changed}
      onSubmit={(event) => {
        event.preventDefault();
        apply();
      }}
    >
      {children}
      <span aria-live="polite" className="self-center text-sm text-muted-foreground">
        {isSearching ? "Buscando…" : ""}
      </span>
    </form>
  );
}

function isTyped(target: EventTarget) {
  return target instanceof HTMLInputElement && ["text", "search"].includes(target.type);
}

function fields(form: HTMLFormElement) {
  return Array.from(form.elements).filter(
    (element): element is HTMLInputElement | HTMLSelectElement =>
      (element instanceof HTMLInputElement || element instanceof HTMLSelectElement) && element.name !== "",
  );
}

function filters(entries: [string, string | null][]) {
  const query = new URLSearchParams();
  for (const [name, value] of entries) if (value?.trim()) query.set(name, value.trim());
  return query.toString();
}

/** What the fields ask for, as a query. */
function formFilters(form: HTMLFormElement) {
  return filters(fields(form).map((field) => [field.name, field.value]));
}

/** What the fields asked for as the page arrived. */
function renderedFilters(form: HTMLFormElement) {
  return filters(
    fields(form).map((field) => [
      field.name,
      field instanceof HTMLSelectElement
        ? ((Array.from(field.options).find((option) => option.defaultSelected) ?? field.options[0])?.value ??
          "")
        : field.defaultValue,
    ]),
  );
}

/** The same filters as the URL has them, paging left out. */
function urlFilters(form: HTMLFormElement, params: URLSearchParams) {
  return filters(fields(form).map((field) => [field.name, params.get(field.name)]));
}

/** Puts the URL's filters in the fields; a choice missing from the URL shows its first option. */
function showFilters(form: HTMLFormElement, params: URLSearchParams) {
  for (const field of fields(form)) {
    const value = params.get(field.name);
    if (field instanceof HTMLSelectElement) {
      field.selectedIndex = Math.max(
        0,
        Array.from(field.options).findIndex((option) => option.value === value),
      );
    } else {
      field.value = value ?? "";
    }
  }
}
