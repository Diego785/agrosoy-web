import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

export function testDatabaseUrl(): string {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error("TEST_DATABASE_URL is not set (see .env.example)");
  // Tests empty every table, so refuse anything that isn't a *_test database.
  if (!new URL(url).pathname.endsWith("_test")) {
    throw new Error(`Refusing to run integration tests against ${url}`);
  }
  return url;
}
