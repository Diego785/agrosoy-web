import "server-only";
import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.url(),
  /** Signs session cookies. Generate with: openssl rand -base64 32 */
  BETTER_AUTH_SECRET: z.string().min(32),
  /** Public URL of this environment, e.g. https://staging.example.com */
  BETTER_AUTH_URL: z.url(),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

/** Validated on first use: `next build` runs without these variables, the running server never does. */
export function getEnv(): Env {
  cached ??= schema.parse(process.env);
  return cached;
}
