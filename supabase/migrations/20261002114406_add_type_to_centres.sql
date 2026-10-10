/*
# Add type column to centres table

1. Changes
- Add `type` column (text) to `centres` table to store the structure type
  (Elementaire, Maternelle, Periscolaire, ALSH, etc.)
- Default value is 'Periscolaire'
2. Security
- No new RLS policies needed; existing policies on centres already allow
  authenticated users to read. Add an INSERT policy so authenticated users
  can create new centres.
*/

ALTER TABLE centres ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'Periscolaire';

-- Allow authenticated users to insert new centres
DROP POLICY IF EXISTS "insert_centres_authenticated" ON centres;
CREATE POLICY "insert_centres_authenticated"
ON centres FOR INSERT
TO authenticated WITH CHECK (true);
