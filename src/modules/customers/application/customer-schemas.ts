import { z } from "zod";

// Shared by the forms (instant feedback) and the use cases (the real check). The messages are
// shown next to the fields, so they are written in Spanish here.

const optionalText = (max: number, tooLong: string) =>
  z.string().trim().max(max, { error: tooLong }).optional();

export const customerSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(3, { error: "Escribe el nombre completo o la razón social." })
      .max(120, { error: "El nombre admite hasta 120 caracteres." }),
    taxId: z
      .string()
      .trim()
      .regex(/^[0-9A-Za-z\s.-]*$/, { error: "El NIT o CI solo lleva números y letras." })
      .max(20, { error: "El NIT o CI admite hasta 20 caracteres." })
      .optional(),
    phone: optionalText(30, "El teléfono admite hasta 30 caracteres."),
    zoneId: z.union([z.literal(""), z.uuid()]).optional(),
    technicianId: z.union([z.literal(""), z.uuid()]).optional(),
    exchangeRateKind: z.enum(["daily", "fixed"], { error: "Elige el tipo de cambio acordado." }),
    fixedExchangeRate: z.string().trim().optional(),
    notes: optionalText(500, "Las notas admiten hasta 500 caracteres."),
  })
  .refine(
    (data) => data.exchangeRateKind === "daily" || /^\d+(\.\d{1,4})?$/.test(data.fixedExchangeRate ?? ""),
    {
      error: "Escribe el tipo de cambio fijo, por ejemplo 12.00.",
      path: ["fixedExchangeRate"],
    },
  );

export type CustomerInput = z.input<typeof customerSchema>;

export const customerIdSchema = z.uuid();

/** Comes from the URL, so bad values fall back to defaults instead of failing the page. */
export const customerSearchSchema = z.object({
  text: z.string().trim().max(100).catch(""),
  zoneId: z.uuid().optional().catch(undefined),
  status: z.enum(["active", "inactive"]).catch("active"),
  page: z.coerce.number().int().min(1).catch(1),
});

export const propertySchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, { error: "Escribe el nombre de la propiedad." })
    .max(80, { error: "El nombre admite hasta 80 caracteres." }),
  location: optionalText(120, "La ubicación admite hasta 120 caracteres."),
});

export type PropertyInput = z.input<typeof propertySchema>;

export const receiverSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, { error: "Escribe el nombre completo." })
    .max(80, { error: "El nombre admite hasta 80 caracteres." }),
  documentId: z
    .string()
    .trim()
    .regex(/^[0-9A-Za-z\s.-]*$/, { error: "El CI solo lleva números y letras." })
    .max(20, { error: "El CI admite hasta 20 caracteres." })
    .optional(),
  relationship: z
    .string()
    .trim()
    .min(2, { error: "Escribe el cargo o parentesco, por ejemplo hijo o encargado." })
    .max(60, { error: "Admite hasta 60 caracteres." }),
});

export type ReceiverInput = z.input<typeof receiverSchema>;

export type CustomerSearchInput = z.input<typeof customerSearchSchema>;

export const zoneIdSchema = z.uuid();

export const zoneSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, { error: "Escribe el nombre de la zona." })
    .max(60, { error: "El nombre admite hasta 60 caracteres." }),
});

export type ZoneInput = z.input<typeof zoneSchema>;
