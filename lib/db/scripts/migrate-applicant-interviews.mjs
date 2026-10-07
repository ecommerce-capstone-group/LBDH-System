import pg from "pg";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..", "..", "..");
const envPath = path.join(root, ".env");

if (!process.env.DATABASE_URL && fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const match = line.match(/^\s*DATABASE_URL=(.+)$/);
    if (match) process.env.DATABASE_URL = match[1].trim().replace(/^["']|["']$/g, "");
  }
}

if (!process.env.DATABASE_URL) {
  console.error("Set DATABASE_URL in .env or environment.");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

try {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS applicant_interviews (
      id serial PRIMARY KEY,
      applicant_id integer NOT NULL REFERENCES applicants(id) ON DELETE CASCADE,
      stage text NOT NULL,
      scheduled_at timestamptz NOT NULL,
      interviewer text NOT NULL,
      notes text NOT NULL DEFAULT '',
      result text,
      outcome text,
      status text NOT NULL DEFAULT 'scheduled',
      completed_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS applicant_interviews_applicant_schedule_idx
      ON applicant_interviews(applicant_id, scheduled_at, id);
  `);
  console.log("Applicant interview schema ready.");
} catch (error) {
  console.error("Applicant interview migration failed.", error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
