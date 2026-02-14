-- =====================================================
-- BECKET AI - NOTIFICATION ENGINE
-- Migration 010: Database-triggered notifications
-- Moves notification creation from frontend to PostgreSQL triggers
-- Fixes RLS 403 error permanently by using SECURITY DEFINER
-- =====================================================

-- =====================================================
-- 1. HELPER: Get the other parent in a family
-- Returns NULL in solo mode (no partner)
-- =====================================================
CREATE OR REPLACE FUNCTION get_family_partner(
  p_family_id uuid,
  p_user_id uuid
)
RETURNS uuid AS $$
  SELECT profile_id
  FROM family_members
  WHERE family_id = p_family_id
    AND profile_id != p_user_id
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- =====================================================
-- 2. TRIGGER FUNCTION: Notify on handoff
-- Fires AFTER INSERT on handoffs
-- =====================================================
CREATE OR REPLACE FUNCTION notify_on_handoff()
RETURNS trigger AS $$
DECLARE
  v_child_name text;
  v_notif_type text;
  v_recipient_id uuid;
  v_title text;
  v_message text;
BEGIN
  -- Solo mode check: from_parent = to_parent means self-handoff
  IF NEW.from_parent_id = NEW.to_parent_id THEN
    RETURN NEW;
  END IF;

  -- Get child name for notification message
  SELECT name INTO v_child_name
  FROM children
  WHERE id = NEW.child_id;

  -- Determine direction: who inserted this handoff?
  -- If to_parent inserted → this is a pickup → notify from_parent
  -- If from_parent inserted → this is a dropoff → notify to_parent
  IF auth.uid() = NEW.to_parent_id THEN
    -- Pickup: current user is receiving child
    v_notif_type := 'pickup_confirmed';
    v_recipient_id := NEW.from_parent_id;
    v_title := 'Pickup Confirmed';
    v_message := COALESCE(v_child_name, 'Child') || ' was picked up';
  ELSIF auth.uid() = NEW.from_parent_id THEN
    -- Dropoff: current user is sending child
    v_notif_type := 'dropoff_confirmed';
    v_recipient_id := NEW.to_parent_id;
    v_title := 'Dropoff Completed';
    v_message := COALESCE(v_child_name, 'Child') || ' was dropped off';
    IF NEW.notes IS NOT NULL AND NEW.notes != '' THEN
      v_message := v_message || ' at ' || NEW.notes;
    END IF;
  ELSE
    -- Edge case: system-generated handoff or unknown actor
    RETURN NEW;
  END IF;

  -- Insert notification (bypasses RLS via SECURITY DEFINER)
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
    v_recipient_id,
    v_notif_type,
    'handoff',
    v_title,
    v_message,
    'normal',
    'handoff',
    NEW.id,
    false
  );

  -- If handoff has an event_id, mark that event as confirmed
  IF NEW.event_id IS NOT NULL THEN
    UPDATE events
    SET status = 'confirmed',
        confirmed_at = NEW.actual_at,
        confirmed_by = auth.uid(),
        actual_time = NEW.actual_at
    WHERE id = NEW.event_id;
  END IF;

  -- Log to activity_log
  INSERT INTO activity_log (
    family_id,
    actor_id,
    action,
    entity_type,
    entity_id,
    changes
  ) VALUES (
    NEW.family_id,
    auth.uid(),
    'created',
    'handoff',
    NEW.id,
    jsonb_build_object(
      'from_parent_id', NEW.from_parent_id,
      'to_parent_id', NEW.to_parent_id,
      'child_id', NEW.child_id,
      'actual_at', NEW.actual_at
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER handoffs_notify
  AFTER INSERT ON handoffs
  FOR EACH ROW EXECUTE FUNCTION notify_on_handoff();

-- =====================================================
-- 3. TRIGGER FUNCTION: Notify on expense
-- Fires AFTER INSERT on expenses
-- Trigger name sorts AFTER expenses_auto_validate
-- =====================================================
CREATE OR REPLACE FUNCTION notify_on_expense()
RETURNS trigger AS $$
DECLARE
  v_partner_id uuid;
  v_notif_type text;
  v_notif_category text;
  v_title text;
  v_message text;
  v_priority text;
  v_requires_action boolean;
  v_current_status text;
  v_currency text;
BEGIN
  -- Get partner ID
  v_partner_id := get_family_partner(NEW.family_id, NEW.created_by);

  -- Solo mode: no partner, skip notification
  IF v_partner_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Re-read the expense row to get status AFTER validate trigger has run
  SELECT status INTO v_current_status
  FROM expenses
  WHERE id = NEW.id;

  -- Get family currency for message
  SELECT currency INTO v_currency
  FROM families
  WHERE id = NEW.family_id;

  IF v_current_status = 'pending_approval' THEN
    v_notif_type := 'expense_pending';
    v_notif_category := 'approval';
    v_title := 'Expense Needs Approval';
    v_message := NEW.title || ' - ' || NEW.amount || ' ' || COALESCE(v_currency, 'NIS');
    IF NEW.requires_approval_reason IS NOT NULL THEN
      v_message := v_message || ' (' || NEW.requires_approval_reason || ')';
    END IF;
    v_priority := 'high';
    v_requires_action := true;
  ELSE
    v_notif_type := 'expense_added';
    v_notif_category := 'expense';
    v_title := 'New Expense Added';
    v_message := NEW.title || ' - ' || NEW.amount || ' ' || COALESCE(v_currency, 'NIS');
    v_priority := 'normal';
    v_requires_action := false;
  END IF;

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
    v_partner_id,
    v_notif_type,
    v_notif_category,
    v_title,
    v_message,
    v_priority,
    'expense',
    NEW.id,
    v_requires_action
  );

  -- Log to activity_log
  INSERT INTO activity_log (
    family_id,
    actor_id,
    action,
    entity_type,
    entity_id,
    changes
  ) VALUES (
    NEW.family_id,
    NEW.created_by,
    'created',
    'expense',
    NEW.id,
    jsonb_build_object(
      'title', NEW.title,
      'amount', NEW.amount,
      'category', NEW.category,
      'status', v_current_status
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER expenses_notify
  AFTER INSERT ON expenses
  FOR EACH ROW EXECUTE FUNCTION notify_on_expense();

-- =====================================================
-- 4. TRIGGER FUNCTION: Notify on task/ask creation
-- Fires AFTER INSERT on tasks
-- =====================================================
CREATE OR REPLACE FUNCTION notify_on_task()
RETURNS trigger AS $$
DECLARE
  v_partner_id uuid;
  v_recipient_id uuid;
  v_notif_type text;
  v_notif_category text;
  v_title text;
  v_message text;
  v_requires_action boolean;
  v_creator_name text;
BEGIN
  IF NEW.type = 'task' THEN
    -- Task: only notify if assigned to someone other than creator
    IF NEW.owner_id IS NULL OR NEW.owner_id = NEW.creator_id THEN
      RETURN NEW;
    END IF;

    -- Get creator name for message
    SELECT display_name INTO v_creator_name
    FROM profiles
    WHERE id = NEW.creator_id;

    v_recipient_id := NEW.owner_id;
    v_notif_type := 'task_assigned';
    v_notif_category := 'task';
    v_title := 'New Task Assigned';
    v_message := NEW.name || ' (assigned by ' || COALESCE(v_creator_name, 'Partner') || ')';
    v_requires_action := false;

  ELSIF NEW.type = 'ask' THEN
    -- Ask: notify partner
    v_partner_id := get_family_partner(NEW.family_id, NEW.creator_id);

    -- Solo mode: skip
    IF v_partner_id IS NULL THEN
      RETURN NEW;
    END IF;

    v_recipient_id := v_partner_id;
    v_notif_type := 'ask_received';
    v_notif_category := 'ask';
    v_title := 'New Ask Received';
    v_message := NEW.name;
    v_requires_action := true;
  ELSE
    RETURN NEW;
  END IF;

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
    v_recipient_id,
    v_notif_type,
    v_notif_category,
    v_title,
    v_message,
    'normal',
    'task',
    NEW.id,
    v_requires_action
  );

  -- Log to activity_log
  INSERT INTO activity_log (
    family_id,
    actor_id,
    action,
    entity_type,
    entity_id,
    changes
  ) VALUES (
    NEW.family_id,
    NEW.creator_id,
    'created',
    'task',
    NEW.id,
    jsonb_build_object(
      'type', NEW.type,
      'name', NEW.name,
      'owner_id', NEW.owner_id
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER tasks_notify
  AFTER INSERT ON tasks
  FOR EACH ROW EXECUTE FUNCTION notify_on_task();

-- =====================================================
-- 5. TRIGGER FUNCTION: Notify on understanding changes
-- Fires AFTER INSERT and AFTER UPDATE on understandings
-- =====================================================
CREATE OR REPLACE FUNCTION notify_on_understanding()
RETURNS trigger AS $$
DECLARE
  v_partner_id uuid;
  v_recipient_id uuid;
  v_notif_type text;
  v_title text;
  v_message text;
  v_priority text;
  v_requires_action boolean;
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- New understanding proposed: notify partner
    v_partner_id := get_family_partner(NEW.family_id, NEW.proposed_by);

    -- Solo mode: skip
    IF v_partner_id IS NULL THEN
      RETURN NEW;
    END IF;

    v_recipient_id := v_partner_id;
    v_notif_type := 'understanding_proposed';
    v_title := 'Pending Approval';
    v_message := 'New understanding proposal: ' || COALESCE(NEW.subject, NEW.category);
    v_priority := 'high';
    v_requires_action := true;

  ELSIF TG_OP = 'UPDATE' THEN
    -- Only care about status changes
    IF OLD.status = NEW.status THEN
      RETURN NEW;
    END IF;

    IF NEW.status = 'active' AND OLD.status = 'pending' THEN
      -- Accepted: notify the proposer
      v_recipient_id := NEW.proposed_by;
      v_notif_type := 'understanding_accepted';
      v_title := 'Understanding Accepted';
      v_message := '"' || COALESCE(NEW.subject, NEW.category) || '" was approved';
      v_priority := 'normal';
      v_requires_action := false;

    ELSIF NEW.status = 'rejected' AND OLD.status = 'pending' THEN
      -- Rejected: notify the proposer
      v_recipient_id := NEW.proposed_by;
      v_notif_type := 'understanding_rejected';
      v_title := 'Understanding Rejected';
      v_message := '"' || COALESCE(NEW.subject, NEW.category) || '" was not approved';
      v_priority := 'normal';
      v_requires_action := false;

    ELSE
      -- Other status changes (superseded, terminated): no notification
      RETURN NEW;
    END IF;
  END IF;

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
    v_recipient_id,
    v_notif_type,
    'approval',
    v_title,
    v_message,
    v_priority,
    'understanding',
    NEW.id,
    v_requires_action
  );

  -- Log to activity_log
  INSERT INTO activity_log (
    family_id,
    actor_id,
    action,
    entity_type,
    entity_id,
    changes
  ) VALUES (
    NEW.family_id,
    COALESCE(auth.uid(), NEW.proposed_by),
    CASE WHEN TG_OP = 'INSERT' THEN 'created' ELSE 'updated' END,
    'understanding',
    NEW.id,
    CASE WHEN TG_OP = 'INSERT'
      THEN jsonb_build_object('subject', NEW.subject, 'category', NEW.category)
      ELSE jsonb_build_object('status', jsonb_build_object('old', OLD.status, 'new', NEW.status))
    END
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER understandings_notify
  AFTER INSERT OR UPDATE ON understandings
  FOR EACH ROW EXECUTE FUNCTION notify_on_understanding();

-- =====================================================
-- 6. RESTRICT NOTIFICATION INSERT POLICY
-- Frontend no longer needs to insert notifications.
-- Only SECURITY DEFINER functions insert (they bypass RLS).
-- =====================================================
DROP POLICY IF EXISTS "notifications_insert" ON notifications;
DROP POLICY IF EXISTS "Users can insert notifications for family members" ON notifications;

-- Only allow system/service_role to insert
-- SECURITY DEFINER functions bypass RLS entirely,
-- so this policy only blocks direct client-side inserts.
CREATE POLICY "notifications_insert" ON notifications
  FOR INSERT WITH CHECK (false);

-- Verify policies
SELECT policyname, cmd, permissive, with_check
FROM pg_policies
WHERE tablename = 'notifications'
ORDER BY policyname;
