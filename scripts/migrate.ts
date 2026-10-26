// Applies pending SQL migrations from ./drizzle. Runs on every deploy and with `pnpm db:migrate`.
import { config } from "dotenv";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

config({ path: ".env.local", quiet: true });

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");

  const db = drizzle(url);
  try {
    await migrate(db, { migrationsFolder: "drizzle" });
    console.log("Migrations applied");
  } finally {
    await db.$client.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
