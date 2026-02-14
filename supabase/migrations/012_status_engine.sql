-- =====================================================
-- BECKET AI - STATUS RESOLUTION & ALERTS ENGINE
-- Migration 012: Connects expected status (from events)
-- with actual status (from button press), detects mismatches
-- =====================================================

-- =====================================================
-- 1. IS_EXPECTED_PARENT: Check if a user is the expected
--    custody parent for a given date
-- =====================================================
CREATE OR REPLACE FUNCTION is_expected_parent(
  p_family_id uuid,
  p_user_id uuid,
  p_date date DEFAULT CURRENT_DATE
)
RETURNS boolean AS $$
DECLARE
  v_expected_parent uuid;
BEGIN
  v_expected_parent := get_custody_parent_id(p_family_id, p_date);

  -- No custody cycle defined = anyone can pick up
  IF v_expected_parent IS NULL THEN
    RETURN true;
  END IF;

  RETURN v_expected_parent = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- =====================================================
-- 2. ENHANCE notify_on_handoff: Detect unexpected parent
--    Replaces the Phase 1 version with unexpected-parent alerting
-- =====================================================
CREATE OR REPLACE FUNCTION notify_on_handoff()
RETURNS trigger AS $$
DECLARE
  v_child_name text;
  v_notif_type text;
  v_recipient_id uuid;
  v_title text;
  v_message text;
  v_is_expected boolean;
  v_expected_parent_id uuid;
  v_actor_id uuid;
