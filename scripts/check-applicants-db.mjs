import pg from "pg";
import fs from "fs";
import path from "path";

const root = path.resolve(import.meta.dirname, "..");
const envPath = path.join(root, ".env");
if (!process.env.DATABASE_URL && fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^\s*DATABASE_URL=(.+)$/);
    if (m) process.env.DATABASE_URL = m[1].trim().replace(/^["']|["']$/g, "");
  }
}

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const cols = await pool.query(
  "SELECT column_name FROM information_schema.columns WHERE table_name = 'applicants' ORDER BY 1",
);
console.log("columns:", cols.rows.map((r) => r.column_name).join(", "));
const rows = await pool.query(
  "SELECT id, name, email, phone, job_id FROM applicants ORDER BY id DESC LIMIT 5",
);
console.log("rows:", JSON.stringify(rows.rows, null, 2));
await pool.end();
