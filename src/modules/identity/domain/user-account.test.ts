import { describe, expect, it } from "vitest";
import { newUserAccount, USERNAME_PATTERN, userProfile, visibleEmail } from "./user-account";

const ZONE_ID = "0b6f4c3e-8a1d-4f2b-9c5e-7d3a2b1c0f9e";

describe("newUserAccount", () => {
  it("normalizes what was typed", () => {
    expect(
      newUserAccount({
        name: "  Favio   Añez ",
        username: " FAnez ",
        email: " Favio@Agrosoil.com ",
        role: "sales_technician",
        position: " Ejecutivo  de ventas ",
        documentId: " 4567891 sc ",
        workZoneId: ZONE_ID,
      }),
    ).toEqual({
      name: "Favio Añez",
      username: "fanez",
      email: "favio@agrosoil.com",
      role: "sales_technician",
      position: "Ejecutivo de ventas",
      documentId: "4567891 SC",
      workZoneId: ZONE_ID,
    });
  });

  it("gives users without email a placeholder that is never shown", () => {
    const account = newUserAccount({
      name: "Almacén Norte",
      username: "norte",
      email: "  ",
      role: "warehouse_keeper",
    });
    expect(account.email).toBe("norte@usuarios.agrosoy.invalid");
    expect(visibleEmail(account.email)).toBeNull();
    expect(visibleEmail("liz@agrosoy.com")).toBe("liz@agrosoy.com");
  });
});

describe("userProfile", () => {
  it("leaves empty fields as null", () => {
    expect(userProfile({ name: "Liz", position: " ", documentId: "" }, "admin")).toEqual({
      name: "Liz",
      position: null,
      documentId: null,
      workZoneId: null,
    });
  });

  it("keeps a zone of work only for technicians", () => {
    expect(userProfile({ name: "Liz", workZoneId: ZONE_ID }, "admin").workZoneId).toBeNull();
    expect(userProfile({ name: "Favio", workZoneId: ZONE_ID }, "sales_technician").workZoneId).toBe(ZONE_ID);
    expect(userProfile({ name: "Favio", workZoneId: "" }, "sales_technician").workZoneId).toBeNull();
  });
});

describe("USERNAME_PATTERN", () => {
  it.each(["liz", "f.anez", "tecnico_10"])("accepts %j", (value) => {
    expect(USERNAME_PATTERN.test(value)).toBe(true);
  });

  it.each(["li", "favio añez", "a".repeat(31), "liz@agrosoy"])("rejects %j", (value) => {
    expect(USERNAME_PATTERN.test(value)).toBe(false);
  });
});
