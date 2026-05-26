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
  console.error("Set DATABASE_URL");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const cols = await pool.query(
  `SELECT column_name, data_type FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'appraisals'
   ORDER BY ordinal_position`,
);
console.log("Columns:", cols.rows.map((r) => r.column_name).join(", "));

try {
  const rows = await pool.query(`SELECT * FROM appraisals LIMIT 5`);
  console.log("Row count:", rows.rowCount);
  if (rows.rows[0]) console.log("Sample keys:", Object.keys(rows.rows[0]).join(", "));
} catch (e) {
  console.error("SELECT failed:", e.message);
}

await pool.end();
