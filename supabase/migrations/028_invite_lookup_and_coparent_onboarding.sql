-- ============================================================
-- Migration 028: Invite Lookup RPC + Co-Parent Onboarding Support
--
-- Fixes:
--   1. Token lookup fails for unauthenticated users (RLS blocks)
--   2. accept_pending_invitation now accepts optional parent_label + display_name
--
-- New:
--   - lookup_invitation_by_token(p_token) — SECURITY DEFINER, no auth required
--   - accept_pending_invitation gains p_parent_label, p_display_name params
-- ============================================================


-- ============================================================
-- Step 1: lookup_invitation_by_token(p_token text)
--
-- Bypasses RLS so unauthenticated users can validate an invite
-- link before signing up. Returns full family context needed
-- for the co-parent onboarding UI.
-- ============================================================

CREATE OR REPLACE FUNCTION lookup_invitation_by_token(p_token text)
RETURNS jsonb AS $$
DECLARE
  v_inv record;
  v_children jsonb;
  v_inviter_name text;
BEGIN
  IF p_token IS NULL OR p_token = '' THEN
    RETURN NULL;
  END IF;

  -- Find the invitation + family details
  SELECT i.id, i.status, i.email, i.family_id, i.expires_at, i.created_at,
         f.mode AS family_mode, f.home_count, f.relationship_status,
         f.agreement_basis, f.currency
  INTO v_inv
  FROM invitations i
  JOIN families f ON f.id = i.family_id
  WHERE i.token = p_token
  LIMIT 1;

  IF v_inv IS NULL THEN
    RETURN NULL;
  END IF;

  -- Get children for the family
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'name', c.name,
      'gender', c.gender,
      'date_of_birth', c.date_of_birth
    ) ORDER BY c.created_at
  ), '[]'::jsonb)
  INTO v_children
  FROM children c
  WHERE c.family_id = v_inv.family_id;

  -- Get inviter display name (the existing family member)
  SELECT COALESCE(p.display_name, split_part(p.email, '@', 1), 'Your co-parent')
  INTO v_inviter_name
  FROM family_members fm
  JOIN profiles p ON p.id = fm.profile_id
  WHERE fm.family_id = v_inv.family_id
  ORDER BY fm.joined_at ASC
  LIMIT 1;

  RETURN jsonb_build_object(
    'id', v_inv.id,
    'status', v_inv.status,
    'email', v_inv.email,
    'family_id', v_inv.family_id,
    'expires_at', v_inv.expires_at,
    'created_at', v_inv.created_at,
    'family_mode', v_inv.family_mode,
    'home_count', v_inv.home_count,
    'relationship_status', v_inv.relationship_status,
    'agreement_basis', v_inv.agreement_basis,
    'currency', v_inv.currency,
    'children', v_children,
    'inviter_name', v_inviter_name
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================
-- Step 2: Updated accept_pending_invitation()
--
-- Adds two optional parameters:
--   p_parent_label text  — 'dad' or 'mom' (co-parent's chosen role)
--   p_display_name text  — co-parent's display name
--
-- Backward compatible: existing calls with only p_user_id still work.
-- ============================================================

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
BEGIN
  -- Get email from JWT, not from parameters
  v_email := auth.email();

  IF v_email IS NULL THEN
    RETURN jsonb_build_object('accepted', false, 'reason', 'no_authenticated_email');
  END IF;

  -- Verify the caller is who they claim to be
  IF p_user_id != auth.uid() THEN
    RETURN jsonb_build_object('accepted', false, 'reason', 'user_id_mismatch');
  END IF;

  -- Check if user is already in ANY family (one family per user)
  IF EXISTS (
    SELECT 1 FROM family_members WHERE profile_id = p_user_id
  ) THEN
    RETURN jsonb_build_object(
      'accepted', true,
      'reason', 'already_member',
      'family_id', (SELECT family_id FROM family_members WHERE profile_id = p_user_id LIMIT 1)
    );
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
    RETURN jsonb_build_object('accepted', false, 'reason', 'no_pending_invitation');
  END IF;

  -- Check invitation expiry
  IF inv.expires_at IS NOT NULL AND inv.expires_at < now() THEN
    UPDATE invitations SET status = 'expired' WHERE id = inv.id;
    RETURN jsonb_build_object('accepted', false, 'reason', 'invitation_expired');
  END IF;

  -- Check target family isn't already full
  SELECT COUNT(*) INTO v_member_count
  FROM family_members WHERE family_id = inv.family_id;

  IF v_member_count >= 2 THEN
    UPDATE invitations SET status = 'expired' WHERE id = inv.id;
    RETURN jsonb_build_object('accepted', false, 'reason', 'family_full');
  END IF;

  -- Determine label: use provided label if valid, or auto-detect opposite
  IF p_parent_label IS NOT NULL AND p_parent_label IN ('dad', 'mom') THEN
    v_new_label := p_parent_label;
  ELSE
    SELECT parent_label INTO v_existing_label
    FROM family_members
    WHERE family_id = inv.family_id
    LIMIT 1;
    v_new_label := CASE WHEN v_existing_label = 'dad' THEN 'mom' ELSE 'dad' END;
  END IF;

  -- Ensure profile exists
  PERFORM ensure_profile_exists();

  -- If display_name provided, update profile
  IF p_display_name IS NOT NULL AND p_display_name != '' THEN
    UPDATE profiles SET display_name = p_display_name WHERE id = p_user_id;
  END IF;

  -- Add user to family
  INSERT INTO family_members (family_id, profile_id, parent_label, role)
  VALUES (inv.family_id, p_user_id, v_new_label, 'parent')
  ON CONFLICT (family_id, profile_id) DO NOTHING;

  -- Mark this invitation accepted
  UPDATE invitations SET status = 'accepted' WHERE id = inv.id;

  -- Expire all other pending invites for this family (cleanup)
  UPDATE invitations SET status = 'expired'
  WHERE family_id = inv.family_id AND status = 'pending' AND id != inv.id;

  RETURN jsonb_build_object('accepted', true, 'family_id', inv.family_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
