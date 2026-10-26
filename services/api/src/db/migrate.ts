import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

export async function runMigrations(connectionString: string = process.env.DATABASE_URL ?? ""): Promise<void> {
  const pool = new pg.Pool({ connectionString, max: 1 });
  try {
    await pool.query("CREATE EXTENSION IF NOT EXISTS postgis");
    await migrate(drizzle(pool), { migrationsFolder: fileURLToPath(new URL("../../migrations", import.meta.url)) });
  } finally {
    await pool.end();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await runMigrations();
  console.log("migrations: ok");
}
