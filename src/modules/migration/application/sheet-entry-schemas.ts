import { z } from "zod";

// Shared by the form and the use case: correcting a payment or return a sheet brought in (D60).

export const correctSheetEntrySchema = z.object({
  batchId: z.uuid(),
  entryId: z.uuid(),
  amount: z
    .string()
    .trim()
    .transform((value) => value.replace(",", "."))
    .pipe(z.string().regex(/^\d+(\.\d{1,2})?$/, { error: "Escribe el monto, por ejemplo 150.00." })),
  reason: z
    .string()
    .trim()
    .min(5, { error: "Explica por qué se corrige." })
    .max(500, { error: "Admite hasta 500 caracteres." }),
});

export type CorrectSheetEntryInput = z.input<typeof correctSheetEntrySchema>;
