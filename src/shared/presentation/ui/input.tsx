import * as React from "react";
import { Input as InputPrimitive } from "@base-ui/react/input";
import { cn } from "cn";

type InputProps = React.ComponentProps<"input"> & {
  /** Amounts, quantities and codes: a tap or click selects the whole value, so typing replaces it. */
  selectOnFocus?: boolean;
};

// Safari and touch browsers clear the selection with the mouseup that follows the focus; that
// first mouseup is cancelled. A later click still places the caret.
const FOCUS_CLICK_MS = 500;

// Server components render this input too, so handlers are only added when asked for: a function
// can't cross from the server to the client primitive.
function selectAllHandlers({ onFocus, onMouseUp }: Pick<InputProps, "onFocus" | "onMouseUp">) {
  return {
    onFocus(event: React.FocusEvent<HTMLInputElement>) {
      onFocus?.(event);
      event.currentTarget.select();
      event.currentTarget.dataset.focusedAt = String(event.timeStamp);
    },
    onMouseUp(event: React.MouseEvent<HTMLInputElement>) {
      onMouseUp?.(event);
      const focusedAt = Number(event.currentTarget.dataset.focusedAt);
      if (focusedAt && event.timeStamp - focusedAt < FOCUS_CLICK_MS) {
        delete event.currentTarget.dataset.focusedAt;
        event.preventDefault();
      }
    },
  };
}

function Input({ className, type, selectOnFocus, onFocus, onMouseUp, ...props }: InputProps) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className,
      )}
      {...(selectOnFocus ? selectAllHandlers({ onFocus, onMouseUp }) : { onFocus, onMouseUp })}
      {...props}
    />
  );
}

export { Input };
