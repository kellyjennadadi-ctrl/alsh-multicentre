/*
# Create classes table and add inscription columns to enfants

1. New Tables
- `classes` — Stores school classes per centre with teacher name, short code, and color.
  - `id` (uuid, primary key)
  - `centre_nom` (text, not null) — which centre this class belongs to
  - `name` (text, not null) — display name (e.g. "Petite Section", "CP")
  - `code` (text, not null) — short code (e.g. "PS", "MS", "GS", "CP")
  - `level` (text, not null) — level category: 'PS', 'MS', 'GS', 'Elementaire', 'Double'
  - `teacher_name` (text, nullable) — referent teacher name (e.g. "Mme Martin")
  - `color` (text, nullable) — hex color for identification
  - `sort_order` (int, default 0) — display order
  - `created_at` (timestamptz, default now())

2. Modified Tables
- `enfants` — Add three boolean columns to track per-slot inscriptions:
  - `inscrit_midi` (boolean, default false) — enrolled in midi cantine
  - `inscrit_soir` (boolean, default false) — enrolled in soir periscolaire
  - `inscrit_mercredi` (boolean, default false) — enrolled in mercredi ALSH

3. Security
- Enable RLS on `classes`.
- Add anon+authenticated CRUD policies (shared data model, same as other tables).
- No RLS changes to `enfants` (existing policies cover new columns since they grant all columns).

4. Important Notes
- The `classes` table replaces the in-memory `SchoolClass` array. Existing class data
  will need to be seeded from the app or created via the Direction UI.
- The inscription columns on `enfants` allow the Excel import to mark which slot(s)
  each child is enrolled in without creating duplicate rows.
*/

CREATE TABLE IF NOT EXISTS classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_nom text NOT NULL,
  name text NOT NULL,
  code text NOT NULL DEFAULT '',
  level text NOT NULL DEFAULT 'PS',
  teacher_name text,
  color text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE classes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_classes" ON classes;
CREATE POLICY "select_classes" ON classes FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "insert_classes" ON classes;
CREATE POLICY "insert_classes" ON classes FOR INSERT
TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_classes" ON classes;
CREATE POLICY "update_classes" ON classes FOR UPDATE
TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_classes" ON classes;
CREATE POLICY "delete_classes" ON classes FOR DELETE
TO anon, authenticated USING (true);

-- Add inscription columns to enfants (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'enfants' AND column_name = 'inscrit_midi') THEN
    ALTER TABLE enfants ADD COLUMN inscrit_midi boolean NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'enfants' AND column_name = 'inscrit_soir') THEN
    ALTER TABLE enfants ADD COLUMN inscrit_soir boolean NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'enfants' AND column_name = 'inscrit_mercredi') THEN
    ALTER TABLE enfants ADD COLUMN inscrit_mercredi boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- Enable realtime on classes
ALTER PUBLICATION supabase_realtime ADD TABLE classes;
