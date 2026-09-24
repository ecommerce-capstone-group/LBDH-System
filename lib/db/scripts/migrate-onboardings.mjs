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

console.log("Applying onboardings schema…");

await pool.query(`
  CREATE TABLE IF NOT EXISTS onboardings (
    id serial PRIMARY KEY,
    applicant_id integer NOT NULL REFERENCES applicants(id) ON DELETE CASCADE,
    job_id integer NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    employee_id integer REFERENCES employees(id) ON DELETE SET NULL,
    applicant_name text NOT NULL,
    applicant_email text NOT NULL DEFAULT '',
    applicant_phone text NOT NULL DEFAULT '',
    job_title text NOT NULL,
    job_department text NOT NULL,
    interview_scheduled_at timestamptz,
    interview_notes text NOT NULL DEFAULT '',
    interview_status text NOT NULL DEFAULT 'pending',
    interview_result text NOT NULL DEFAULT '',
    pre_employment_requirements jsonb NOT NULL,
    status text NOT NULL DEFAULT 'in_progress',
    hr_notes text NOT NULL DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  );
`);

console.log("Onboardings schema ready.");
await pool.end();
