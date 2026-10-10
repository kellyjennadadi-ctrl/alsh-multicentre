/*
# Create tables for the "Boîte à Outils" section

This migration creates four tables to persist the animation resources
used by the "Outils" tab: songs, playlists, games, and tutorials.

The app has no sign-in screen, so all data is intentionally shared/public
(single-tenant). Policies allow both anon and authenticated roles to
read, insert, update, and delete every row.

## New Tables

1. `outils_songs`
   - id (uuid PK)
   - title (text, not null)
   - lyrics (text, not null)
   - refrain (text, not null)
   - level (text: 'maternelle' or 'élémentaire')
   - audio_url (text, nullable)
   - created_at (timestamptz)

2. `outils_playlists`
   - id (uuid PK)
   - title (text, not null)
   - description (text, not null)
   - theme (text: 'calme', 'dynamique', 'jeux', 'fete')
   - url (text, not null)
   - color (text, not null) — tailwind gradient classes
   - icon (text, not null) — icon key
   - created_at (timestamptz)

3. `outils_games`
   - id (uuid PK)
   - title (text, not null)
   - location (text: 'interieur' or 'exterieur')
   - age (text: 'PS', 'MS', 'GS')
   - duration (text: 'short', 'medium', 'long')
   - players (text, not null)
   - objectives (text, not null)
   - material (text, not null)
   - rules (text[], not null)
   - variant (text, not null)
   - created_at (timestamptz)

4. `outils_tutorials`
   - id (uuid PK)
   - title (text, not null)
   - category (text: 'bricolage', 'recyclage', 'saisons')
   - difficulty (text: 'Facile', 'Moyen', 'Difficile')
   - recommended_age (text, not null)
   - material (text[], not null)
   - steps (text[], not null)
   - created_at (timestamptz)

## Security

- RLS enabled on all four tables.
- Each table has 4 policies (SELECT/INSERT/UPDATE/DELETE) scoped to
  `TO anon, authenticated` with `USING (true)` / `WITH CHECK (true)`
  because the data is intentionally public/shared in this no-auth app.
*/

-- ── Songs ──
CREATE TABLE IF NOT EXISTS outils_songs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  lyrics text NOT NULL,
  refrain text NOT NULL,
  level text NOT NULL DEFAULT 'maternelle' CHECK (level IN ('maternelle', 'élémentaire')),
  audio_url text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE outils_songs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_songs" ON outils_songs;
CREATE POLICY "anon_select_songs" ON outils_songs FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_songs" ON outils_songs;
CREATE POLICY "anon_insert_songs" ON outils_songs FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_songs" ON outils_songs;
CREATE POLICY "anon_update_songs" ON outils_songs FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_songs" ON outils_songs;
CREATE POLICY "anon_delete_songs" ON outils_songs FOR DELETE
  TO anon, authenticated USING (true);

-- ── Playlists ──
CREATE TABLE IF NOT EXISTS outils_playlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL,
  theme text NOT NULL DEFAULT 'calme' CHECK (theme IN ('calme', 'dynamique', 'jeux', 'fete')),
  url text NOT NULL,
  color text NOT NULL,
  icon text NOT NULL DEFAULT 'music',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE outils_playlists ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_playlists" ON outils_playlists;
CREATE POLICY "anon_select_playlists" ON outils_playlists FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_playlists" ON outils_playlists;
CREATE POLICY "anon_insert_playlists" ON outils_playlists FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_playlists" ON outils_playlists;
CREATE POLICY "anon_update_playlists" ON outils_playlists FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_playlists" ON outils_playlists;
CREATE POLICY "anon_delete_playlists" ON outils_playlists FOR DELETE
  TO anon, authenticated USING (true);

-- ── Games ──
CREATE TABLE IF NOT EXISTS outils_games (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  location text NOT NULL DEFAULT 'exterieur' CHECK (location IN ('interieur', 'exterieur')),
  age text NOT NULL DEFAULT 'PS' CHECK (age IN ('PS', 'MS', 'GS')),
  duration text NOT NULL DEFAULT 'short' CHECK (duration IN ('short', 'medium', 'long')),
  players text NOT NULL,
  objectives text NOT NULL,
  material text NOT NULL,
  rules text[] NOT NULL DEFAULT '{}',
  variant text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE outils_games ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_games" ON outils_games;
CREATE POLICY "anon_select_games" ON outils_games FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_games" ON outils_games;
CREATE POLICY "anon_insert_games" ON outils_games FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_games" ON outils_games;
CREATE POLICY "anon_update_games" ON outils_games FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_games" ON outils_games;
CREATE POLICY "anon_delete_games" ON outils_games FOR DELETE
  TO anon, authenticated USING (true);

-- ── Tutorials ──
CREATE TABLE IF NOT EXISTS outils_tutorials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  category text NOT NULL DEFAULT 'bricolage' CHECK (category IN ('bricolage', 'recyclage', 'saisons')),
  difficulty text NOT NULL DEFAULT 'Facile' CHECK (difficulty IN ('Facile', 'Moyen', 'Difficile')),
  recommended_age text NOT NULL,
  material text[] NOT NULL DEFAULT '{}',
  steps text[] NOT NULL DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE outils_tutorials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_tutorials" ON outils_tutorials;
CREATE POLICY "anon_select_tutorials" ON outils_tutorials FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_tutorials" ON outils_tutorials;
CREATE POLICY "anon_insert_tutorials" ON outils_tutorials FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_tutorials" ON outils_tutorials;
CREATE POLICY "anon_update_tutorials" ON outils_tutorials FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_tutorials" ON outils_tutorials;
CREATE POLICY "anon_delete_tutorials" ON outils_tutorials FOR DELETE
  TO anon, authenticated USING (true);
