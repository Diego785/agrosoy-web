import { z } from "zod";
import { CURRENCIES, PAYMENT_METHODS } from "../domain/payment";

// Shared by the collection forms and the use cases; the messages are shown next to the fields.

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

const optionalId = z.union([z.literal(""), z.uuid()]).optional();

export const exchangeRateField = decimal(4, "Escribe el tipo de cambio, por ejemplo 6.96.");

/** How the customer paid; also what a cash note asks for when it is confirmed. */
export const paymentMethodFields = {
  currency: z.enum(CURRENCIES, { error: "Elige la moneda." }),
  method: z.enum(PAYMENT_METHODS, { error: "Elige cómo pagó." }),
  inKindDescription: optionalText(300),
  reference: optionalText(100),
};

export const paymentSchema = z
  .object({
    customerId: z.uuid({ error: "Elige el cliente." }),
    paymentDate: z.iso.date({ error: "Elige la fecha." }),
    amount: decimal(2, "Escribe el monto, por ejemplo 1500 o 1500.50."),
    exchangeRate: exchangeRateField,
    ...paymentMethodFields,
    target: z.enum(["oldest_debt", "campaign", "note"]),
    campaignId: optionalId,
    noteId: optionalId,
    observations: optionalText(500),
  })
  .superRefine((payment, context) => {
    if (payment.target === "campaign" && !payment.campaignId) {
      context.addIssue({ code: "custom", path: ["campaignId"], message: "Elige la campaña." });
    }
    if (payment.target === "note" && !payment.noteId) {
      context.addIssue({ code: "custom", path: ["noteId"], message: "Elige la boleta." });
    }
    if (payment.method === "in_kind" && !payment.inKindDescription) {
      context.addIssue({
        code: "custom",
        path: ["inKindDescription"],
        message: "Describe qué entregó y su valor acordado.",
      });
    }
  });

export const chargeSchema = z.object({
  customerId: z.uuid({ error: "Elige el cliente." }),
  campaignId: z.uuid({ error: "Elige la campaña." }),
  chargeDate: z.iso.date({ error: "Elige la fecha." }),
  amount: decimal(2, "Escribe el monto en US$, por ejemplo 120.50."),
  reason: z
    .string()
    .trim()
    .min(5, { error: "Explica el motivo del cargo." })
    .max(500, { error: "Admite hasta 500 caracteres." }),
});

export const voidReasonSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(5, { error: "Explica por qué se anula." })
    .max(500, { error: "Admite hasta 500 caracteres." }),
});

export const dailyRateSchema = z.object({
  rateDate: z.iso.date({ error: "Elige la fecha." }),
  rate: exchangeRateField,
});

export const paymentSearchSchema = z.object({
  customerId: z
    .union([z.literal(""), z.uuid()])
    .optional()
    .catch(undefined),
  page: z.coerce.number().int().min(1).catch(1),
});

export type PaymentInput = z.input<typeof paymentSchema>;
export type ChargeInput = z.input<typeof chargeSchema>;
export type VoidReasonInput = z.input<typeof voidReasonSchema>;
export type DailyRateInput = z.input<typeof dailyRateSchema>;
