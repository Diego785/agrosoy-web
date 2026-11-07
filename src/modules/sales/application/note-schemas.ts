import { z } from "zod";
import { paymentMethodFields } from "@/modules/collections/application/collection-schemas";
import { pagingFields } from "@/shared/application/pagination";
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
    noteDate: z.iso.date({ error: "Escribe la fecha como dd/mm/aaaa." }),
    customerId: z.uuid({ error: "Elige el cliente." }),
    propertyId: z.union([z.literal(""), z.uuid()]).optional(),
    technicianId: z.union([z.literal(""), z.uuid()]).optional(),
    paymentTerms: z.enum(PAYMENT_TERMS, { error: "Elige contado o crédito." }),
    /** Empty on a credit note whose rate is only agreed when the customer pays (D35). */
    exchangeRate: z
      .string()
      .trim()
      .transform((value) => value.replace(",", "."))
      .pipe(
        z.string().regex(/^(\d+(\.\d{1,4})?)?$/, { error: "Escribe el tipo de cambio, por ejemplo 12.00." }),
      ),
    receiverName: z
      .string()
      .trim()
      .min(3, { error: "Escribe quién recibe el producto." })
      .max(80, { error: "Admite hasta 80 caracteres." }),
    receiverDocumentId: optionalText(20),
    receiverRelationship: optionalText(60),
    handedOverById: z.union([z.literal(""), z.uuid()]).optional(),
    carrierName: optionalText(80),
    carrierVehicle: optionalText(40),
    carrierDocumentId: optionalText(20),
    observations: optionalText(500),
    taxInvoiceNumber: optionalText(30),
    lines: z.array(noteLineSchema).min(1, { error: "Agrega al menos un producto." }),
  })
  .superRefine((note, context) => {
    if (note.paymentTerms === "cash" && note.exchangeRate === "") {
      context.addIssue({
        code: "custom",
        path: ["exchangeRate"],
        message: "Al contado se paga en el momento: escribe el tipo de cambio.",
      });
    }
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
  ...pagingFields,
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

/** Empty counts as zero: a follow-up form lists every line and the user fills the ones that apply. */
const optionalDecimal = (decimals: number, message: string) =>
  z
    .string()
    .trim()
    .transform((value) => (value === "" ? "0" : value.replace(",", ".")))
    .pipe(z.string().regex(new RegExp(`^\\d+(\\.\\d{1,${decimals}})?$`), { error: message }));

const paperNumberField = z.union([z.literal(""), noteNumber("Escribe el número impreso, por ejemplo 1250.")]);

export const returnSchema = z.object({
  noteDate: z.iso.date({ error: "Escribe la fecha como dd/mm/aaaa." }),
  /** Who brought the product back. */
  receiverName: z
    .string()
    .trim()
    .min(2, { error: "Escribe quién devuelve." })
    .max(120, { error: "Admite hasta 120 caracteres." }),
  observations: optionalText(500),
  paperNumber: paperNumberField,
  lines: z
    .array(
      z.object({
        originalLineId: z.uuid(),
        quantity: optionalDecimal(3, "Escribe la cantidad, por ejemplo 20 o 2.5."),
      }),
    )
    .min(1),
});

export const transferSchema = z
  .object({
    noteDate: z.iso.date({ error: "Escribe la fecha como dd/mm/aaaa." }),
    exchangeRate: decimal(4, "Escribe el tipo de cambio, por ejemplo 12.00."),
    observations: optionalText(500),
    paperNumber: paperNumberField,
    lines: z
      .array(
        z.object({
          originalLineId: z.uuid(),
          quantity: optionalDecimal(3, "Escribe la cantidad, por ejemplo 20 o 2.5."),
          unitPrice: optionalDecimal(2, "Escribe el precio, por ejemplo 9.50."),
        }),
      )
      .min(1),
  })
  .superRefine((transfer, context) => {
    transfer.lines.forEach((line, index) => {
      if (Number(line.quantity) > 0 && Number(line.unitPrice) === 0) {
        context.addIssue({
          code: "custom",
          path: ["lines", index, "unitPrice"],
          message: "Escribe el precio en la nueva campaña.",
        });
      }
    });
  });

export type ReturnInput = z.input<typeof returnSchema>;
export type TransferInput = z.input<typeof transferSchema>;
