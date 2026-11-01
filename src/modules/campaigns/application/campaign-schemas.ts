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
  })
  .refine((data) => data.endsOn > data.startsOn, {
    error: "La campaña debe terminar después de empezar.",
    path: ["endsOn"],
  });

export type CampaignInput = z.input<typeof campaignSchema>;