BEGIN
  -- Solo mode check: from_parent = to_parent means self-handoff
  IF NEW.from_parent_id = NEW.to_parent_id THEN
    RETURN NEW;
  END IF;

  -- Get child name for notification message
  SELECT name INTO v_child_name
  FROM children
  WHERE id = NEW.child_id;

  -- Determine who is acting
  v_actor_id := COALESCE(auth.uid(), NEW.to_parent_id);

  -- Determine direction: who inserted this handoff?
  IF v_actor_id = NEW.to_parent_id THEN
    -- Pickup: current user is receiving child
    v_notif_type := 'pickup_confirmed';
    v_recipient_id := NEW.from_parent_id;
    v_title := 'Pickup Confirmed';
    v_message := COALESCE(v_child_name, 'Child') || ' was picked up';
  ELSIF v_actor_id = NEW.from_parent_id THEN
    -- Dropoff: current user is sending child
    v_notif_type := 'dropoff_confirmed';
    v_recipient_id := NEW.to_parent_id;
    v_title := 'Dropoff Completed';
    v_message := COALESCE(v_child_name, 'Child') || ' was dropped off';
    IF NEW.notes IS NOT NULL AND NEW.notes != '' THEN
      v_message := v_message || ' at ' || NEW.notes;
    END IF;
  ELSE
    RETURN NEW;
  END IF;

  -- Insert standard notification
  INSERT INTO notifications (
    family_id, recipient_id, type, category,
    title, message, priority,
    related_entity_type, related_entity_id, requires_action
  ) VALUES (
    NEW.family_id, v_recipient_id, v_notif_type, 'handoff',
    v_title, v_message, 'normal',
    'handoff', NEW.id, false
  );

  -- If handoff has an event_id, mark that event as confirmed
  IF NEW.event_id IS NOT NULL THEN
    UPDATE events
    SET status = 'confirmed',
        confirmed_at = NEW.actual_at,
        confirmed_by = v_actor_id,
        actual_time = NEW.actual_at
    WHERE id = NEW.event_id;
  END IF;

  -- === UNEXPECTED PARENT DETECTION ===
  -- Check if the acting parent is the expected custody parent today
  v_expected_parent_id := get_custody_parent_id(NEW.family_id, CURRENT_DATE);

  IF v_expected_parent_id IS NOT NULL THEN
    -- For pickup: the person picking up (to_parent) should be expected
    -- For dropoff: the person who had the child (from_parent) should have been expected
    IF v_notif_type = 'pickup_confirmed' AND NEW.to_parent_id != v_expected_parent_id THEN
      -- Unexpected pickup: notify the expected parent
      INSERT INTO notifications (
        family_id, recipient_id, type, category,
        title, message, priority,
        related_entity_type, related_entity_id, requires_action
      ) VALUES (
        NEW.family_id,
        v_expected_parent_id,
        'unexpected_pickup',
        'handoff',
        'Unexpected Pickup',
        COALESCE(v_child_name, 'Child') || ' was picked up on your custody day',
        'high',
        'handoff', NEW.id, true
      );
    END IF;
  END IF;

  -- Log to activity_log
  INSERT INTO activity_log (
    family_id, actor_id, action, entity_type, entity_id, changes
  ) VALUES (
    NEW.family_id, v_actor_id, 'created', 'handoff', NEW.id,
    jsonb_build_object(
      'from_parent_id', NEW.from_parent_id,
      'to_parent_id', NEW.to_parent_id,
      'child_id', NEW.child_id,
      'actual_at', NEW.actual_at,
      'is_expected_parent', (v_expected_parent_id IS NULL OR v_actor_id = v_expected_parent_id)
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 3. LOG STATUS CHANGES ON CHILDREN
-- Fires AFTER UPDATE on children when status changes
-- =====================================================
CREATE OR REPLACE FUNCTION log_status_change()
RETURNS trigger AS $$
BEGIN
  -- Only fire when current_status actually changes
  IF OLD.current_status IS DISTINCT FROM NEW.current_status THEN
    INSERT INTO activity_log (
      family_id,
      actor_id,
      action,
      entity_type,
      entity_id,
      changes
    ) VALUES (
      NEW.family_id,
      NEW.status_changed_by,
      'status_changed',
      'child',
      NEW.id,
      jsonb_build_object(
        'status', jsonb_build_object('old', OLD.current_status, 'new', NEW.current_status),
        'parent_id', jsonb_build_object('old', OLD.current_parent_id, 'new', NEW.current_parent_id)
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER children_status_log
  AFTER UPDATE ON children
  FOR EACH ROW EXECUTE FUNCTION log_status_change();

-- =====================================================
-- 4. FIX check_missed_pickups: Use start_time instead of
--    scheduled_time (our generated events set start_time)
-- =====================================================
CREATE OR REPLACE FUNCTION check_missed_pickups()
RETURNS void AS $$
DECLARE
  v_event record;
  v_existing_notification uuid;
BEGIN
  FOR v_event IN
    SELECT *
    FROM events
    WHERE type IN ('pickup', 'dropoff')
      AND status = 'scheduled'
      AND start_time < NOW() - INTERVAL '15 minutes'
      AND confirmed_at IS NULL
  LOOP
    -- Check if we already sent initial notification
    SELECT id INTO v_existing_notification
    FROM notifications
    WHERE related_entity_type = 'event'
      AND related_entity_id = v_event.id
      AND type = 'pickup_missed'
      AND escalation_level = 0;

    IF NOT FOUND THEN
      -- Send initial notification to expected parent
      INSERT INTO notifications (
        family_id, recipient_id, type, category,
        title, message, priority,
        related_entity_type, related_entity_id,
        requires_action, escalation_level
      ) VALUES (
        v_event.family_id,
        v_event.expected_by,
        'pickup_missed',
        'handoff',
        v_event.type || ' not confirmed',
        'Please confirm ' || v_event.type || ' for ' || v_event.title,
        'urgent',
        'event', v_event.id,
        true, 0
      );
    ELSE
      -- Check if 15 more minutes passed (30 min total) - escalate
      IF v_event.start_time < NOW() - INTERVAL '30 minutes' THEN
        -- Check if escalation already sent
        PERFORM 1
        FROM notifications
        WHERE parent_notification_id = v_existing_notification
          AND escalation_level = 1;

        IF NOT FOUND THEN
          -- Send escalation to other parent
          INSERT INTO notifications (
            family_id, recipient_id, type, category,
            title, message, priority,
            related_entity_type, related_entity_id,
            escalation_level, parent_notification_id
          )
          SELECT
            v_event.family_id,
            fm.profile_id,
            'pickup_escalated',
            'handoff',
            'Check with co-parent',
            v_event.type || ' not confirmed for ' || v_event.title || ' - please check',
            'high',
            'event', v_event.id,
            1, v_existing_notification
          FROM family_members fm
          WHERE fm.family_id = v_event.family_id
            AND fm.profile_id != v_event.expected_by
          LIMIT 1;
        END IF;
      END IF;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 5. CHECK EXPECTED DROPOFFS
-- Alert parent if a school/activity event is about to start
-- and no dropoff has been confirmed yet
-- Run via cron every 5 minutes
-- =====================================================
CREATE OR REPLACE FUNCTION check_expected_dropoffs()
RETURNS void AS $$
DECLARE
  v_event record;
  v_child_record record;
  v_child_name text;
BEGIN
  -- Find scheduled school/activity events starting in next 15 minutes
  FOR v_event IN
    SELECT e.*
    FROM events e
    WHERE e.type IN ('school', 'activity')
      AND e.status = 'scheduled'
      AND e.start_time > NOW()
      AND e.start_time <= NOW() + INTERVAL '15 minutes'
      AND e.expected_by IS NOT NULL
  LOOP
    -- For each child linked to this event
    FOR v_child_record IN
      SELECT ec.child_id, c.name
      FROM event_children ec
      JOIN children c ON c.id = ec.child_id
      WHERE ec.event_id = v_event.id
    LOOP
      -- Check if notification already sent for this event+child
      IF NOT EXISTS (
        SELECT 1 FROM notifications
        WHERE related_entity_type = 'event'
          AND related_entity_id = v_event.id
          AND type = 'dropoff_expected'
      ) THEN
        -- Check if a dropoff handoff was already confirmed today for this child
        IF NOT EXISTS (
          SELECT 1 FROM handoffs
          WHERE child_id = v_child_record.child_id
            AND family_id = v_event.family_id
            AND DATE(actual_at) = CURRENT_DATE
            AND from_parent_id = v_event.expected_by
        ) THEN
          INSERT INTO notifications (
            family_id, recipient_id, type, category,
            title, message, priority,
            related_entity_type, related_entity_id, requires_action
          ) VALUES (
            v_event.family_id,
            v_event.expected_by,
            'dropoff_expected',
            'handoff',
            'Dropoff Reminder',
            'Have you dropped off ' || v_child_record.name || ' at ' || v_event.title || ' yet?',
            'normal',
            'event', v_event.id, false
          );
        END IF;
      END IF;
    END LOOP;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 6. VERIFICATION
-- =====================================================

-- Test is_expected_parent
-- SELECT is_expected_parent('8766befa-1622-4779-a213-5848537111e4', '172b500d-ff16-448c-a2e7-903b56cb0368');

-- Check status change trigger exists
-- SELECT trigger_name FROM information_schema.triggers WHERE trigger_name = 'children_status_log';

-- Check activity_log for status changes
-- SELECT * FROM activity_log WHERE entity_type = 'child' ORDER BY timestamp DESC LIMIT 5;
