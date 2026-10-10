/*
# Add 'matin' creneau to pointages table

## Purpose
The pointages table currently only allows 'midi', 'soir', 'journee' as creneau values.
We need to add 'matin' for the new morning périscolaire slot (7h30-8h20).

## Changes
- Drop and recreate the CHECK constraint on `creneau` to include 'matin'
- No data loss: existing rows are unaffected (their values are still valid)

## Security
- No RLS or policy changes
*/

ALTER TABLE pointages DROP CONSTRAINT IF EXISTS pointages_creneau_check;

ALTER TABLE pointages ADD CONSTRAINT pointages_creneau_check
  CHECK (creneau IN ('matin', 'midi', 'soir', 'journee'));
