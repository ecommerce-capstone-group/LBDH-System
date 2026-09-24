/**
 * Ensure employee_accounts exists (Self-Service logins linked to employees).
 * Safe to run repeatedly.
 */
import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: url });

try {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS employee_accounts (
      id serial PRIMARY KEY,
      employee_id integer NOT NULL UNIQUE REFERENCES employees(id) ON DELETE CASCADE,
      username text NOT NULL UNIQUE,
      password_hash text NOT NULL,
      password_salt text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  console.log("employee_accounts table ready.");
} finally {
  await pool.end();
}
