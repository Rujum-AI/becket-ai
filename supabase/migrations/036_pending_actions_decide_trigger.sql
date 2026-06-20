-- =====================================================
-- BECKET AI - PENDING ACTIONS DECIDE TRIGGER
-- Migration 036: Auto-update target status when a pending_action resolves
-- =====================================================
--
-- Why: pending_actions is the universal "needs a decision" surface, but
-- the target tables (expenses, events) carry their own status columns
-- the rest of the app reads. When a parent approves/rejects, both
-- sides need to flip atomically — otherwise the expense stays
-- 'pending_approval' even after the partner clicks Approve.
--
-- This trigger watches UPDATEs on pending_actions. When status moves
-- from 'pending' to a terminal state, it updates the target row:
--   - approved → expense.status='counted', event.status='scheduled', task.status='in_progress'
--   - rejected → expense.status='rejected', event.status='rejected', task.status='rejected'
--   - cancelled → leave target alone (requester just withdrew)
--
-- Also stamps decided_by/decided_at if the app didn't.

CREATE OR REPLACE FUNCTION apply_pending_action_decision()
RETURNS trigger AS $$
DECLARE
  v_new_target_status text;
BEGIN
  -- Only act on transitions OUT of pending
  IF OLD.status != 'pending' OR NEW.status = 'pending' THEN
    RETURN NEW;
  END IF;

  -- Stamp decided_by/decided_at if missing
  IF NEW.decided_at IS NULL THEN
    NEW.decided_at := now();
  END IF;
  IF NEW.decided_by IS NULL THEN
    NEW.decided_by := auth.uid();
  END IF;

  -- Cancelled = requester withdrew, no target update needed
  IF NEW.status = 'cancelled' THEN
    RETURN NEW;
  END IF;

  -- Map decision → target status per type
  IF NEW.target_type = 'expense' THEN
    v_new_target_status := CASE NEW.status
      WHEN 'approved' THEN 'counted'
      WHEN 'rejected' THEN 'rejected'
    END;
    UPDATE expenses
      SET status = v_new_target_status,
          requires_approval_reason = NULL,
          updated_at = now()
      WHERE id = NEW.target_id;

  ELSIF NEW.target_type = 'event' THEN
    -- events_status_check doesn't permit 'rejected'; map to 'cancelled'.
    v_new_target_status := CASE NEW.status
      WHEN 'approved' THEN 'scheduled'
      WHEN 'rejected' THEN 'cancelled'
    END;
    UPDATE events
      SET status = v_new_target_status,
          updated_at = now()
      WHERE id = NEW.target_id;

  ELSIF NEW.target_type = 'task' THEN
    v_new_target_status := CASE NEW.status
      WHEN 'approved' THEN 'in_progress'
      WHEN 'rejected' THEN 'rejected'
    END;
    UPDATE tasks
      SET status = v_new_target_status,
          updated_at = now()
      WHERE id = NEW.target_id;

  -- rule_change and custody_override don't have a simple target.status to flip;
  -- their respective stores handle approval directly. No-op here.
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS pending_actions_decide ON pending_actions;
CREATE TRIGGER pending_actions_decide
  BEFORE UPDATE ON pending_actions
  FOR EACH ROW EXECUTE FUNCTION apply_pending_action_decision();

-- =====================================================
-- Notify on decision — partner sees "Approved" / "Rejected"
-- =====================================================
CREATE OR REPLACE FUNCTION notify_on_pending_action_decision()
RETURNS trigger AS $$
DECLARE
  v_requester_id uuid;
  v_decider_name text;
  v_title text;
  v_message text;
  v_target_label text;
BEGIN
  -- Only on resolution
  IF OLD.status != 'pending' OR NEW.status NOT IN ('approved', 'rejected') THEN
    RETURN NEW;
  END IF;

  v_requester_id := NEW.requested_by;

  SELECT display_name INTO v_decider_name
  FROM profiles WHERE id = COALESCE(NEW.decided_by, auth.uid());

  v_target_label := CASE NEW.target_type
    WHEN 'expense' THEN 'expense'
    WHEN 'event' THEN 'event'
    WHEN 'task' THEN 'task'
    WHEN 'rule_change' THEN 'rule change'
    WHEN 'custody_override' THEN 'custody change'
    ELSE NEW.target_type
  END;

  v_title := CASE NEW.status WHEN 'approved' THEN 'Approved' ELSE 'Rejected' END;
  v_message := COALESCE(v_decider_name, 'Your co-parent') || ' ' || NEW.status || ' your ' || v_target_label;

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
    requires_action
  ) VALUES (
    NEW.family_id,
    v_requester_id,
    'pending_action_' || NEW.status,
    'approval',
    v_title,
    v_message,
    'normal',
    CASE NEW.target_type
      WHEN 'rule_change' THEN 'understanding'
      WHEN 'custody_override' THEN 'event'
      ELSE NEW.target_type
    END,
    NEW.target_id,
    false
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS pending_actions_notify_decision ON pending_actions;
CREATE TRIGGER pending_actions_notify_decision
  AFTER UPDATE ON pending_actions
  FOR EACH ROW EXECUTE FUNCTION notify_on_pending_action_decision();
