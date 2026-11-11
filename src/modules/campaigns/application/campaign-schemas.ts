import { z } from "zod";
import { SEASONS } from "../domain/campaign";

const isoDate = z.iso.date({ error: "Escribe la fecha como dd/mm/aaaa." });

export const campaignSchema = z
  .object({
    season: z.enum(SEASONS, { error: "Elige la temporada." }),
    year: z.coerce
      .number({ error: "Escribe el año." })
      .int({ error: "Escribe el año." })
      .min(2020, { error: "Escribe un año desde 2020." })
      .max(2100, { error: "Escribe un año válido." }),
    startsOn: isoDate,
    endsOn: isoDate,
    /** Empty or missing: the season's usual date (D37). */
    dueOn: z.union([z.literal(""), isoDate]).optional(),
  })
  .refine((data) => data.endsOn > data.startsOn, {
    error: "La campaña debe terminar después de empezar.",
    path: ["endsOn"],
  })
  .refine((data) => !data.dueOn || data.dueOn >= data.endsOn, {
    error: "El vencimiento no puede ser antes del fin de la campaña.",
    path: ["dueOn"],
  });

export type CampaignInput = z.input<typeof campaignSchema>;

/** A later due date for one customer in one campaign, with its reason (D37). */
export const dueDateExtensionSchema = z.object({
  customerId: z.uuid(),
  campaignId: z.uuid(),
  dueOn: isoDate,
  reason: z
    .string()
    .trim()
    .min(5, { error: "Explica por qué se da más plazo." })
    .max(300, { error: "Admite hasta 300 caracteres." }),
});

export const removeExtensionSchema = z.object({ customerId: z.uuid(), campaignId: z.uuid() });

export type DueDateExtensionInput = z.input<typeof dueDateExtensionSchema>;
