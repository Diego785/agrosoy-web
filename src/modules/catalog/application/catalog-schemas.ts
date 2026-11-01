import { z } from "zod";
import { CONTENT_UNITS, PRODUCT_LINES, SALE_UNITS } from "../domain/product";

// Shared by the forms and the use cases; the messages are shown next to the fields.

export const presentationSchema = z.object({
  /** Agrosoil's code ("001"); empty takes the next free number. */
  code: z
    .string()
    .trim()
    .regex(/^\d{0,6}$/, { error: "El código lleva solo números, por ejemplo 051." })
    .optional(),
  content: z
    .string()
    .trim()
    .transform((value) => value.replace(",", "."))
    .pipe(
      z
        .string()
        .regex(/^\d+(\.\d{1,3})?$/, { error: "Escribe el contenido, por ejemplo 20 o 1.5." })
        .refine((value) => Number(value) > 0, { error: "El contenido debe ser mayor que 0." }),
    ),
  unit: z.enum(CONTENT_UNITS, { error: "Elige la unidad." }),
  saleUnit: z.enum(SALE_UNITS, { error: "Elige cómo se cobra." }),
});

export type PresentationInput = z.input<typeof presentationSchema>;

const productFields = {
  name: z
    .string()
    .trim()
    .min(2, { error: "Escribe el nombre del producto." })
    .max(100, { error: "El nombre admite hasta 100 caracteres." }),
  line: z.enum(PRODUCT_LINES, { error: "Elige la línea." }),
};

export const newProductSchema = z
  .object({
    ...productFields,
    presentations: z.array(presentationSchema).min(1, { error: "Agrega al menos una presentación." }),
  })
  .refine(
    (data) =>
      new Set(data.presentations.map((p) => `${Number(p.content)}${p.unit}`)).size ===
      data.presentations.length,
    { error: "Hay presentaciones repetidas.", path: ["presentations"] },
  )
  .refine(
    (data) => {
      const codes = data.presentations.flatMap((p) => (p.code ? [Number(p.code)] : []));
      return new Set(codes).size === codes.length;
    },
    { error: "Hay códigos repetidos.", path: ["presentations"] },
  );

export type NewProductInput = z.input<typeof newProductSchema>;

export const productSchema = z.object(productFields);
export type ProductInput = z.input<typeof productSchema>;

/** Comes from the URL, so bad values fall back to defaults. */
export const productSearchSchema = z.object({
  text: z.string().trim().max(100).catch(""),
  line: z.enum(PRODUCT_LINES).optional().catch(undefined),
  status: z.enum(["active", "inactive"]).catch("active"),
});

export const priceSheetSchema = z.object({
  campaignId: z.uuid(),
  /** Empty for the general price, used in every zone without its own. */
  zoneId: z.union([z.literal(""), z.uuid()]).optional(),
});

export const savePricesSchema = priceSheetSchema.extend({
  prices: z.array(
    z.object({
      presentationId: z.uuid(),
      /** Empty removes the price. */
      price: z
        .string()
        .trim()
        .transform((value) => value.replace(",", "."))
        .pipe(
          z.union([
            z.literal(""),
            z
              .string()
              .regex(/^\d+(\.\d{1,2})?$/, { error: "Escribe el precio en dólares, por ejemplo 9.50." }),
          ]),
        ),
    }),
  ),
});

export type SavePricesInput = z.input<typeof savePricesSchema>;
