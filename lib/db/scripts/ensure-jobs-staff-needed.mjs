import pg from "pg";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..", "..", "..");
const envPath = path.join(root, ".env");

if (!process.env.DATABASE_URL && fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^\s*DATABASE_URL=(.+)$/);
    if (m) process.env.DATABASE_URL = m[1].trim().replace(/^["']|["']$/g, "");
  }
}

if (!process.env.DATABASE_URL) {
  console.error("Set DATABASE_URL in .env or environment.");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

await pool.query(`
  ALTER TABLE jobs ADD COLUMN IF NOT EXISTS staff_needed integer NOT NULL DEFAULT 1;
`);

const cols = await pool.query(
  `SELECT column_name FROM information_schema.columns WHERE table_name = 'jobs' AND column_name = 'staff_needed'`,
);
console.log("OK — jobs columns:", cols.rows.map((r) => r.column_name).join(", "));
await pool.end();
