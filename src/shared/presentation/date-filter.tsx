"use client";

import { useRef, useState } from "react";
import { DateInput } from "./date-input";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * A date filter inside a `LiveFilterForm`: typed as dd/mm/aaaa (D31), sent as "2026-11-01". The
 * hidden field is updated in the same event, so the form reads the new date when it applies; while a
 * date is half typed it keeps the last whole one, and clearing the field clears the filter.
 * Give it `key={defaultValue}` so a change of URL from elsewhere starts it again.
 */
export function DateFilter({
  name,
  label,
  defaultValue,
}: {
  name: string;
  label: string;
  defaultValue: string;
}) {
  const hidden = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(defaultValue);
  const id = `filter-${name}`;

  return (
    <div className="w-40">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <DateInput
        id={id}
        value={value}
        onChange={(next) => {
          setValue(next);
          if (!hidden.current) return;
          if (ISO_DATE.test(next)) hidden.current.value = next;
          else if (next.trim() === "") hidden.current.value = "";
        }}
      />
      <input ref={hidden} type="hidden" name={name} defaultValue={defaultValue} />
    </div>
  );
}
