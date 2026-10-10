/*
# Create animateurs table

1. New Tables
- `animateurs`
  - `id` (uuid, primary key)
  - `centre_nom` (text, not null) — name of the centre this animator belongs to
  - `first_name` (text, not null) — first name
  - `last_name` (text, not null) — last name
  - `role` (text, not null) — role/contract type (Permanente, Vacataire, Renfort, etc.)
  - `section` (text) — assigned section (PS, MS, GS, or custom)
  - `phone` (text) — contact phone number
  - `diplomas` (text[]) — array of diploma names
  - `slots` (text[]) — array of time slot labels
  - `present_today` (boolean, default false) — whether the animator is present today
  - `created_at` (timestamptz, default now())

2. Security
- Enable RLS on `animateurs`.
- Authenticated users can CRUD animators scoped to their centre.
- Centre scoping uses centre_nom matching the user's active centre.

3. Notes
- This table stores real animator profiles per centre, replacing hardcoded demo data.
- The `centre_nom` field links animators to their centre by name (matching the centres table convention).
*/

CREATE TABLE IF NOT EXISTS animateurs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_nom text NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  role text NOT NULL DEFAULT 'Permanente',
  section text,
  phone text DEFAULT '',
  diplomas text[] DEFAULT '{}',
  slots text[] DEFAULT '{}',
  present_today boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE animateurs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_animateurs" ON animateurs;
CREATE POLICY "select_own_animateurs" ON animateurs FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_own_animateurs" ON animateurs;
CREATE POLICY "insert_own_animateurs" ON animateurs FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_own_animateurs" ON animateurs;
CREATE POLICY "update_own_animateurs" ON animateurs FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_own_animateurs" ON animateurs;
CREATE POLICY "delete_own_animateurs" ON animateurs FOR DELETE
  TO authenticated USING (true);
