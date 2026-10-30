import { describe, expect, it } from "vitest";
import { newUserAccount, USERNAME_PATTERN, userProfile, visibleEmail } from "./user-account";

describe("newUserAccount", () => {
  it("normalizes what was typed", () => {
    expect(
      newUserAccount({
        name: "  Favio   Añez ",
        username: " FAnez ",
        email: " Favio@Agrosoy.com ",
        role: "sales_technician",
        position: " Ejecutivo  de ventas ",
        documentId: " 4567891 sc ",
        workZone: " Cuatro Cañadas ",
      }),
    ).toEqual({
      name: "Favio Añez",
      username: "fanez",
      email: "favio@agrosoy.com",
      role: "sales_technician",
      position: "Ejecutivo de ventas",
      documentId: "4567891 SC",
      workZone: "Cuatro Cañadas",
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
      workZone: null,
    });
  });

  it("keeps a zone of work only for technicians", () => {
    expect(userProfile({ name: "Liz", workZone: "Norte" }, "admin").workZone).toBeNull();
    expect(userProfile({ name: "Favio", workZone: "Norte" }, "sales_technician").workZone).toBe("Norte");
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
