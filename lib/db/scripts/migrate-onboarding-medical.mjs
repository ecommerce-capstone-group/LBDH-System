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
  console.log("Applying onboarding medical assessment schema…");
  await pool.query(`
    ALTER TABLE onboardings
      ADD COLUMN IF NOT EXISTS medical_status text,
      ADD COLUMN IF NOT EXISTS medical_notes text NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS medical_documents text NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS medical_updated_at timestamptz;
  `);
  console.log("Onboarding medical assessment schema ready.");
} finally {
  await pool.end();
}
