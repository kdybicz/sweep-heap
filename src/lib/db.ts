import { Pool } from "pg";
import { transactionAwarePool } from "@/lib/mutation-transaction";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set");
}

const queryPool = new Pool({
  connectionString: databaseUrl,
  connectionTimeoutMillis: 5000,
});
export const pool = transactionAwarePool(queryPool);

// Lock callbacks use the query pool above. Never queue their locks in that same pool.
export const householdLockPool = new Pool({
  connectionString: databaseUrl,
  max: 10,
  connectionTimeoutMillis: 5000,
  statement_timeout: 10000,
  application_name: "sweep-heap-household-locks",
});

for (const [name, databasePool] of [
  ["query", pool],
  ["household lock", householdLockPool],
] as const) {
  databasePool.on("error", (error) => console.error(`Idle ${name} connection failed`, error));
}
