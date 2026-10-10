/*
# Create sorties_positions table for outdoor trip geolocation

## Purpose
Stores real-time GPS positions of animators during outdoor outings (sorties ALSH).
Positions are only written when an animator explicitly enables location sharing.
Rows are ephemeral: cleaned up when sharing stops (DELETE on stop).
Realtime sync allows all animators of the same centre to see each other on the map.

## Privacy by design
- The frontend never sends GPS data unless the user explicitly toggles the "Mode Sortie" switch.
- When the switch is turned off or the user leaves the page, the row is immediately deleted.
- No position history is retained -- only the current live position exists.

## New Tables
- `sorties_positions`
  - `id` (uuid, primary key, auto-generated)
  - `centre_nom` (text, not null) - centre this animator belongs to
  - `animateur_id` (text, not null) - animator identifier
  - `animateur_nom` (text, not null) - display name
  - `groupe_nom` (text, not null) - group label (e.g. "Groupe Matis - Maternelle")
  - `latitude` (double precision, not null)
  - `longitude` (double precision, not null)
  - `updated_at` (timestamptz, auto-updated)

## Security (RLS)
- RLS enabled, authenticated users can CRUD (shared team data within a centre)

## Realtime
- Publication created for live sync of position updates
*/

CREATE TABLE IF NOT EXISTS sorties_positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_nom text NOT NULL,
  animateur_id text NOT NULL,
  animateur_nom text NOT NULL,
  groupe_nom text NOT NULL,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sorties_positions_animateur
  ON sorties_positions (animateur_id, centre_nom);

CREATE INDEX IF NOT EXISTS idx_sorties_positions_centre
  ON sorties_positions (centre_nom);

CREATE OR REPLACE FUNCTION update_sorties_positions_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sorties_positions_updated_at ON sorties_positions;
CREATE TRIGGER trigger_sorties_positions_updated_at
  BEFORE UPDATE ON sorties_positions
  FOR EACH ROW
  EXECUTE FUNCTION update_sorties_positions_updated_at();

ALTER TABLE sorties_positions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_select_sorties_positions" ON sorties_positions;
CREATE POLICY "authenticated_select_sorties_positions"
  ON sorties_positions FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "authenticated_insert_sorties_positions" ON sorties_positions;
CREATE POLICY "authenticated_insert_sorties_positions"
  ON sorties_positions FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_update_sorties_positions" ON sorties_positions;
CREATE POLICY "authenticated_update_sorties_positions"
  ON sorties_positions FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_delete_sorties_positions" ON sorties_positions;
CREATE POLICY "authenticated_delete_sorties_positions"
  ON sorties_positions FOR DELETE TO authenticated USING (true);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'sorties_positions_publication') THEN
    CREATE PUBLICATION sorties_positions_publication FOR TABLE sorties_positions;
  ELSE
    ALTER PUBLICATION sorties_positions_publication ADD TABLE sorties_positions;
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
