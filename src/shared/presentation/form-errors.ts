import type { FieldValues, Path, UseFormReturn } from "react-hook-form";
import type { ActionError } from "./action-result";
import { errorMessage } from "./error-messages";

/**
 * Puts a failed action's errors on a react-hook-form form: field messages next to their
 * inputs, everything else as a form-level message under `errors.root`.
 */
export function applyActionError<Values extends FieldValues>(
  form: UseFormReturn<Values>,
  error: ActionError,
  messagesByField: Partial<Record<string, string>> = {},
): void {
  if (error.code === "VALIDATION_FAILED" && error.fieldErrors) {
    for (const [field, messages] of Object.entries(error.fieldErrors)) {
      form.setError(field as Path<Values>, { message: messages[0] });
    }
    return;
  }

  const fieldMessage = error.field ? messagesByField[error.field] : undefined;
  if (error.field && fieldMessage) {
    form.setError(error.field as Path<Values>, { message: fieldMessage }, { shouldFocus: true });
    return;
  }

  form.setError("root", { message: errorMessage(error) });
}
