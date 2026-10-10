/*
# Create field trip tables (sorties_liste + sorties_enfants)

1. New Tables
- `sorties_liste`: Field trips organized by centre
  - id (uuid PK)
  - centre_nom (text, references centres)
  - destination (text, not null)
  - date (date, not null)
  - heure_depart (text)
  - heure_retour (text)
  - created_at (timestamptz)
- `sorties_enfants`: Children assigned to a field trip
  - id (uuid PK)
  - trip_id (uuid, FK to sorties_liste, cascade delete)
  - child_name (text, not null)
  - group_name (text, default 'Groupe 1')
  - depart_checked (boolean, default false)
  - retour_checked (boolean, default false)
  - has_pai (boolean, default false)
  - pai_allergy (text, nullable)

2. Security
- RLS enabled on both tables.
- Anon + authenticated CRUD (multi-centre app uses centre_nom for scoping, data is shared within a centre).
*/

CREATE TABLE IF NOT EXISTS sorties_liste (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_nom text NOT NULL,
  destination text NOT NULL,
  date date NOT NULL,
  heure_depart text DEFAULT '09:00',
  heure_retour text DEFAULT '16:00',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE sorties_liste ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_sorties_liste" ON sorties_liste;
CREATE POLICY "anon_select_sorties_liste" ON sorties_liste FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_sorties_liste" ON sorties_liste;
CREATE POLICY "anon_insert_sorties_liste" ON sorties_liste FOR INSERT
TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_sorties_liste" ON sorties_liste;
CREATE POLICY "anon_update_sorties_liste" ON sorties_liste FOR UPDATE
TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_sorties_liste" ON sorties_liste;
CREATE POLICY "anon_delete_sorties_liste" ON sorties_liste FOR DELETE
TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS sorties_enfants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES sorties_liste(id) ON DELETE CASCADE,
  child_name text NOT NULL,
  group_name text NOT NULL DEFAULT 'Groupe 1',
  depart_checked boolean NOT NULL DEFAULT false,
  retour_checked boolean NOT NULL DEFAULT false,
  has_pai boolean NOT NULL DEFAULT false,
  pai_allergy text
);

ALTER TABLE sorties_enfants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_sorties_enfants" ON sorties_enfants;
CREATE POLICY "anon_select_sorties_enfants" ON sorties_enfants FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_sorties_enfants" ON sorties_enfants;
CREATE POLICY "anon_insert_sorties_enfants" ON sorties_enfants FOR INSERT
TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_sorties_enfants" ON sorties_enfants;
CREATE POLICY "anon_update_sorties_enfants" ON sorties_enfants FOR UPDATE
TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_sorties_enfants" ON sorties_enfants;
CREATE POLICY "anon_delete_sorties_enfants" ON sorties_enfants FOR DELETE
TO anon, authenticated USING (true);
