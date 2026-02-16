-- =====================================================
-- BECKET AI - SECURITY FIX: Invitation RPC + Family Policy
-- Migration 022: Harden invitation acceptance and family creation
-- =====================================================

-- =============================================================
-- FIX C1: accept_pending_invitation must use auth.email()
-- BEFORE: Trusted user-supplied user_email parameter
-- AFTER: Uses auth.email() from JWT — can't spoof identity
-- =============================================================

CREATE OR REPLACE FUNCTION public.accept_pending_invitation(p_user_id uuid)
RETURNS jsonb AS $$
DECLARE
  inv record;
  v_email text;
  v_existing_label text;
  v_new_label text;
BEGIN
  -- Get email from JWT, not from parameters
  v_email := auth.email();

  IF v_email IS NULL THEN
    RETURN jsonb_build_object('accepted', false, 'reason', 'no_authenticated_email');
  END IF;

  -- Also verify the caller is who they claim to be
  IF p_user_id != auth.uid() THEN
    RETURN jsonb_build_object('accepted', false, 'reason', 'user_id_mismatch');
  END IF;

  -- Lock and find pending invitation (case-insensitive email match)
  SELECT * INTO inv
  FROM invitations
  WHERE LOWER(email) = LOWER(v_email)
    AND status = 'pending'
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF inv IS NULL THEN
    -- Check if user was already added (by a concurrent call or previous attempt)
    IF EXISTS (
      SELECT 1 FROM family_members
      WHERE profile_id = p_user_id
    ) THEN
      RETURN jsonb_build_object(
        'accepted', true,
        'reason', 'already_member',
        'family_id', (SELECT family_id FROM family_members WHERE profile_id = p_user_id LIMIT 1)
      );
    END IF;
    RETURN jsonb_build_object('accepted', false, 'reason', 'no_pending_invitation');
  END IF;

  -- Check invitation expiry
  IF inv.expires_at IS NOT NULL AND inv.expires_at < now() THEN
    UPDATE invitations SET status = 'expired' WHERE id = inv.id;
    RETURN jsonb_build_object('accepted', false, 'reason', 'invitation_expired');
  END IF;

  -- Already a member of this family?
  IF EXISTS (
    SELECT 1 FROM family_members
    WHERE family_id = inv.family_id AND profile_id = p_user_id
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
  INSERT INTO family_members (family_id, profile_id, parent_label, role)
  VALUES (inv.family_id, p_user_id, v_new_label, 'parent')
  ON CONFLICT (family_id, profile_id) DO NOTHING;

  -- Mark invitation accepted
  UPDATE invitations SET status = 'accepted' WHERE id = inv.id;

  RETURN jsonb_build_object('accepted', true, 'family_id', inv.family_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================
-- FIX C2: Tighten family_insert policy
-- BEFORE: WITH CHECK (true) — anyone including anon could create
-- AFTER: Requires authenticated user
-- =============================================================

DROP POLICY IF EXISTS "family_insert" ON families;
CREATE POLICY "family_insert" ON families
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
