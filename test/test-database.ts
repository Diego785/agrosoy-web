import { createDatabase } from "@/shared/infrastructure/db/client";
import { testDatabaseUrl } from "./test-database-url";

export const testDb = createDatabase(testDatabaseUrl());
