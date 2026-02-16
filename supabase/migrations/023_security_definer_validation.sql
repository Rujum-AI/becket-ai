-- =====================================================
-- BECKET AI - SECURITY FIX: SECURITY DEFINER Validation
-- Migration 023: Add child-family ownership checks
-- =====================================================

-- =============================================================
-- FIX H4: send_nudge() must verify child belongs to caller's family
-- BEFORE: Only verified caller is in A family, not THE child's family
-- AFTER: Verifies child_id belongs to caller's family
-- =============================================================

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

  -- SECURITY FIX: Verify the child belongs to the caller's family
  IF NOT EXISTS (
    SELECT 1 FROM children
    WHERE id = p_child_id
    AND family_id = v_family_id
  ) THEN
    RAISE EXCEPTION 'Child does not belong to your family';
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
