-- =====================================================
-- BECKET AI - TASK STATUS CHANGE NOTIFICATIONS
-- Migration 018: Notify on task/ask status transitions + activity logging
-- =====================================================

-- Trigger function: fires on UPDATE of tasks when status changes
CREATE OR REPLACE FUNCTION notify_on_task_update()
RETURNS trigger AS $$
DECLARE
  v_recipient_id uuid;
  v_notif_type text;
  v_notif_category text;
  v_title text;
  v_message text;
  v_actor_name text;
BEGIN
  -- Only fire on status changes
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- Get the actor's name (the person who changed the status)
  SELECT display_name INTO v_actor_name
  FROM profiles
  WHERE id = auth.uid();

  -- Determine recipient: notify the OTHER party
  -- If the actor is the creator → notify owner (or partner for asks)
  -- If the actor is the owner → notify creator
  IF auth.uid() = NEW.creator_id THEN
    IF NEW.type = 'ask' THEN
      v_recipient_id := get_family_partner(NEW.family_id, NEW.creator_id);
    ELSE
      v_recipient_id := NEW.owner_id;
    END IF;
  ELSE
    v_recipient_id := NEW.creator_id;
  END IF;

  -- Solo mode or self-action: skip notification but still log
  IF v_recipient_id IS NULL OR v_recipient_id = auth.uid() THEN
    -- Still log to activity_log
    INSERT INTO activity_log (
      family_id, actor_id, action, entity_type, entity_id, changes
    ) VALUES (
      NEW.family_id,
      auth.uid(),
      'updated',
      'task',
      NEW.id,
      jsonb_build_object(
        'old_status', OLD.status,
        'new_status', NEW.status,
        'type', NEW.type,
        'name', NEW.name
      )
    );
    RETURN NEW;
  END IF;

  -- Map status transitions to notification types
  IF NEW.type = 'task' THEN
    v_notif_category := 'task';
    CASE NEW.status
      WHEN 'in_progress' THEN
        v_notif_type := 'task_started';
        v_title := 'Task Started';
        v_message := NEW.name || ' (by ' || COALESCE(v_actor_name, 'Partner') || ')';
      WHEN 'completed' THEN
        v_notif_type := 'task_completed';
        v_title := 'Task Completed';
        v_message := NEW.name || ' marked as done';
      WHEN 'failed' THEN
        v_notif_type := 'task_failed';
        v_title := 'Task Failed';
        v_message := NEW.name || ' could not be completed';
      WHEN 'rejected' THEN
        v_notif_type := 'task_rejected';
        v_title := 'Task Rejected';
        v_message := NEW.name || ' was declined';
      ELSE
        RETURN NEW;
    END CASE;

  ELSIF NEW.type = 'ask' THEN
    v_notif_category := 'ask';
    CASE NEW.status
      WHEN 'completed' THEN
        v_notif_type := 'ask_accepted';
        v_title := 'Request Accepted';
        v_message := NEW.name || ' was approved';
      WHEN 'rejected' THEN
        v_notif_type := 'ask_rejected';
        v_title := 'Request Rejected';
        v_message := NEW.name || ' was declined';
      ELSE
        RETURN NEW;
    END CASE;
  ELSE
    RETURN NEW;
  END IF;

  -- Insert notification
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
    false
  );

  -- Log to activity_log
  INSERT INTO activity_log (
    family_id, actor_id, action, entity_type, entity_id, changes
  ) VALUES (
    NEW.family_id,
    auth.uid(),
    'updated',
    'task',
    NEW.id,
    jsonb_build_object(
      'old_status', OLD.status,
      'new_status', NEW.status,
      'type', NEW.type,
      'name', NEW.name
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on tasks table for UPDATE
CREATE TRIGGER tasks_status_notify
  AFTER UPDATE ON tasks
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION notify_on_task_update();
