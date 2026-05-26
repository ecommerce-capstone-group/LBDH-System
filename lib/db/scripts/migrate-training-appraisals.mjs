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

console.log("Applying training + appraisal workflow schema…");

await pool.query(`
  CREATE TABLE IF NOT EXISTS training_plans (
    id serial PRIMARY KEY,
    year integer NOT NULL,
    category text NOT NULL,
    title text NOT NULL,
    description text NOT NULL DEFAULT '',
    training_hours real NOT NULL DEFAULT 0,
    planned_date date,
    department text,
    employee_id integer REFERENCES employees(id) ON DELETE SET NULL,
    status text NOT NULL DEFAULT 'published',
    current_step text NOT NULL DEFAULT '',
    steps jsonb NOT NULL DEFAULT '[]'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS training_enrollments (
    id serial PRIMARY KEY,
    plan_id integer NOT NULL REFERENCES training_plans(id) ON DELETE CASCADE,
    employee_id integer NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    status text NOT NULL DEFAULT 'enrolled',
    created_at timestamptz NOT NULL DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS training_records (
    id serial PRIMARY KEY,
    employee_id integer NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    plan_id integer REFERENCES training_plans(id) ON DELETE SET NULL,
    enrollment_id integer REFERENCES training_enrollments(id) ON DELETE SET NULL,
    training_name text NOT NULL,
    training_date date NOT NULL,
    training_hours real NOT NULL,
    training_type text NOT NULL,
    completion_status text NOT NULL DEFAULT 'completed',
    remarks text NOT NULL DEFAULT '',
    contract_agreement text NOT NULL DEFAULT '',
    file_reference text NOT NULL DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT now()
  );

  ALTER TABLE appraisals ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'archived';
  ALTER TABLE appraisals ADD COLUMN IF NOT EXISTS current_step text NOT NULL DEFAULT 'Archived';
  ALTER TABLE appraisals ADD COLUMN IF NOT EXISTS steps jsonb NOT NULL DEFAULT '[]'::jsonb;
  ALTER TABLE appraisals ADD COLUMN IF NOT EXISTS employee_self_assessment text NOT NULL DEFAULT '';
  ALTER TABLE appraisals ADD COLUMN IF NOT EXISTS appraiser_comments text NOT NULL DEFAULT '';
  ALTER TABLE appraisals ADD COLUMN IF NOT EXISTS department_head_comments text NOT NULL DEFAULT '';
  ALTER TABLE appraisals ADD COLUMN IF NOT EXISTS hr_comments text NOT NULL DEFAULT '';
  ALTER TABLE appraisals ADD COLUMN IF NOT EXISTS signed_form_reference text NOT NULL DEFAULT '';
  ALTER TABLE appraisals ADD COLUMN IF NOT EXISTS archived_at timestamptz;

  UPDATE appraisals
  SET status = 'archived', current_step = 'Archived'
  WHERE status IS NULL OR status = 'archived';
`);

console.log("OK — training tables and appraisal workflow columns ready.");
await pool.end();
