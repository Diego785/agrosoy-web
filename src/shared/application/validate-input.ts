import type { z } from "zod";
import { DomainError } from "@/shared/domain/domain-error";

/**
 * Server actions are public POST endpoints, so every use case re-validates its input with the
 * same schema its form uses (D3). Failures carry every field's messages at once.
 */
export function validateInput<Schema extends z.ZodType>(schema: Schema, input: unknown): z.output<Schema> {
  const result = schema.safeParse(input);
  if (result.success) return result.data;

  const fieldErrors: Record<string, string[]> = {};
  for (const issue of result.error.issues) {
    const field = issue.path.join(".") || "_form";
    (fieldErrors[field] ??= []).push(issue.message);
  }
  throw new DomainError("VALIDATION_FAILED", { fieldErrors });
}
