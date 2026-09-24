-- Add staff_needed to jobs (number of positions to fill).
-- Safe to run multiple times.
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS staff_needed integer NOT NULL DEFAULT 1;
