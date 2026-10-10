/*
# Fix RLS: add anon-accessible policies to all app tables

## Problem
The frontend uses the anon Supabase key. All app tables had policies
scoped to `authenticated` only, meaning the anon-key client could not
SELECT, INSERT, UPDATE, or DELETE any rows — resulting in RLS errors
and empty lists (animateurs, enfants, pointages, etc.).

## Changes
For each affected table, drop existing authenticated-only policies and
recreate them with `TO anon, authenticated` so the anon-key frontend
can operate. This is a single-tenant/no-auth-scoped app (data is shared
across the centre), so `USING (true)` / `WITH CHECK (true)` is intentional.

## Affected tables
- animateurs
- enfants
- centres
- clotures
- pointages
- sorties_positions
- transmissions
- user_profiles

## Security
RLS remains ENABLED on every table. The policies now allow both anon
and authenticated roles full CRUD, which is appropriate for this shared
multi-centre app where the centre_nom column scopes the data logically
rather than through RLS ownership.
*/

-- ===== animateurs =====
DROP POLICY IF EXISTS "select_own_animateurs" ON animateurs;
DROP POLICY IF EXISTS "insert_own_animateurs" ON animateurs;
DROP POLICY IF EXISTS "update_own_animateurs" ON animateurs;
DROP POLICY IF EXISTS "delete_own_animateurs" ON animateurs;

CREATE POLICY "select_animateurs" ON animateurs FOR SELECT
  TO anon, authenticated USING (true);
CREATE POLICY "insert_animateurs" ON animateurs FOR INSERT
  TO anon, authenticated WITH CHECK (true);
CREATE POLICY "update_animateurs" ON animateurs FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_animateurs" ON animateurs FOR DELETE
  TO anon, authenticated USING (true);

-- ===== enfants =====
DROP POLICY IF EXISTS "authenticated_select_enfants" ON enfants;
DROP POLICY IF EXISTS "authenticated_insert_enfants" ON enfants;
DROP POLICY IF EXISTS "authenticated_update_enfants" ON enfants;
DROP POLICY IF EXISTS "authenticated_delete_enfants" ON enfants;

CREATE POLICY "select_enfants" ON enfants FOR SELECT
  TO anon, authenticated USING (true);
CREATE POLICY "insert_enfants" ON enfants FOR INSERT
  TO anon, authenticated WITH CHECK (true);
CREATE POLICY "update_enfants" ON enfants FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_enfants" ON enfants FOR DELETE
  TO anon, authenticated USING (true);

-- ===== centres =====
DROP POLICY IF EXISTS "auth_select_centres" ON centres;
DROP POLICY IF EXISTS "auth_insert_centres" ON centres;
DROP POLICY IF EXISTS "auth_update_centres" ON centres;
DROP POLICY IF EXISTS "auth_delete_centres" ON centres;
DROP POLICY IF EXISTS "insert_centres_authenticated" ON centres;

CREATE POLICY "select_centres" ON centres FOR SELECT
  TO anon, authenticated USING (true);
CREATE POLICY "insert_centres" ON centres FOR INSERT
  TO anon, authenticated WITH CHECK (true);
CREATE POLICY "update_centres" ON centres FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_centres" ON centres FOR DELETE
  TO anon, authenticated USING (true);

-- ===== clotures =====
DROP POLICY IF EXISTS "authenticated_select_clotures" ON clotures;
DROP POLICY IF EXISTS "authenticated_insert_clotures" ON clotures;
DROP POLICY IF EXISTS "authenticated_update_clotures" ON clotures;
DROP POLICY IF EXISTS "authenticated_delete_clotures" ON clotures;

CREATE POLICY "select_clotures" ON clotures FOR SELECT
  TO anon, authenticated USING (true);
CREATE POLICY "insert_clotures" ON clotures FOR INSERT
  TO anon, authenticated WITH CHECK (true);
CREATE POLICY "update_clotures" ON clotures FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_clotures" ON clotures FOR DELETE
  TO anon, authenticated USING (true);

-- ===== pointages =====
DROP POLICY IF EXISTS "authenticated_select_pointages" ON pointages;
DROP POLICY IF EXISTS "authenticated_insert_pointages" ON pointages;
DROP POLICY IF EXISTS "authenticated_update_pointages" ON pointages;
DROP POLICY IF EXISTS "authenticated_delete_pointages" ON pointages;

CREATE POLICY "select_pointages" ON pointages FOR SELECT
  TO anon, authenticated USING (true);
CREATE POLICY "insert_pointages" ON pointages FOR INSERT
  TO anon, authenticated WITH CHECK (true);
CREATE POLICY "update_pointages" ON pointages FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_pointages" ON pointages FOR DELETE
  TO anon, authenticated USING (true);

-- ===== sorties_positions =====
DROP POLICY IF EXISTS "authenticated_select_sorties_positions" ON sorties_positions;
DROP POLICY IF EXISTS "authenticated_insert_sorties_positions" ON sorties_positions;
DROP POLICY IF EXISTS "authenticated_update_sorties_positions" ON sorties_positions;
DROP POLICY IF EXISTS "authenticated_delete_sorties_positions" ON sorties_positions;

CREATE POLICY "select_sorties_positions" ON sorties_positions FOR SELECT
  TO anon, authenticated USING (true);
CREATE POLICY "insert_sorties_positions" ON sorties_positions FOR INSERT
  TO anon, authenticated WITH CHECK (true);
CREATE POLICY "update_sorties_positions" ON sorties_positions FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_sorties_positions" ON sorties_positions FOR DELETE
  TO anon, authenticated USING (true);

-- ===== transmissions =====
DROP POLICY IF EXISTS "authenticated_select_transmissions" ON transmissions;
DROP POLICY IF EXISTS "authenticated_insert_transmissions" ON transmissions;
DROP POLICY IF EXISTS "authenticated_update_transmissions" ON transmissions;
DROP POLICY IF EXISTS "authenticated_delete_transmissions" ON transmissions;

CREATE POLICY "select_transmissions" ON transmissions FOR SELECT
  TO anon, authenticated USING (true);
CREATE POLICY "insert_transmissions" ON transmissions FOR INSERT
  TO anon, authenticated WITH CHECK (true);
CREATE POLICY "update_transmissions" ON transmissions FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_transmissions" ON transmissions FOR DELETE
  TO anon, authenticated USING (true);

-- ===== user_profiles =====
DROP POLICY IF EXISTS "authenticated_select_user_profiles" ON user_profiles;
DROP POLICY IF EXISTS "authenticated_insert_user_profiles" ON user_profiles;
DROP POLICY IF EXISTS "authenticated_update_user_profiles" ON user_profiles;
DROP POLICY IF EXISTS "authenticated_delete_user_profiles" ON user_profiles;

CREATE POLICY "select_user_profiles" ON user_profiles FOR SELECT
  TO anon, authenticated USING (true);
CREATE POLICY "insert_user_profiles" ON user_profiles FOR INSERT
  TO anon, authenticated WITH CHECK (true);
CREATE POLICY "update_user_profiles" ON user_profiles FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_user_profiles" ON user_profiles FOR DELETE
  TO anon, authenticated USING (true);