import { describe, expect, it } from "vitest";
import { parseProductLabel } from "./product-label";

describe("parseProductLabel", () => {
  it.each([
    ["Fulvin 40-22(20lts.)", "Fulvin 40-22", "20", "l"],
    ["4-energy(250ml.)", "4-energy", "250", "ml"],
    ["Proan(5kg.)", "Proan", "5", "kg"],
    ["Ga-3Activ(20grs.)", "Ga-3Activ", "20", "g"],
    ["Soja Siembra plus(1,5lts.)", "Soja Siembra plus", "1.5", "l"],
    ["Komus Flex(1lt.)", "Komus Flex", "1", "l"],
    ["Rein 517 (1 lt)", "Rein 517", "1", "l"],
  ])("reads %j", (label, name, content, unit) => {
    expect(parseProductLabel(label)).toMatchObject({ name, content, unit });
  });

  it("gives names that differ only in case the same key", () => {
    expect(parseProductLabel("Proan K Rapid(5kg.)")?.key).toBe(parseProductLabel("Proan k rapid(5kg.)")?.key);
  });

  it.each(["Fulvin 40-22", "Fulvin(20 bolsas)", "(20lts.)"])("can't read %j", (label) => {
    expect(parseProductLabel(label)).toBeUndefined();
  });
});
