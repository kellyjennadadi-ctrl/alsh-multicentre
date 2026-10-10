/*
# Create enfants + clotures tables for Direction module

## Purpose
- `enfants`: persistent child records managed by directors (add/edit/delete)
- `clotures`: daily slot closures that lock pointages with timestamp + responsible name

## New Tables
- `enfants`
  - id (uuid PK)
  - centre_nom (text, not null)
  - first_name (text, not null)
  - last_name (text, not null)
  - section (text, not null) - PS/MS/GS/Elementaire
  - classe (text, not null)
  - birth_date (date, not null)
  - regime_alimentaire (text, nullable) - dietary regime
  - pai_allergie (text, nullable) - allergy if PAI
  - pai_protocole (text, nullable) - protocol
  - pai_contact_urgence (text, nullable) - emergency contact name
  - pai_telephone_urgence (text, nullable) - emergency phone
  - departure_time (text, nullable)
  - pickup_by (text, nullable)
  - created_at (timestamptz)

- `clotures`
  - id (uuid PK)
  - centre_nom (text, not null)
  - date_cloture (date, not null)
  - creneau (text, not null) - midi/soir/journee
  - responsable_nom (text, not null)
  - cloture_at (timestamptz, not null)
  - UNIQUE(centre_nom, date_cloture, creneau)

## Security (RLS)
- Both tables: authenticated users can SELECT, INSERT, UPDATE, DELETE
*/

CREATE TABLE IF NOT EXISTS enfants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_nom text NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  section text NOT NULL,
  classe text NOT NULL,
  birth_date date NOT NULL,
  regime_alimentaire text,
  pai_allergie text,
  pai_protocole text,
  pai_contact_urgence text,
  pai_telephone_urgence text,
  departure_time text,
  pickup_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_enfants_centre ON enfants (centre_nom);

ALTER TABLE enfants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_select_enfants" ON enfants;
CREATE POLICY "authenticated_select_enfants"
  ON enfants FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "authenticated_insert_enfants" ON enfants;
CREATE POLICY "authenticated_insert_enfants"
  ON enfants FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_update_enfants" ON enfants;
CREATE POLICY "authenticated_update_enfants"
  ON enfants FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_delete_enfants" ON enfants;
CREATE POLICY "authenticated_delete_enfants"
  ON enfants FOR DELETE TO authenticated USING (true);

-- Clotures table
CREATE TABLE IF NOT EXISTS clotures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_nom text NOT NULL,
  date_cloture date NOT NULL,
  creneau text NOT NULL,
  responsable_nom text NOT NULL,
  cloture_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (centre_nom, date_cloture, creneau)
);

ALTER TABLE clotures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_select_clotures" ON clotures;
CREATE POLICY "authenticated_select_clotures"
  ON clotures FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "authenticated_insert_clotures" ON clotures;
CREATE POLICY "authenticated_insert_clotures"
  ON clotures FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_delete_clotures" ON clotures;
CREATE POLICY "authenticated_delete_clotures"
  ON clotures FOR DELETE TO authenticated USING (true);
