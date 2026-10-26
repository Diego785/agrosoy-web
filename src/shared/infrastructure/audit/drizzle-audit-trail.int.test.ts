import { describe, expect, it } from "vitest";
import { testDb } from "@test/test-database";
import { auditLog } from "./audit-log.table";
import { drizzleAuditTrail } from "./drizzle-audit-trail";

const entry = {
  actorId: "user-1",
  action: "customers.register",
  entityType: "customer",
  entityId: "0b6f9f0e-6d3c-4b8e-9b1a-2f4c5d6e7f80",
  payload: { name: "Eduardo Cuaquira" },
};

describe("drizzleAuditTrail", () => {
  it("stores who did what, with the time it happened", async () => {
    await drizzleAuditTrail(testDb).record(entry);

    const [row] = await testDb.select().from(auditLog);
    expect(row).toMatchObject(entry);
    expect(row?.occurredAt).toBeInstanceOf(Date);
  });

  it("rolls back with the transaction it belongs to", async () => {
    await expect(
      testDb.transaction(async (tx) => {
        await drizzleAuditTrail(tx).record(entry);
        throw new Error("the use case failed after recording");
      }),
    ).rejects.toThrow("the use case failed");

    expect(await testDb.$count(auditLog)).toBe(0);
  });
});
