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

console.log("Applying employee incidents schema…");

await pool.query(`
  CREATE TABLE IF NOT EXISTS employee_incidents (
    id serial PRIMARY KEY,
    employee_id integer NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    incident_date date NOT NULL,
    policy_violated text NOT NULL,
    violation_description text NOT NULL,
    department text NOT NULL DEFAULT '',
    action_taken text NOT NULL,
    action_details text NOT NULL DEFAULT '',
    status text NOT NULL DEFAULT 'ongoing',
    hr_remarks text NOT NULL DEFAULT '',
    approving_authority text NOT NULL DEFAULT '',
    related_appraisal_period text,
    created_at timestamptz NOT NULL DEFAULT now()
  );
`);

console.log("Employee incidents schema ready.");
await pool.end();
