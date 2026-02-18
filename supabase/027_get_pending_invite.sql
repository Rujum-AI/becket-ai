-- ============================================================
-- Migration 027: Get Pending Invite RPC
--
-- Direct table queries go through RLS, which can silently
-- return empty results if policies don't match.
-- This SECURITY DEFINER RPC bypasses RLS entirely — if the
-- invite exists in the DB, it WILL be returned.
-- ============================================================

CREATE OR REPLACE FUNCTION get_pending_invite(p_family_id uuid)
RETURNS jsonb AS $$
DECLARE
  v_invite record;
BEGIN
  -- Verify caller is authenticated
  IF auth.uid() IS NULL THEN
    RETURN NULL;
  END IF;

  -- Verify caller is a member of this family
  IF NOT EXISTS (
    SELECT 1 FROM family_members
    WHERE family_id = p_family_id AND profile_id = auth.uid()
  ) THEN
    RETURN NULL;
  END IF;

  -- Get the most recent pending invite
  SELECT email, token INTO v_invite
  FROM invitations
  WHERE family_id = p_family_id AND status = 'pending'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_invite IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object('email', v_invite.email, 'token', v_invite.token);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
