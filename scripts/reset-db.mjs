import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";

const loadEnvFile = (filePath) => {
  if (!fs.existsSync(filePath)) {
    return;
  }
  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }
    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
};

const reset = async () => {
  const envPath = path.join(process.cwd(), ".env.local");
  loadEnvFile(envPath);

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set. Add it to .env.local or export it.");
  }

  const pool = new Pool({ connectionString: databaseUrl });
  await pool.query("drop table if exists chore_occurrence_overrides");
  await pool.query("drop table if exists chores");
  await pool.query("drop table if exists households");
  await pool.end();
};

reset().catch((error) => {
  console.error(error);
  process.exit(1);
});
