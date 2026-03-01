import { execFileSync } from "node:child_process";
import * as nextEnv from "@next/env";
import { Pool } from "pg";

const { loadEnvConfig } = nextEnv.default ?? nextEnv;

loadEnvConfig(process.cwd());

const reset = async () => {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set. Add it to .env.local or export it.");
  }

  const pool = new Pool({ connectionString: databaseUrl });
  await pool.query("drop schema if exists drizzle cascade");
  await pool.query("drop schema if exists public cascade");
  await pool.query("create schema public");
  await pool.end();

  execFileSync("yarn", ["db:migrate"], {
    stdio: "inherit",
    env: process.env,
  });
};

reset().catch((error) => {
  console.error(error);
  process.exit(1);
});
