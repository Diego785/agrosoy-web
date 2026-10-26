import { z } from "zod";
import { paymentMethodFields } from "@/modules/collections/application/collection-schemas";
import { FREE_REASONS, PAYMENT_TERMS } from "../domain/delivery-note";

// Shared by the note form and the use cases; the messages are shown next to the fields.

const decimal = (decimals: number, message: string) =>
  z
    .string()
    .trim()
    .transform((value) => value.replace(",", "."))
    .pipe(z.string().regex(new RegExp(`^\\d+(\\.\\d{1,${decimals}})?$`), { error: message }));

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, { error: `Admite hasta ${max} caracteres.` })
    .optional();

export const noteLineSchema = z.object({
  presentationId: z.uuid({ error: "Elige el producto." }),
  quantity: decimal(3, "Escribe la cantidad, por ejemplo 20 o 2.5."),
  /** Empty only for free-of-charge lines. */
  unitPrice: z
    .string()
    .trim()
    .transform((value) => value.replace(",", "."))
    .pipe(
      z.union([
        z.literal(""),
        z.string().regex(/^\d+(\.\d{1,2})?$/, { error: "Escribe el precio, por ejemplo 9.50." }),
      ]),
    ),
  freeOfCharge: z.union([z.literal(""), z.enum(FREE_REASONS)]),
});

export const draftNoteSchema = z
  .object({
    noteDate: z.iso.date({ error: "Elige la fecha." }),
    customerId: z.uuid({ error: "Elige el cliente." }),
    propertyId: z.union([z.literal(""), z.uuid()]).optional(),
    technicianId: z.union([z.literal(""), z.uuid()]).optional(),
    paymentTerms: z.enum(PAYMENT_TERMS, { error: "Elige contado o crédito." }),
    exchangeRate: decimal(4, "Escribe el tipo de cambio, por ejemplo 6.96."),
    receiverName: z
      .string()
      .trim()
      .min(3, { error: "Escribe quién recibe el producto." })
      .max(80, { error: "Admite hasta 80 caracteres." }),
    receiverDocumentId: optionalText(20),
    receiverRelationship: optionalText(60),
    observations: optionalText(500),
    taxInvoiceNumber: optionalText(30),
    lines: z.array(noteLineSchema).min(1, { error: "Agrega al menos un producto." }),
  })
  .superRefine((note, context) => {
    note.lines.forEach((line, index) => {
      if (!line.freeOfCharge && (line.unitPrice === "" || Number(line.unitPrice) === 0)) {
        context.addIssue({
          code: "custom",
          path: ["lines", index, "unitPrice"],
          message: "Escribe el precio o marca la línea como bonificación o muestra.",
        });
      }
      if (Number(line.quantity) === 0) {
        context.addIssue({
          code: "custom",
          path: ["lines", index, "quantity"],
          message: "La cantidad debe ser mayor que 0.",
        });
      }
    });
  });

export type DraftNoteInput = z.input<typeof draftNoteSchema>;
export type NoteLineInput = z.input<typeof noteLineSchema>;

export const noteSearchSchema = z.object({
  status: z.enum(["draft", "confirmed", "voided"]).optional().catch(undefined),
  customerId: z.uuid().optional().catch(undefined),
  page: z.coerce.number().int().min(1).catch(1),
});

const noteNumber = (message: string) =>
  z
    .string()
    .trim()
    .regex(/^[1-9]\d{0,8}$/, { error: message })
    .transform(Number);

export const confirmNoteSchema = z.object({
  /** Empty: the system gives the next number. Filled: a paper note typed in later keeps its printed number. */
  paperNumber: z.union([z.literal(""), noteNumber("Escribe el número impreso, por ejemplo 1250.")]),
  /** How a cash note was paid; its amount is the note's total. */
  payment: z
    .object(paymentMethodFields)
    .superRefine((payment, context) => {
      if (payment.method === "in_kind" && !payment.inKindDescription) {
        context.addIssue({
          code: "custom",
          path: ["inKindDescription"],
          message: "Describe qué entregó y su valor acordado.",
        });
      }
    })
    .optional(),
});

export const voidNoteSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(5, { error: "Explica por qué se anula." })
    .max(500, { error: "Admite hasta 500 caracteres." }),
});

export const nextNoteNumberSchema = z.object({
  nextNumber: noteNumber("Escribe un número entero mayor que 0."),
});

export type ConfirmNoteInput = z.input<typeof confirmNoteSchema>;
export type VoidNoteInput = z.input<typeof voidNoteSchema>;
export type NextNoteNumberInput = z.input<typeof nextNoteNumberSchema>;
