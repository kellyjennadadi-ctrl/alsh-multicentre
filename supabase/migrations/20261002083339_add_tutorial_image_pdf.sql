/*
# Add image and PDF support to tutorials

## Changes

1. New columns on `outils_tutorials`:
   - `image_url` (text, nullable) — URL of the illustration banner image
   - `pdf_url` (text, nullable) — URL of the attached PDF document

2. New storage buckets:
   - `tutorials-images` — public bucket for tutorial illustration photos
   - `tutorials-pdfs` — public bucket for tutorial PDF documents

3. Storage policies:
   - Both buckets allow anon + authenticated to SELECT, INSERT, UPDATE, DELETE
   - Data is intentionally public (single-tenant, no-auth app)

## Notes
- Columns are nullable so existing rows remain valid.
- Storage objects table already has RLS enabled; policies are added per-bucket.
*/

-- Add columns
ALTER TABLE outils_tutorials
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS pdf_url text;

-- Create storage buckets (public = true so anon can read via public URL)
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('tutorials-images', 'tutorials-images', true),
  ('tutorials-pdfs', 'tutorials-pdfs', true)
ON CONFLICT (id) DO NOTHING;

-- Policies for tutorials-images bucket
DROP POLICY IF EXISTS "anon_select_tutorial_images" ON storage.objects;
CREATE POLICY "anon_select_tutorial_images" ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'tutorials-images');

DROP POLICY IF EXISTS "anon_insert_tutorial_images" ON storage.objects;
CREATE POLICY "anon_insert_tutorial_images" ON storage.objects FOR INSERT
  TO anon, authenticated
  WITH CHECK (bucket_id = 'tutorials-images');

DROP POLICY IF EXISTS "anon_update_tutorial_images" ON storage.objects;
CREATE POLICY "anon_update_tutorial_images" ON storage.objects FOR UPDATE
  TO anon, authenticated
  USING (bucket_id = 'tutorials-images') WITH CHECK (bucket_id = 'tutorials-images');

DROP POLICY IF EXISTS "anon_delete_tutorial_images" ON storage.objects;
CREATE POLICY "anon_delete_tutorial_images" ON storage.objects FOR DELETE
  TO anon, authenticated
  USING (bucket_id = 'tutorials-images');

-- Policies for tutorials-pdfs bucket
DROP POLICY IF EXISTS "anon_select_tutorial_pdfs" ON storage.objects;
CREATE POLICY "anon_select_tutorial_pdfs" ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'tutorials-pdfs');

DROP POLICY IF EXISTS "anon_insert_tutorial_pdfs" ON storage.objects;
CREATE POLICY "anon_insert_tutorial_pdfs" ON storage.objects FOR INSERT
  TO anon, authenticated
  WITH CHECK (bucket_id = 'tutorials-pdfs');

DROP POLICY IF EXISTS "anon_update_tutorial_pdfs" ON storage.objects;
CREATE POLICY "anon_update_tutorial_pdfs" ON storage.objects FOR UPDATE
  TO anon, authenticated
  USING (bucket_id = 'tutorials-pdfs') WITH CHECK (bucket_id = 'tutorials-pdfs');

DROP POLICY IF EXISTS "anon_delete_tutorial_pdfs" ON storage.objects;
CREATE POLICY "anon_delete_tutorial_pdfs" ON storage.objects FOR DELETE
  TO anon, authenticated
  USING (bucket_id = 'tutorials-pdfs');
