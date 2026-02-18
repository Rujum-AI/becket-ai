-- =====================================================
-- BECKET AI - FIX: Profile creation + family_members RLS
-- Migration 025: Ensure profiles exist, fix member insert policy
-- =====================================================

-- =============================================================
-- FIX 1: handle_new_user() — add ON CONFLICT so re-signups don't error
-- =============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO profiles (id, email, display_name)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    display_name = COALESCE(profiles.display_name, EXCLUDED.display_name);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================
-- FIX 2: RPC to ensure profile exists (called before family creation)
-- Handles cases where trigger didn't fire (Google OAuth re-auth, etc.)
-- =============================================================
CREATE OR REPLACE FUNCTION ensure_profile_exists()
RETURNS void AS $$
BEGIN
  INSERT INTO profiles (id, email, display_name)
  VALUES (
    auth.uid(),
    auth.email(),
    COALESCE(
      (SELECT raw_user_meta_data->>'display_name' FROM auth.users WHERE id = auth.uid()),
      split_part(auth.email(), '@', 1)
    )
  )
  ON CONFLICT (id) DO UPDATE SET
    email = COALESCE(EXCLUDED.email, profiles.email),
    display_name = COALESCE(profiles.display_name, EXCLUDED.display_name);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================
-- FIX 3: family_members_insert policy — fix chicken-and-egg
-- OLD: family_id IN (SELECT user_family_ids()) — blocks first member
-- NEW: Users can insert themselves (profile_id = auth.uid())
-- =============================================================
DROP POLICY IF EXISTS "family_members_insert" ON family_members;
CREATE POLICY "family_members_insert" ON family_members
  FOR INSERT WITH CHECK (profile_id = auth.uid());
