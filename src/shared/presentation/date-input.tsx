"use client";

import { CalendarIcon } from "lucide-react";
import { useRef, useState, type Ref } from "react";
import { formatDate, maskTypedDate, parseTypedDate } from "./format";
import { Input } from "./ui/input";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const shownText = (value: string) => (ISO_DATE.test(value) ? formatDate(value) : value);

/**
 * A date always typed and shown as dd/mm/aaaa, whatever the browser's language (a native date
 * input follows it, so an English browser shows mm/dd/yyyy). The form gets "2026-11-01" for a
 * whole, real date, and what was typed otherwise, which the schema rejects. The button opens the
 * browser's calendar.
 */
export function DateInput({
  id,
  name,
  value,
  onChange,
  onBlur,
  invalid,
  disabled,
  ref,
}: {
  id: string;
  name?: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  invalid?: boolean;
  disabled?: boolean;
  ref?: Ref<HTMLInputElement>;
}) {
  const picker = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(() => shownText(value));
  const [lastValue, setLastValue] = useState(value);
  // A value set from outside (a reset, the calendar) replaces what is shown.
  if (value !== lastValue) {
    setLastValue(value);
    if ((parseTypedDate(text) ?? text) !== value) setText(shownText(value));
  }

  function change(typed: string) {
    setText(typed);
    const next = parseTypedDate(typed) ?? typed;
    setLastValue(next);
    onChange(next);
  }

  return (
    <div className="relative">
      <Input
        ref={ref}
        id={id}
        name={name}
        inputMode="numeric"
        autoComplete="off"
        placeholder="dd/mm/aaaa"
        aria-invalid={invalid}
        disabled={disabled}
        selectOnFocus
        className="pr-9 tabular-nums"
        value={text}
        onChange={(event) => change(maskTypedDate(event.target.value))}
        onBlur={() => {
          // "1/11/26" reads as 01/11/2026 once the field is left.
          const iso = parseTypedDate(text);
          if (iso) setText(formatDate(iso));
          onBlur?.();
        }}
      />
      <button
        type="button"
        disabled={disabled}
        aria-label="Elegir en el calendario"
        className="absolute inset-y-0 right-0 flex w-9 items-center justify-center rounded-r-lg text-muted-foreground hover:text-foreground disabled:pointer-events-none"
        onClick={() => {
          const input = picker.current;
          if (!input) return;
          try {
            input.showPicker();
          } catch {
            input.focus();
          }
        }}
      >
        <CalendarIcon className="size-4" aria-hidden />
      </button>
      {/* Only opens the browser's calendar; it is never shown or focused. */}
      <input
        ref={picker}
        type="date"
        tabIndex={-1}
        aria-hidden
        className="pointer-events-none absolute bottom-0 left-0 h-px w-full opacity-0"
        value={ISO_DATE.test(value) ? value : ""}
        onChange={(event) => {
          if (!event.target.value) return;
          setText(formatDate(event.target.value));
          setLastValue(event.target.value);
          onChange(event.target.value);
        }}
      />
    </div>
  );
}
