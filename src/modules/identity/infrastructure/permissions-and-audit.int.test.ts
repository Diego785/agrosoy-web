import { describe, expect, it } from "vitest";
import { actorWithRole } from "@test/actors";
import { testDb } from "@test/test-database";
import { effectivePermissions } from "@/shared/application/permissions";
import { auditLog } from "@/shared/infrastructure/audit/audit-log.table";
import { drizzleAuditTrail } from "@/shared/infrastructure/audit/drizzle-audit-trail";
import { listAuditEntries } from "../application/audit-use-cases";
import { getPermissionMatrix, updateRolePermissions } from "../application/permission-use-cases";
import { createUser } from "../application/user-use-cases";
import { newUserAccount } from "../domain/user-account";
import { drizzleAuditLogReader } from "./drizzle-audit-log-reader";
import { drizzlePermissionSettings } from "./drizzle-permission-settings";
import { drizzleUserDirectory } from "./drizzle-user-directory";
import { randomPasswordGenerator } from "./random-password-generator";

const admin = actorWithRole("admin");

function permissionDeps() {
  return { permissions: drizzlePermissionSettings(testDb), audit: drizzleAuditTrail(testDb) };
}

describe("permission matrix", () => {
  it("shows the defaults until administration adjusts a role", async () => {
    const matrix = await getPermissionMatrix(permissionDeps(), admin);
    expect(matrix.find((row) => row.role === "sales_technician")).toEqual({
      role: "sales_technician",
      permissions: ["customers.view", "statements.view"],
      editable: true,
    });
    expect(matrix.find((row) => row.role === "admin")?.editable).toBe(false);
  });

  it("stores exactly the permissions chosen for a role and applies them to its users", async () => {
    await updateRolePermissions(permissionDeps(), admin, {
      role: "sales_technician",
      permissions: ["customers.view", "imports.manage"],
    });

    const overrides = await drizzlePermissionSettings(testDb).overrides();
    expect(effectivePermissions("sales_technician", overrides)).toEqual(["customers.view", "imports.manage"]);
    // Choosing the defaults again leaves no adjustments behind.
    await updateRolePermissions(permissionDeps(), admin, {
      role: "sales_technician",
      permissions: ["customers.view", "statements.view"],
    });
    expect(await drizzlePermissionSettings(testDb).overrides()).toEqual([]);
  });

  it("records only roles that actually changed", async () => {
    await updateRolePermissions(permissionDeps(), admin, {
      role: "manager",
      permissions: effectivePermissions("manager", []),
    });
    expect(await testDb.$count(auditLog)).toBe(0);
  });

  it("never changes administration and only lets user managers edit", async () => {
    await expect(
      updateRolePermissions(permissionDeps(), admin, { role: "admin", permissions: [] }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      updateRolePermissions(permissionDeps(), actorWithRole("sales_technician"), {
        role: "warehouse_keeper",
        permissions: [],
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      updateRolePermissions(permissionDeps(), admin, { role: "manager", permissions: ["nope"] }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
  });
});

describe("audit log", () => {
  it("lists changes newest first with who made them and what they touched", async () => {
    const { id: lizId } = await drizzleUserDirectory(testDb).create(
      newUserAccount({ name: "Liz", username: "liz", email: "liz@agrosoy.com", role: "admin" }),
      "temporary-password",
    );
    const liz = actorWithRole("admin", lizId, "Liz");
    await createUser(
      {
        users: drizzleUserDirectory(testDb),
        passwords: randomPasswordGenerator,
        audit: drizzleAuditTrail(testDb),
      },
      liz,
      { name: "Favio Añez", username: "fanez", role: "sales_technician" },
    );
    await updateRolePermissions(permissionDeps(), liz, { role: "warehouse_keeper", permissions: [] });

    const { items, total } = await listAuditEntries({ auditLog: drizzleAuditLogReader(testDb) }, liz, {});
    expect(total).toBe(2);
    expect(items).toMatchObject([
      { actorName: "Liz", action: "identity.update_permissions", entityLabel: "warehouse_keeper" },
      { actorName: "Liz", action: "identity.create_user", entityLabel: "Favio Añez" },
    ]);
  });

  it("is only for roles allowed to see it", async () => {
    await expect(
      listAuditEntries({ auditLog: drizzleAuditLogReader(testDb) }, actorWithRole("sales_technician"), {}),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
