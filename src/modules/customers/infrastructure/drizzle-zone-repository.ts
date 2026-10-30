import { and, asc, count, desc, eq } from "drizzle-orm";
import { DomainError } from "@/shared/domain/domain-error";
import type { DbExecutor } from "@/shared/infrastructure/db/client";
import { violatedUniqueConstraint } from "@/shared/infrastructure/db/postgres-errors";
import type { ZoneRepository } from "../application/ports";
import { ZONE_NAME_KEY, customers, zones } from "./customers.tables";

function uniqueName<T>(write: () => Promise<T>): Promise<T> {
  return write().catch((error: unknown) => {
    if (violatedUniqueConstraint(error) === ZONE_NAME_KEY) {
      throw new DomainError("DUPLICATE", { field: "name" });
    }
    throw error;
  });
}

export function drizzleZoneRepository(executor: DbExecutor): ZoneRepository {
  return {
    async insert(zone) {
      const [row] = await uniqueName(() => executor.insert(zones).values(zone).returning({ id: zones.id }));
      if (!row) throw new Error("Insert returned no zone");
      return row;
    },

    list() {
      return executor
        .select({ id: zones.id, name: zones.name })
        .from(zones)
        .where(eq(zones.isActive, true))
        .orderBy(asc(zones.comparisonName));
    },

    listAll() {
      return executor
        .select({
          id: zones.id,
          name: zones.name,
          isActive: zones.isActive,
          customerCount: count(customers.id),
        })
        .from(zones)
        .leftJoin(customers, eq(customers.zoneId, zones.id))
        .groupBy(zones.id)
        .orderBy(desc(zones.isActive), asc(zones.comparisonName));
    },

    async find(id) {
      const [row] = await executor
        .select({ id: zones.id, name: zones.name, isActive: zones.isActive })
        .from(zones)
        .where(eq(zones.id, id));
      return row;
    },

    async rename(id, zone) {
      const updated = await uniqueName(() =>
        executor.update(zones).set(zone).where(eq(zones.id, id)).returning({ id: zones.id }),
      );
      if (updated.length === 0) throw new DomainError("NOT_FOUND", { entity: "zone", id });
    },

    async setActive(id, active) {
      const updated = await executor
        .update(zones)
        .set({ isActive: active })
        .where(eq(zones.id, id))
        .returning({ id: zones.id });
      if (updated.length === 0) throw new DomainError("NOT_FOUND", { entity: "zone", id });
    },

    async exists(id) {
      const total = await executor.$count(zones, and(eq(zones.id, id), eq(zones.isActive, true)));
      return total > 0;
    },
  };
}
