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

const check = await pool.query(
  `SELECT column_name FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'appraisals' AND column_name = 'template_type'`,
);

if (check.rows.length > 0) {
  console.log("OK — appraisals table already uses the new schema.");
  await pool.end();
  process.exit(0);
}

console.log("Migrating appraisals table to LBDH form schema…");

await pool.query(`
  DROP TABLE IF EXISTS appraisals CASCADE;

  CREATE TABLE appraisals (
    id serial PRIMARY KEY,
    employee_id integer NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    template_type text NOT NULL,
    appraisal_type text NOT NULL,
    employee_name text NOT NULL,
    department text NOT NULL,
    position text NOT NULL,
    hire_date date,
    appraisal_period text NOT NULL,
    evaluator text NOT NULL,
    evaluator_position text NOT NULL,
    appraisal_date date,
    strengths text NOT NULL DEFAULT '',
    areas_for_improvement text NOT NULL DEFAULT '',
    suggested_action_plan text NOT NULL DEFAULT '',
    short_term_goals text NOT NULL DEFAULT '',
    long_term_goals text NOT NULL DEFAULT '',
    criterion_scores jsonb NOT NULL,
    total_score real NOT NULL,
    recommendation text NOT NULL DEFAULT '',
    employee_acknowledgement text NOT NULL DEFAULT '',
    signatories jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
  );
`);

console.log("OK — appraisals table recreated with new columns.");
await pool.end();
