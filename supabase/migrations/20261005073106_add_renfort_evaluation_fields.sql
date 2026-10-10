/*
# Add renfort evaluation and contact fields to animateurs table

1. Modified Tables
- `animateurs`
  - `evaluation` (text, nullable) — visual status: 'recommande', 'non_recommande', 'a_tester'. Defaults to 'a_tester'.
  - `note_interne` (text, nullable) — short internal note from direction about the renfort's performance.
  - `diploma` (text, nullable) — diploma label (BAFA, stagiaire, etc.) for quick display in renfort list.
2. Security
- No new tables. Existing RLS policies on `animateurs` remain unchanged (anon+authenticated CRUD).
3. Notes
- All columns are nullable with safe defaults so existing rows are unaffected.
- `evaluation` accepts three values: 'recommande' (green), 'non_recommande' (red), 'a_tester' (neutral).
*/

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'animateurs' AND column_name = 'evaluation') THEN
    ALTER TABLE animateurs ADD COLUMN evaluation text DEFAULT 'a_tester';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'animateurs' AND column_name = 'note_interne') THEN
    ALTER TABLE animateurs ADD COLUMN note_interne text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'animateurs' AND column_name = 'diploma') THEN
    ALTER TABLE animateurs ADD COLUMN diploma text;
  END IF;
END $$;
