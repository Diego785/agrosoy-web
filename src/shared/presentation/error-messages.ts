import type { ActionError } from "./action-result";

/** The one place where domain error codes become Spanish text (D11). */
const MESSAGES: Record<ActionError["code"], string> = {
  INVALID_AMOUNT: "El monto no es válido. Usa punto para los decimales, por ejemplo 1250.50.",
  INVALID_QUANTITY: "La cantidad no es válida. Admite hasta 3 decimales.",
  INVALID_EXCHANGE_RATE: "El tipo de cambio no es válido, por ejemplo 6.96.",
  VALIDATION_FAILED: "Revisa los campos marcados.",
  NOT_FOUND: "No encontramos ese registro. Puede que lo hayan cambiado; recarga la página.",
  DUPLICATE: "Ya existe un registro con esos datos.",
  INVALID_STATE: "Este documento cambió de estado mientras lo veías. Recarga la página.",
  FORBIDDEN: "Tu usuario no tiene permiso para hacer esto.",
  INVALID_CREDENTIALS: "La contraseña actual no es correcta.",
  INVALID_FILE: "No se pudo leer el archivo. Sube una planilla de Excel (.xlsx) de hasta 5 MB.",
  UNEXPECTED: "Algo salió mal. Intenta de nuevo y, si se repite, avisa a SolutionTech.",
};

export function errorMessage(error: ActionError): string {
  return MESSAGES[error.code];
}
