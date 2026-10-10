/*
# Add "adjoint" role and allow anon profile insert during sign-up

## Changes

1. user_profiles.role CHECK constraint
   - Previous allowed values: 'animateur', 'directeur'
   - New allowed values: 'animateur', 'adjoint', 'directeur'
   - This lets new users pick "Adjoint(e)" as a role during account creation.

2. user_profiles INSERT policy
   - Adds an anon INSERT policy so the profile row can be created during
     `supabase.auth.signUp()` — the auth session is not yet established
     at the moment the client inserts the profile row, so the request
     runs as `anon`. The policy checks that the inserted `id` matches
     `auth.uid()` (which is populated by the sign-up flow even before
     the session cookie is set).

## Security
- No existing data is modified or deleted.
- The new INSERT policy is scoped: only rows where `id = auth.uid()` can be inserted.
*/

-- ── 1. Update role CHECK constraint ──
ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_role_check;
ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_role_check
  CHECK (role IN ('animateur', 'adjoint', 'directeur'));

-- ── 2. Allow anon INSERT for profile creation during sign-up ──
DROP POLICY IF EXISTS "anon_insert_own_profile" ON user_profiles;
CREATE POLICY "anon_insert_own_profile" ON user_profiles
  FOR INSERT TO anon, authenticated
  WITH CHECK (auth.uid() = id);