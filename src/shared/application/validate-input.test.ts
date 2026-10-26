import { describe, expect, it } from "vitest";
import { z } from "zod";
import { DomainError } from "@/shared/domain/domain-error";
import { validateInput } from "./validate-input";

const schema = z.object({
  name: z.string().trim().min(3, { error: "Too short" }),
  address: z.object({ town: z.string().min(1, { error: "Required" }) }),
});

describe("validateInput", () => {
  it("returns the parsed data", () => {
    expect(validateInput(schema, { name: " Liz ", address: { town: "Montero" } })).toEqual({
      name: "Liz",
      address: { town: "Montero" },
    });
  });

  it("reports every invalid field by its path", () => {
    let error: unknown;
    try {
      validateInput(schema, { name: "A", address: { town: "" } });
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(DomainError);
    expect(error).toMatchObject({
      code: "VALIDATION_FAILED",
      details: { fieldErrors: { name: ["Too short"], "address.town": ["Required"] } },
    });
  });
});
