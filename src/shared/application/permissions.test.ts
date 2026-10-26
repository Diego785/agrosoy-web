import { describe, expect, it } from "vitest";
import { effectivePermissions, PERMISSIONS } from "./permissions";

describe("effectivePermissions", () => {
  it("uses the role's defaults without adjustments", () => {
    expect(effectivePermissions("sales_technician", [])).toEqual([
      "customers.view",
      "statements.view",
      "catalog.view",
      "notes.view",
      "notes.manage",
    ]);
  });

  it("applies grants and revocations saved for the role only", () => {
    expect(
      effectivePermissions("sales_technician", [
        { role: "sales_technician", permission: "imports.manage", granted: true },
        { role: "sales_technician", permission: "statements.view", granted: false },
        { role: "warehouse_keeper", permission: "customers.manage", granted: true },
      ]),
    ).toEqual(["customers.view", "imports.manage", "catalog.view", "notes.view", "notes.manage"]);
  });

  it("never takes anything away from administration", () => {
    expect(
      effectivePermissions("admin", [{ role: "admin", permission: "users.manage", granted: false }]),
    ).toEqual([...PERMISSIONS]);
  });
});
