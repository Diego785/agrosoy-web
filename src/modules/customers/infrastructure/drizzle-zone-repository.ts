import { and, asc, eq } from "drizzle-orm";
import { DomainError } from "@/shared/domain/domain-error";
import type { DbExecutor } from "@/shared/infrastructure/db/client";
import { violatedUniqueConstraint } from "@/shared/infrastructure/db/postgres-errors";
import type { ZoneRepository } from "../application/ports";
import { ZONE_NAME_KEY, zones } from "./customers.tables";

export function drizzleZoneRepository(executor: DbExecutor): ZoneRepository {
  return {
    async insert(zone) {
      try {
        const [row] = await executor.insert(zones).values(zone).returning({ id: zones.id });
        if (!row) throw new Error("Insert returned no zone");
        return row;
      } catch (error) {
        if (violatedUniqueConstraint(error) === ZONE_NAME_KEY) {
          throw new DomainError("DUPLICATE", { field: "name" });
        }
        throw error;
      }
    },

    list() {
      return executor
        .select({ id: zones.id, name: zones.name })
        .from(zones)
        .where(eq(zones.isActive, true))
        .orderBy(asc(zones.comparisonName));
    },

    async exists(id) {
      const total = await executor.$count(zones, and(eq(zones.id, id), eq(zones.isActive, true)));
      return total > 0;
    },
  };
}
