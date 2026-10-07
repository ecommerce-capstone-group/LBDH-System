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
    CREATE TABLE IF NOT EXISTS manpower_requests (
      id serial PRIMARY KEY,
      position text NOT NULL,
      unit text NOT NULL,
      department text NOT NULL,
      staff_needed integer NOT NULL CHECK (staff_needed > 0),
      vacancy_type text NOT NULL,
      vacancy_details text NOT NULL DEFAULT '',
      job_description text NOT NULL,
      qualifications text NOT NULL,
      approvals jsonb NOT NULL DEFAULT '[]'::jsonb,
      status text NOT NULL DEFAULT 'pending',
      created_at timestamptz NOT NULL DEFAULT now()
    );

    ALTER TABLE jobs
      ADD COLUMN IF NOT EXISTS manpower_request_id integer;

    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'jobs_manpower_request_id_fkey'
      ) THEN
        ALTER TABLE jobs
          ADD CONSTRAINT jobs_manpower_request_id_fkey
          FOREIGN KEY (manpower_request_id)
          REFERENCES manpower_requests(id)
          ON DELETE RESTRICT;
      END IF;
    END $$;

    CREATE UNIQUE INDEX IF NOT EXISTS jobs_manpower_request_id_unique
      ON jobs(manpower_request_id)
      WHERE manpower_request_id IS NOT NULL;
  `);
  console.log("Manpower request schema ready.");
} catch (error) {
  console.error("Manpower request migration failed.", error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
