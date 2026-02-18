-- PATCH: Lock invite creation — refuse if pending invite exists
-- Run this in Supabase SQL Editor to update the RPC

CREATE OR REPLACE FUNCTION create_family_invitation(
  p_family_id uuid,
  p_email text,
  p_token text
)
RETURNS jsonb AS $$
DECLARE
  v_member_count integer;
BEGIN
  -- Verify caller is authenticated
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'not_authenticated');
  END IF;

  -- Verify caller is a member of this family
  IF NOT EXISTS (
    SELECT 1 FROM family_members
    WHERE family_id = p_family_id AND profile_id = auth.uid()
  ) THEN
    RETURN jsonb_build_object('success', false, 'reason', 'not_family_member');
  END IF;

  -- Check family isn't already full (2 members)
  SELECT COUNT(*) INTO v_member_count
  FROM family_members WHERE family_id = p_family_id;

  IF v_member_count >= 2 THEN
    RETURN jsonb_build_object('success', false, 'reason', 'family_full');
  END IF;

  -- LOCKED: Refuse if a pending invite already exists (must cancel first)
  IF EXISTS (
    SELECT 1 FROM invitations
    WHERE family_id = p_family_id AND status = 'pending'
  ) THEN
    RETURN jsonb_build_object('success', false, 'reason', 'invite_already_pending');
  END IF;

  -- Create new invitation
  INSERT INTO invitations (family_id, email, token, status)
  VALUES (p_family_id, p_email, p_token, 'pending');

  RETURN jsonb_build_object('success', true, 'email', p_email, 'token', p_token);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
