-- =====================================================
-- BECKET AI - CALLING NAME FOR PARENTS
-- Migration 033: Add family_members.calling_name + realtime + RPC update
-- =====================================================
--
-- Why: parent_label is 'dad' or 'mom' — that breaks for same-gender
-- families (two moms, two dads), where the UI needs to disambiguate
-- ("mom Sarah" vs "mom Lisa"). calling_name stores the first name
-- pulled from the Google profile, so the UI has something to suffix
-- the label with WHEN there's a collision. When parent_labels differ
-- (one dad + one mom), the UI ignores it and just shows the label.
--
-- We always store it — display logic decides when to show it. That
-- keeps the data clean even if the family later flips labels.

ALTER TABLE family_members ADD COLUMN IF NOT EXISTS calling_name TEXT;
COMMENT ON COLUMN family_members.calling_name IS
  'First name from Google profile, used by UI to disambiguate same-label parents (two moms / two dads). Null is fine.';

-- Backfill existing rows from profiles.display_name (first word only).
UPDATE family_members fm
SET calling_name = split_part(p.display_name, ' ', 1)
FROM profiles p
WHERE p.id = fm.profile_id
  AND fm.calling_name IS NULL
  AND p.display_name IS NOT NULL
  AND p.display_name != '';

-- Realtime: family_members joining/leaving should propagate to the other
-- parent's UI without a refresh (e.g. parent2 accepts invite → parent1
-- sees the co-parent appear). Idempotent via DO block — re-running this
-- migration won't error if the table is already in the publication.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'family_members'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE family_members;
  END IF;
END $$;

-- =====================================================
-- Update accept_pending_invitation to also write calling_name
-- =====================================================
-- Existing signature preserved (p_user_id, p_parent_label, p_display_name).
-- When p_display_name is supplied, we now ALSO populate
-- family_members.calling_name with its first word.

CREATE OR REPLACE FUNCTION public.accept_pending_invitation(
  p_user_id uuid,
  p_parent_label text DEFAULT NULL,
  p_display_name text DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
  inv record;
  v_email text;
  v_existing_label text;
  v_new_label text;
  v_member_count integer;
  v_calling_name text;
BEGIN
  v_email := auth.email();

  IF v_email IS NULL THEN
    RETURN jsonb_build_object('accepted', false, 'reason', 'no_authenticated_email');
  END IF;

  IF p_user_id != auth.uid() THEN
    RETURN jsonb_build_object('accepted', false, 'reason', 'user_id_mismatch');
  END IF;

  IF EXISTS (
    SELECT 1 FROM family_members WHERE profile_id = p_user_id
  ) THEN
    RETURN jsonb_build_object(
      'accepted', true,
      'reason', 'already_member',
      'family_id', (SELECT family_id FROM family_members WHERE profile_id = p_user_id LIMIT 1)
    );
  END IF;

  SELECT * INTO inv
  FROM invitations
  WHERE LOWER(email) = LOWER(v_email)
    AND status = 'pending'
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF inv IS NULL THEN
    RETURN jsonb_build_object('accepted', false, 'reason', 'no_pending_invitation');
  END IF;

  IF inv.expires_at IS NOT NULL AND inv.expires_at < now() THEN
    UPDATE invitations SET status = 'expired' WHERE id = inv.id;
    RETURN jsonb_build_object('accepted', false, 'reason', 'invitation_expired');
  END IF;

  SELECT COUNT(*) INTO v_member_count
  FROM family_members WHERE family_id = inv.family_id;

  IF v_member_count >= 2 THEN
    UPDATE invitations SET status = 'expired' WHERE id = inv.id;
    RETURN jsonb_build_object('accepted', false, 'reason', 'family_full');
  END IF;

  IF p_parent_label IS NOT NULL AND p_parent_label IN ('dad', 'mom') THEN
    v_new_label := p_parent_label;
  ELSE
    SELECT parent_label INTO v_existing_label
    FROM family_members
    WHERE family_id = inv.family_id
    LIMIT 1;
    v_new_label := CASE WHEN v_existing_label = 'dad' THEN 'mom' ELSE 'dad' END;
  END IF;

  PERFORM ensure_profile_exists();

  IF p_display_name IS NOT NULL AND p_display_name != '' THEN
    UPDATE profiles SET display_name = p_display_name WHERE id = p_user_id;
    v_calling_name := split_part(p_display_name, ' ', 1);
  ELSE
    -- Fall back to whatever's on the profile (Google OAuth typically populates this)
    SELECT split_part(display_name, ' ', 1) INTO v_calling_name
    FROM profiles WHERE id = p_user_id;
  END IF;

  INSERT INTO family_members (family_id, profile_id, parent_label, role, calling_name)
  VALUES (inv.family_id, p_user_id, v_new_label, 'parent', v_calling_name)
  ON CONFLICT (family_id, profile_id) DO NOTHING;

  UPDATE invitations SET status = 'accepted' WHERE id = inv.id;

  UPDATE invitations SET status = 'expired'
  WHERE family_id = inv.family_id AND status = 'pending' AND id != inv.id;

  RETURN jsonb_build_object('accepted', true, 'family_id', inv.family_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
