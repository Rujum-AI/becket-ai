-- ============================================================
-- Migration 026: Invitation System Hardening
--
-- Enforces at DATABASE LEVEL:
--   1. Max 2 members per family (trigger)
--   2. Max 1 pending invite per family (partial unique index)
--   3. No invites when family is full (trigger)
--   4. Atomic invite creation (RPC replaces client expire+insert)
--   5. Family size check before accepting invite (updated RPC)
--   6. User can only be in one family (check before accept)
-- ============================================================


-- ============================================================
-- Step 0: Clean up existing bad data
-- Expire duplicate pending invites, keeping only the newest per family
-- ============================================================

WITH ranked AS (
  SELECT id,
    ROW_NUMBER() OVER (PARTITION BY family_id ORDER BY created_at DESC) AS rn
  FROM invitations
  WHERE status = 'pending'
)
UPDATE invitations
SET status = 'expired'
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);


-- ============================================================
-- Step 1: Partial unique index — ONE pending invite per family
-- This is the core DB-level enforcement. Any attempt to insert
-- a second pending invite for the same family will fail.
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_one_pending_invite_per_family
  ON invitations(family_id)
  WHERE status = 'pending';


-- ============================================================
-- Step 2: Trigger — max 2 members per family
-- Fires BEFORE INSERT on family_members. Raises exception
-- if the family already has 2 members.
-- ============================================================

CREATE OR REPLACE FUNCTION enforce_family_member_limit()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT COUNT(*) FROM family_members WHERE family_id = NEW.family_id) >= 2 THEN
    RAISE EXCEPTION 'Family already has the maximum number of members (2)'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS check_family_member_limit ON family_members;
CREATE TRIGGER check_family_member_limit
  BEFORE INSERT ON family_members
  FOR EACH ROW
  EXECUTE FUNCTION enforce_family_member_limit();


-- ============================================================
-- Step 3: Trigger — block invitations when family is full
-- Fires BEFORE INSERT on invitations. Prevents creating an
-- invite when the family already has 2 members.
-- ============================================================

CREATE OR REPLACE FUNCTION check_invite_allowed()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT COUNT(*) FROM family_members WHERE family_id = NEW.family_id) >= 2 THEN
    RAISE EXCEPTION 'Cannot create invitation: family already has 2 members'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS check_invite_before_insert ON invitations;
CREATE TRIGGER check_invite_before_insert
  BEFORE INSERT ON invitations
  FOR EACH ROW
  EXECUTE FUNCTION check_invite_allowed();


-- ============================================================
-- Step 4: Atomic RPC — create_family_invitation()
-- Replaces the client-side pattern of:
--   UPDATE status='expired' ...  (transaction 1)
--   INSERT new invite ...         (transaction 2)
-- with a single atomic transaction that:
--   - Verifies caller is authenticated + in the family
--   - Checks family isn't full
--   - Expires old pending invites
--   - Creates new invite
-- All in ONE transaction — no race conditions.
-- ============================================================

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

  -- Expire all existing pending invites for this family (atomic with insert below)
  UPDATE invitations
  SET status = 'expired'
  WHERE family_id = p_family_id AND status = 'pending';

  -- Create new invitation
  INSERT INTO invitations (family_id, email, token, status)
  VALUES (p_family_id, p_email, p_token, 'pending');

  RETURN jsonb_build_object('success', true, 'email', p_email, 'token', p_token);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================
-- Step 5: Updated accept_pending_invitation()
-- Adds:
--   - Check if user is already in ANY family (one family per user)
--   - Check target family isn't already full before inserting
--   - Expire any remaining pending invites after acceptance
-- ============================================================

CREATE OR REPLACE FUNCTION public.accept_pending_invitation(p_user_id uuid)
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

  -- NEW: Check if user is already in ANY family (one family per user)
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

  -- NEW: Check target family isn't already full
  SELECT COUNT(*) INTO v_member_count
  FROM family_members WHERE family_id = inv.family_id;

  IF v_member_count >= 2 THEN
    UPDATE invitations SET status = 'expired' WHERE id = inv.id;
    RETURN jsonb_build_object('accepted', false, 'reason', 'family_full');
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

  -- Mark this invitation accepted
  UPDATE invitations SET status = 'accepted' WHERE id = inv.id;

  -- Expire all other pending invites for this family (cleanup)
  UPDATE invitations SET status = 'expired'
  WHERE family_id = inv.family_id AND status = 'pending' AND id != inv.id;

  RETURN jsonb_build_object('accepted', true, 'family_id', inv.family_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
