import { describe, expect, it } from "vitest";
import { newUserAccount, USERNAME_PATTERN, visibleEmail } from "./user-account";

describe("newUserAccount", () => {
  it("normalizes what was typed", () => {
    expect(
      newUserAccount({
        name: "  Favio   Añez ",
        username: " FAnez ",
        email: " Favio@Agrosoy.com ",
        role: "sales_technician",
      }),
    ).toEqual({
      name: "Favio Añez",
      username: "fanez",
      email: "favio@agrosoy.com",
      role: "sales_technician",
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

describe("USERNAME_PATTERN", () => {
  it.each(["liz", "f.anez", "tecnico_10"])("accepts %j", (value) => {
    expect(USERNAME_PATTERN.test(value)).toBe(true);
  });

  it.each(["li", "favio añez", "a".repeat(31), "liz@agrosoy"])("rejects %j", (value) => {
    expect(USERNAME_PATTERN.test(value)).toBe(false);
  });
});
