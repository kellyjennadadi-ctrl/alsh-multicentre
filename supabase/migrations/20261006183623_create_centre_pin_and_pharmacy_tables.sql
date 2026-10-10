/*
# Create centre PIN config and pharmacy inventory tables

1. New Tables
- `centre_config`: stores per-centre configuration (PIN code for adjoint access)
  - `id` (uuid, PK)
  - `centre_nom` (text, unique) — links to the centre
  - `adjoint_pin` (text, default '2026') — 4-digit PIN for adjoint access
  - `updated_at` (timestamptz)
- `pharmacie_items`: pharmacy/trousse inventory items
  - `id` (uuid, PK)
  - `centre_nom` (text) — links to the centre
  - `nom` (text) — product name
  - `quantite` (text) — quantity description
  - `statut` (text, default 'ok') — 'ok' or 'low'
  - `code_barres` (text, nullable) — barcode scanned value
  - `date_peremption` (date, nullable) — expiry date
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

2. Security
- Enable RLS on both tables.
- Allow anon + authenticated CRUD on both tables (no-auth app pattern, data is shared per centre).
*/

CREATE TABLE IF NOT EXISTS centre_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_nom text UNIQUE NOT NULL,
  adjoint_pin text NOT NULL DEFAULT '2026',
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE centre_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_centre_config" ON centre_config;
CREATE POLICY "anon_select_centre_config" ON centre_config FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_centre_config" ON centre_config;
CREATE POLICY "anon_insert_centre_config" ON centre_config FOR INSERT
TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_centre_config" ON centre_config;
CREATE POLICY "anon_update_centre_config" ON centre_config FOR UPDATE
TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_centre_config" ON centre_config;
CREATE POLICY "anon_delete_centre_config" ON centre_config FOR DELETE
TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS pharmacie_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_nom text NOT NULL,
  nom text NOT NULL,
  quantite text NOT NULL DEFAULT '',
  statut text NOT NULL DEFAULT 'ok',
  code_barres text,
  date_peremption date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE pharmacie_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_pharmacie" ON pharmacie_items;
CREATE POLICY "anon_select_pharmacie" ON pharmacie_items FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_pharmacie" ON pharmacie_items;
CREATE POLICY "anon_insert_pharmacie" ON pharmacie_items FOR INSERT
TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_pharmacie" ON pharmacie_items;
CREATE POLICY "anon_update_pharmacie" ON pharmacie_items FOR UPDATE
TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_pharmacie" ON pharmacie_items;
CREATE POLICY "anon_delete_pharmacie" ON pharmacie_items FOR DELETE
TO anon, authenticated USING (true);
