/*
# Multi-centre authentication tables

## Context
The app now requires authentication (email/password via Supabase Auth) and
multi-centre support. Each authenticated user has a profile with a display
name and role (animateur/directeur). Centres are shared structures with a
PIN code that gates access.

## New Tables

1. `centres`
   - id (uuid PK)
   - name (text, not null) — display name of the structure
   - pin_code (text, not null) — 4-6 digit access code (default '2026')
   - created_at (timestamptz)

2. `user_profiles`
   - id (uuid PK, references auth.users ON DELETE CASCADE)
   - email (text, not null)
   - full_name (text, not null) — display name shown in UI
   - role (text: 'animateur' or 'directeur', default 'animateur')
   - created_at (timestamptz)

## Security

- `centres`: RLS enabled. SELECT allowed for authenticated users (they need
  to see the list to choose one). INSERT/UPDATE/DELETE restricted to
  authenticated users as well (only directors would manage centres in a
  real deployment; for now all authenticated users can manage).
- `user_profiles`: RLS enabled. Each authenticated user can SELECT and
  UPDATE only their own profile row. INSERT is allowed for authenticated
  users (self-registration of profile on first login).

## Notes
- The `user_profiles.id` column doubles as the foreign key to `auth.users`,
  so `DEFAULT auth.uid()` ensures inserts from the client succeed even when
  the client omits the id.
- Email confirmation is OFF (per project convention).
*/

-- ── Centres ──
CREATE TABLE IF NOT EXISTS centres (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  pin_code text NOT NULL DEFAULT '2026',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE centres ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_select_centres" ON centres;
CREATE POLICY "auth_select_centres" ON centres FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "auth_insert_centres" ON centres;
CREATE POLICY "auth_insert_centres" ON centres FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "auth_update_centres" ON centres;
CREATE POLICY "auth_update_centres" ON centres FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_delete_centres" ON centres;
CREATE POLICY "auth_delete_centres" ON centres FOR DELETE
  TO authenticated USING (true);

-- ── User profiles ──
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text NOT NULL,
  role text NOT NULL DEFAULT 'animateur' CHECK (role IN ('animateur', 'directeur')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_profile" ON user_profiles;
CREATE POLICY "select_own_profile" ON user_profiles FOR SELECT
  TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "insert_own_profile" ON user_profiles;
CREATE POLICY "insert_own_profile" ON user_profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "update_own_profile" ON user_profiles;
CREATE POLICY "update_own_profile" ON user_profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- ── Seed demo centres ──
INSERT INTO centres (name, pin_code) VALUES
  ('Centre Les Petits Princes', '2026'),
  ('Centre Jean Jaurès', '2026'),
  ('ALSH Les Écureuils', '2026')
ON CONFLICT DO NOTHING;
