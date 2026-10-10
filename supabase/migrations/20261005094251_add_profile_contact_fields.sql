/*
# Extend user_profiles with contact and diploma fields

## Changes
Adds three new columns to the `user_profiles` table so the "Mon Compte"
profile tab can display phone, diploma, and emergency contact info.

## New columns on user_profiles
- `phone` (text, nullable) — user's phone number
- `diploma` (text, nullable) — user's diploma / qualification
- `emergency_contact` (text, nullable) — emergency contact info

## Security
No policy changes — the table already has anon+authenticated CRUD policies
from the previous RLS fix migration.
*/

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS diploma text,
  ADD COLUMN IF NOT EXISTS emergency_contact text;