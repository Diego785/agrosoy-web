import { describe, expect, it } from "vitest";
import { similarCustomers } from "./name-match";

const registered = [
  "ALEXANDER JIMENEZ  MONTERO",
  "PORFIDIO MARTINEZ",
  "ROBERTO SEÑAS",
  "ROBERTO MAMANI ARCE",
  "HERMOGENES MAMANI",
  "RENE GONZALES GARRON",
  "RODOLFO ROMERO RODRIGUEZ",
  "ARIEL VALDIVIA HINOJOSA",
  "RONALD VALDIVIA HINOJOSA",
].map((name) => ({ name }));

const best = (name: string) => similarCustomers(name, registered).map((customer) => customer.name);

describe("names written differently in the sheets (D47)", () => {
  it("finds the registered customer behind a short or misspelled name", () => {
    expect(best("Alexander Jimenez")).toEqual(["ALEXANDER JIMENEZ  MONTERO"]);
    expect(best("Porfirio Martinez")).toEqual(["PORFIDIO MARTINEZ"]);
    expect(best("Roberto Seña")).toEqual(["ROBERTO SEÑAS"]);
    expect(best("Roberto Mamani")).toEqual(["ROBERTO MAMANI ARCE"]);
    expect(best("Rene Gonzales")).toEqual(["RENE GONZALES GARRON"]);
    expect(best("Rodolfo Romero")).toEqual(["RODOLFO ROMERO RODRIGUEZ"]);
  });

  it("offers every namesake, and nothing for a different person or a single word", () => {
    expect(best("Valdivia Hinojosa")).toEqual(["ARIEL VALDIVIA HINOJOSA", "RONALD VALDIVIA HINOJOSA"]);
    expect(best("Carlos Romero")).toEqual([]);
    expect(best("Wilma Ramos")).toEqual([]);
    expect(best("Roberto")).toEqual([]);
  });
});
