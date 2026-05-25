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
  ALTER TABLE applicants ADD COLUMN IF NOT EXISTS email text NOT NULL DEFAULT '';
  ALTER TABLE applicants ADD COLUMN IF NOT EXISTS phone text NOT NULL DEFAULT '';
`);

const cols = await pool.query(
  `SELECT column_name FROM information_schema.columns WHERE table_name = 'applicants' AND column_name IN ('email', 'phone')`,
);
console.log("OK — applicants columns:", cols.rows.map((r) => r.column_name).join(", "));
await pool.end();
