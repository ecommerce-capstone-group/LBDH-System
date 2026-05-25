-- Run in Neon SQL Editor if applications fail with HTTP 500.
-- Adds contact fields required by the careers application form.

ALTER TABLE applicants ADD COLUMN IF NOT EXISTS email text NOT NULL DEFAULT '';
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS phone text NOT NULL DEFAULT '';
