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
const requirements = [
  "Birth Certificate",
  "Diploma",
  "TOR",
  "PRC License",
  "Board Certification",
  "Board Rating",
  "NBI Clearance",
  "Police Clearance",
  "Brgy Clearance",
  "Cedula",
  "2x2 1x1 pictures",
  "COE",
  "Training Certificates",
  "Vaccination Card",
  "Marriage Certificate",
  "BC (Children)",
  "Solo Parent",
  "BPI",
  "SSS",
  "PAGIBIG",
  "PHIC",
  "TIN",
  "Medical",
  "Physical",
].map((label) => ({ label, done: false }));

try {
  await pool.query(`
    ALTER TABLE jobs ADD COLUMN IF NOT EXISTS unit text NOT NULL DEFAULT '';
    ALTER TABLE applicants ADD COLUMN IF NOT EXISTS address text NOT NULL DEFAULT '';
    ALTER TABLE applicants ADD COLUMN IF NOT EXISTS stage text NOT NULL DEFAULT 'For Initial Interview';
    ALTER TABLE applicants ADD COLUMN IF NOT EXISTS stage_updated_at timestamptz NOT NULL DEFAULT now();
    ALTER TABLE applicants ADD COLUMN IF NOT EXISTS pre_employment_requirements jsonb NOT NULL DEFAULT '[]'::jsonb;
    CREATE TABLE IF NOT EXISTS applicant_recruitment_history (
      id serial PRIMARY KEY,
      applicant_id integer NOT NULL REFERENCES applicants(id) ON DELETE CASCADE,
      previous_stage text,
      stage text NOT NULL,
      changed_at timestamptz NOT NULL DEFAULT now()
    );
    UPDATE applicants
    SET stage_updated_at = created_at
    WHERE stage = 'For Initial Interview'
      AND NOT EXISTS (
        SELECT 1 FROM applicant_recruitment_history h WHERE h.applicant_id = applicants.id
      );
    INSERT INTO applicant_recruitment_history (applicant_id, previous_stage, stage, changed_at)
    SELECT a.id, NULL, a.stage, a.stage_updated_at
    FROM applicants a
    WHERE NOT EXISTS (
      SELECT 1 FROM applicant_recruitment_history h WHERE h.applicant_id = a.id
    );
  `);
  await pool.query(
    `UPDATE applicants
     SET pre_employment_requirements = $1::jsonb
     WHERE pre_employment_requirements = '[]'::jsonb`,
    [JSON.stringify(requirements)],
  );
  console.log("Applicant monitoring schema and existing applicant history are ready.");
} finally {
  await pool.end();
}
