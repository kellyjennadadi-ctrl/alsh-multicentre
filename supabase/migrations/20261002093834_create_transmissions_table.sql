/*
# Create transmissions table for team notes

## Purpose
Stores quick field notes left by animators about children (e.g. "A pleure a la sieste", "Pris par la grand-mere").
Shared across the team of the same centre - all authenticated users see all notes.

## New Tables
- `transmissions`
  - `id` (uuid, primary key, auto-generated)
  - `centre_nom` (text, not null) - centre this note belongs to
  - `enfant_nom` (text, not null) - child's full name
  - `note` (text, not null) - the transmission message
  - `animateur_nom` (text, not null) - name of the animator who wrote it
  - `date_note` (date, not null) - date of the note
  - `created_at` (timestamptz, auto)

## Security (RLS)
- RLS enabled, authenticated users can CRUD (shared team data)

## Realtime
- Publication created for live sync across devices
*/

CREATE TABLE IF NOT EXISTS transmissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_nom text NOT NULL,
  enfant_nom text NOT NULL,
  note text NOT NULL,
  animateur_nom text NOT NULL,
  date_note date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transmissions_centre_date
  ON transmissions (centre_nom, date_note);

ALTER TABLE transmissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_select_transmissions" ON transmissions;
CREATE POLICY "authenticated_select_transmissions"
  ON transmissions FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "authenticated_insert_transmissions" ON transmissions;
CREATE POLICY "authenticated_insert_transmissions"
  ON transmissions FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_delete_transmissions" ON transmissions;
CREATE POLICY "authenticated_delete_transmissions"
  ON transmissions FOR DELETE TO authenticated USING (true);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'transmissions_publication') THEN
    CREATE PUBLICATION transmissions_publication FOR TABLE transmissions;
  ELSE
    ALTER PUBLICATION transmissions_publication ADD TABLE transmissions;
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
