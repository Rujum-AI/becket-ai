-- ==============================================
-- FIX: Invitation Acceptance via RPC
-- Run this ENTIRE block in Supabase SQL Editor
-- ==============================================

-- Step 0: CLEANUP - Remove any broken data from previous attempts
-- Delete duplicate/orphan family_member rows for the invited user
-- (Only run this if you had failed attempts before)
DELETE FROM family_members
WHERE profile_id IN (
  SELECT fm.profile_id FROM family_members fm
  LEFT JOIN families f ON f.id = fm.family_id
  WHERE f.id IS NULL
);

-- Reset any invitations that got stuck (marked accepted but member wasn't actually added)
UPDATE invitations SET status = 'pending'
WHERE status = 'accepted'
  AND NOT EXISTS (
    SELECT 1 FROM family_members fm
    WHERE fm.family_id = invitations.family_id
      AND fm.profile_id = (
        SELECT p.id FROM profiles p WHERE LOWER(p.email) = LOWER(invitations.email) LIMIT 1
      )
  );

-- Step 1: Add unique constraint on family_members (needed for ON CONFLICT)
-- This prevents duplicate family memberships
CREATE UNIQUE INDEX IF NOT EXISTS idx_family_members_unique
  ON family_members(family_id, profile_id);

-- Step 2: Auto-create profile when user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (
    new.id,
    LOWER(new.email),
    COALESCE(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  )
  ON CONFLICT (id) DO UPDATE SET email = LOWER(EXCLUDED.email);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Step 3: Backfill existing profiles missing email
UPDATE profiles p
SET email = LOWER(u.email)
FROM auth.users u
WHERE p.id = u.id AND (p.email IS NULL OR p.email = '');

-- Step 4: RPC function that accepts invitations (bypasses RLS)
CREATE OR REPLACE FUNCTION public.accept_pending_invitation(user_id uuid, user_email text)
RETURNS jsonb AS $$
DECLARE
  inv record;
  v_existing_label text;
  v_new_label text;
BEGIN
  -- Lock and find pending invitation (case-insensitive email match)
  -- FOR UPDATE prevents concurrent calls from processing the same invitation
  SELECT * INTO inv
  FROM invitations
  WHERE LOWER(email) = LOWER(user_email)
    AND status = 'pending'
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF inv IS NULL THEN
    -- Check if user was already added (by a concurrent call or previous attempt)
    IF EXISTS (
      SELECT 1 FROM family_members
      WHERE profile_id = user_id
    ) THEN
      RETURN jsonb_build_object(
        'accepted', true,
        'reason', 'already_member',
        'family_id', (SELECT family_id FROM family_members WHERE profile_id = user_id LIMIT 1)
      );
    END IF;
    RETURN jsonb_build_object('accepted', false, 'reason', 'no_pending_invitation');
  END IF;

  -- Already a member of this family?
  IF EXISTS (
    SELECT 1 FROM family_members
    WHERE family_id = inv.family_id AND profile_id = user_id
  ) THEN
    UPDATE invitations SET status = 'accepted' WHERE id = inv.id;
    RETURN jsonb_build_object('accepted', true, 'reason', 'already_member', 'family_id', inv.family_id);
  END IF;

  -- Get the existing member's label to assign the opposite
  SELECT parent_label INTO v_existing_label
  FROM family_members
  WHERE family_id = inv.family_id
  LIMIT 1;

  v_new_label := CASE WHEN v_existing_label = 'dad' THEN 'mom' ELSE 'dad' END;

  -- Add user to family
  -- role='parent' matches CHECK constraint: role IN ('admin', 'parent')
  -- ON CONFLICT handles race condition if another call inserted first
  INSERT INTO family_members (family_id, profile_id, parent_label, role)
  VALUES (inv.family_id, user_id, v_new_label, 'parent')
  ON CONFLICT (family_id, profile_id) DO NOTHING;

  -- Mark invitation accepted
  UPDATE invitations SET status = 'accepted' WHERE id = inv.id;

  RETURN jsonb_build_object('accepted', true, 'family_id', inv.family_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 5: Allow profile creation from trigger
DROP POLICY IF EXISTS "system_insert_profile" ON profiles;
CREATE POLICY "system_insert_profile" ON profiles
  FOR INSERT WITH CHECK (true);
