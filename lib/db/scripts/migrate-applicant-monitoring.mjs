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
    ALTER TABLE applicants ADD COLUMN IF NOT EXISTS stage_outcome text;
    ALTER TABLE applicants ADD COLUMN IF NOT EXISTS stage_updated_at timestamptz NOT NULL DEFAULT now();
    ALTER TABLE applicants ADD COLUMN IF NOT EXISTS pre_employment_requirements jsonb NOT NULL DEFAULT '[]'::jsonb;
    ALTER TABLE onboardings ADD COLUMN IF NOT EXISTS starting_date date;
    ALTER TABLE onboardings ADD COLUMN IF NOT EXISTS progress_stage text NOT NULL DEFAULT 'Pre-Employment Requirements';
    CREATE TABLE IF NOT EXISTS applicant_recruitment_history (
      id serial PRIMARY KEY,
      applicant_id integer NOT NULL REFERENCES applicants(id) ON DELETE CASCADE,
      previous_stage text,
      stage text NOT NULL,
      changed_at timestamptz NOT NULL DEFAULT now()
    );
    ALTER TABLE applicant_recruitment_history ADD COLUMN IF NOT EXISTS stage_outcome text;
    ALTER TABLE applicant_recruitment_history ADD COLUMN IF NOT EXISTS previous_stage_outcome text;
    UPDATE applicants a
    SET stage_outcome = CASE
      WHEN a.stage IN ('Passed Initial Interview', 'Passed Final Interview') THEN 'Passed'
      WHEN a.stage IN ('Not Passed - Initial Interview', 'Not Passed - Final Interview', 'Not Passed') THEN 'Not Passed'
      WHEN a.stage = 'Accepted Offer' THEN 'Accepted Offer'
      WHEN a.stage = 'Declined Offer' THEN 'Declined Offer'
      ELSE a.stage_outcome
    END,
    stage = CASE
      WHEN a.stage IN ('Passed Initial Interview', 'Not Passed - Initial Interview') THEN 'For Initial Interview'
      WHEN a.stage IN ('Passed Final Interview', 'Not Passed - Final Interview') THEN 'For Final Interview'
      WHEN a.stage IN ('For Job Offer', 'Accepted Offer', 'Declined Offer') THEN 'For Job Offering'
      WHEN a.stage IN ('Ongoing Pre-Employment Requirements', 'For Physical Exam', 'Fit to Work',
                       'Not Fit', 'Not Passed - Medical/Physical Exam', 'Starting Date', 'Onboarding',
                       'Employee Profile Created', 'Employee Account Created') THEN 'On-going Pre-Employment'
      WHEN a.stage = 'Not Passed' THEN CASE
        WHEN (
          SELECT h.previous_stage FROM applicant_recruitment_history h
          WHERE h.applicant_id = a.id AND h.stage = 'Not Passed'
          ORDER BY h.changed_at DESC, h.id DESC LIMIT 1
        ) = 'For Final Interview' THEN 'For Final Interview'
        ELSE 'For Initial Interview'
      END
      ELSE a.stage
    END
    WHERE a.stage NOT IN ('For Initial Interview', 'For Final Interview', 'For Job Offering',
                          'On-going Pre-Employment', 'Onboarded', 'Withdraw Application', 'No Show');
    UPDATE applicant_recruitment_history
    SET stage_outcome = CASE
      WHEN stage IN ('Passed Initial Interview', 'Passed Final Interview') THEN 'Passed'
      WHEN stage IN ('Not Passed - Initial Interview', 'Not Passed - Final Interview', 'Not Passed') THEN 'Not Passed'
      WHEN stage = 'Accepted Offer' THEN 'Accepted Offer'
      WHEN stage = 'Declined Offer' THEN 'Declined Offer'
      ELSE stage_outcome
    END,
    stage = CASE
      WHEN stage IN ('Passed Initial Interview', 'Not Passed - Initial Interview') THEN 'For Initial Interview'
      WHEN stage IN ('Passed Final Interview', 'Not Passed - Final Interview') THEN 'For Final Interview'
      WHEN stage IN ('For Job Offer', 'Accepted Offer', 'Declined Offer') THEN 'For Job Offering'
      WHEN stage IN ('Ongoing Pre-Employment Requirements', 'For Physical Exam', 'Fit to Work',
                     'Not Fit', 'Not Passed - Medical/Physical Exam', 'Starting Date', 'Onboarding',
                     'Employee Profile Created', 'Employee Account Created') THEN 'On-going Pre-Employment'
      WHEN stage = 'Not Passed' THEN CASE
        WHEN previous_stage = 'For Final Interview' THEN 'For Final Interview'
        ELSE 'For Initial Interview'
      END
      ELSE stage
    END;
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
  await pool.query(`
    UPDATE onboardings
    SET progress_stage = CASE
      WHEN status = 'hired' THEN 'Completed'
      WHEN status = 'approved' THEN 'Onboarding'
      WHEN starting_date IS NOT NULL THEN 'Starting Date'
      ELSE 'Pre-Employment Requirements'
    END
    WHERE progress_stage = 'Pre-Employment Requirements';
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
