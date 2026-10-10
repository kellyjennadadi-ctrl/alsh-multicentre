/*
# Create pointages table with realtime sync

## Purpose
Stores daily attendance records for children across centres.
Each row tracks one child's status (present/absent/parti) for one time slot (midi/soir/journee) on a given date.
Enables multi-device realtime sync: when one phone marks a child present, all other phones on the same centre see the update instantly.

## New Tables
- `pointages`
  - `id` (uuid, primary key, auto-generated)
  - `centre_nom` (text, not null) - name of the centre this pointage belongs to
  - `enfant_nom` (text, not null) - full name of the child
  - `statut` (text, not null) - attendance status: "present", "absent", or "parti"
  - `creneau` (text, not null) - time slot: "midi", "soir", or "journee"
  - `date_pointage` (date, not null) - the date of the attendance record
  - `updated_at` (timestamptz, auto-updated) - last modification timestamp

## Indexes
- Unique index on (centre_nom, enfant_nom, creneau, date_pointage) to prevent duplicate records for the same child/slot/day
- Index on centre_nom + date_pointage for fast lookups

## Security (RLS)
- RLS enabled on `pointages`
- All CRUD policies scoped to `authenticated` role (app has sign-in screen)
- Any authenticated user can read/write pointages (shared team data, not per-user owned)
- This is intentional: pointages are collaborative team records, not private user data

## Realtime
- Publication `pointages_publication` created and table added to it
- Frontend subscribes via supabase channel to receive INSERT/UPDATE/DELETE events
*/

CREATE TABLE IF NOT EXISTS pointages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_nom text NOT NULL,
  enfant_nom text NOT NULL,
  statut text NOT NULL CHECK (statut IN ('present', 'absent', 'parti')),
  creneau text NOT NULL CHECK (creneau IN ('midi', 'soir', 'journee')),
  date_pointage date NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Unique constraint: one record per child per slot per day per centre
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pointages_unique_record'
  ) THEN
    ALTER TABLE pointages
    ADD CONSTRAINT pointages_unique_record UNIQUE (centre_nom, enfant_nom, creneau, date_pointage);
  END IF;
END $$;

-- Index for fast queries by centre + date
CREATE INDEX IF NOT EXISTS idx_pointages_centre_date
  ON pointages (centre_nom, date_pointage);

-- Auto-update updated_at on row change
CREATE OR REPLACE FUNCTION update_pointages_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_pointages_updated_at ON pointages;
CREATE TRIGGER trigger_pointages_updated_at
  BEFORE UPDATE ON pointages
  FOR EACH ROW
  EXECUTE FUNCTION update_pointages_updated_at();

-- Enable RLS
ALTER TABLE pointages ENABLE ROW LEVEL SECURITY;

-- Policies: authenticated users can manage all pointages (shared team data)
DROP POLICY IF EXISTS "authenticated_select_pointages" ON pointages;
CREATE POLICY "authenticated_select_pointages"
  ON pointages FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "authenticated_insert_pointages" ON pointages;
CREATE POLICY "authenticated_insert_pointages"
  ON pointages FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_update_pointages" ON pointages;
CREATE POLICY "authenticated_update_pointages"
  ON pointages FOR UPDATE
  TO authenticated
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_delete_pointages" ON pointages;
CREATE POLICY "authenticated_delete_pointages"
  ON pointages FOR DELETE
  TO authenticated
  USING (true);

-- Enable Realtime
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'pointages_publication'
  ) THEN
    CREATE PUBLICATION pointages_publication FOR TABLE pointages;
  ELSE
    ALTER PUBLICATION pointages_publication ADD TABLE pointages;
  END IF;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;
