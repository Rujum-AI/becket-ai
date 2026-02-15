-- =====================================================
-- BECKET AI - NUDGE SYSTEM
-- Migration 020: Nudge notifications for child check-ins
-- Adds 'child' entity type + SECURITY DEFINER functions
-- =====================================================

-- 1. Allow 'child' as a related_entity_type
ALTER TABLE notifications
  DROP CONSTRAINT IF EXISTS notifications_related_entity_type_check;

ALTER TABLE notifications
  ADD CONSTRAINT notifications_related_entity_type_check
  CHECK (related_entity_type IN ('event', 'understanding', 'expense', 'task', 'snapshot', 'handoff', 'child'));

-- =====================================================
-- 2. send_nudge(child_id, child_name)
-- Creates a nudge_request notification for the co-parent.
-- Returns the created notification ID.
-- =====================================================
CREATE OR REPLACE FUNCTION send_nudge(
  p_child_id uuid,
  p_child_name text
)
RETURNS uuid AS $$
DECLARE
  v_family_id uuid;
  v_partner_id uuid;
  v_display_name text;
  v_notif_id uuid;
BEGIN
  -- Get caller's family
  SELECT fm.family_id INTO v_family_id
  FROM family_members fm
  WHERE fm.profile_id = auth.uid()
  LIMIT 1;

  IF v_family_id IS NULL THEN
    RAISE EXCEPTION 'User is not a member of any family';
  END IF;

  -- Get co-parent
  v_partner_id := get_family_partner(v_family_id, auth.uid());

  IF v_partner_id IS NULL THEN
    RAISE EXCEPTION 'No co-parent found (solo mode)';
  END IF;

  -- Get display name
  SELECT COALESCE(p.display_name, split_part(u.email, '@', 1), 'Your co-parent')
  INTO v_display_name
  FROM profiles p
  LEFT JOIN auth.users u ON u.id = p.id
  WHERE p.id = auth.uid();

  -- Insert nudge notification
  INSERT INTO notifications (
    family_id,
    recipient_id,
    type,
    category,
    title,
    message,
    priority,
    related_entity_type,
    related_entity_id,
    requires_action,
    action_taken
  ) VALUES (
    v_family_id,
    v_partner_id,
    'nudge_request',
    'nudge',
    v_display_name || ' is thinking of ' || p_child_name,
    v_display_name || ' misses ' || p_child_name || ' and would love a quick update!',
    'normal',
    'child',
    p_child_id,
    true,
    false
  )
  RETURNING id INTO v_notif_id;

  RETURN v_notif_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 3. respond_to_nudge(nudge_id, mood, message, snapshot_id)
-- Marks the original nudge as actioned and sends a
-- response notification back to the nudge sender.
-- =====================================================
CREATE OR REPLACE FUNCTION respond_to_nudge(
  p_nudge_id uuid,
  p_mood text DEFAULT '',
  p_message text DEFAULT '',
  p_snapshot_id uuid DEFAULT NULL
)
RETURNS boolean AS $$
DECLARE
  v_nudge record;
  v_family_id uuid;
  v_display_name text;
  v_response_message text;
  v_entity_type text;
  v_entity_id uuid;
BEGIN
  -- Fetch the original nudge (must be addressed to current user)
  SELECT * INTO v_nudge
  FROM notifications
  WHERE id = p_nudge_id
    AND recipient_id = auth.uid()
    AND type = 'nudge_request';

  IF v_nudge IS NULL THEN
    RAISE EXCEPTION 'Nudge not found or not addressed to you';
  END IF;

  -- Mark original nudge as actioned
  UPDATE notifications
  SET action_taken = true,
      action_taken_at = now()
  WHERE id = p_nudge_id;

  -- Get display name
  SELECT COALESCE(p.display_name, split_part(u.email, '@', 1), 'Your co-parent')
  INTO v_display_name
  FROM profiles p
  LEFT JOIN auth.users u ON u.id = p.id
  WHERE p.id = auth.uid();

  -- Build response message
  v_response_message := TRIM(COALESCE(p_mood, '') || ' ' || COALESCE(p_message, ''));
  IF v_response_message = '' THEN
    v_response_message := 'Update sent';
  END IF;

  -- Determine related entity (photo snapshot or original child)
  IF p_snapshot_id IS NOT NULL THEN
    v_entity_type := 'snapshot';
    v_entity_id := p_snapshot_id;
  ELSE
    v_entity_type := v_nudge.related_entity_type;
    v_entity_id := v_nudge.related_entity_id;
  END IF;

  -- Insert response notification back to the nudge sender
  -- The sender is whoever is NOT the current user in that family
  INSERT INTO notifications (
    family_id,
    recipient_id,
    type,
    category,
    title,
    message,
    priority,
    related_entity_type,
    related_entity_id,
    parent_notification_id,
    requires_action
  ) VALUES (
    v_nudge.family_id,
    get_family_partner(v_nudge.family_id, auth.uid()),
    'nudge_response',
    'nudge',
    v_display_name || ' sent an update!',
    v_response_message,
    'normal',
    v_entity_type,
    v_entity_id,
    p_nudge_id,
    false
  );

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
