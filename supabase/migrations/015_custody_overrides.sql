-- =====================================================
-- BECKET AI - CUSTODY OVERRIDES
-- Migration 015: One-off custody changes with approval flow
-- Allows parents to request temporary custody changes for specific date ranges
-- Co-parent must approve before the override takes effect
-- =====================================================

-- =====================================================
-- 0. EXTEND NOTIFICATIONS CHECK CONSTRAINT
-- Add 'custody_override' to allowed related_entity_type values
-- =====================================================
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_related_entity_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_related_entity_type_check
  CHECK (related_entity_type IN ('event', 'understanding', 'expense', 'task', 'snapshot', 'handoff', 'custody_override'));

-- =====================================================
-- 1. CUSTODY_OVERRIDES TABLE
-- =====================================================
CREATE TABLE custody_overrides (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  family_id uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  from_date date NOT NULL,
  to_date date NOT NULL,
  override_parent text NOT NULL CHECK (override_parent IN ('dad', 'mom')),
  reason text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  requested_by uuid NOT NULL REFERENCES profiles(id),
  responded_by uuid REFERENCES profiles(id),
  responded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT check_date_range CHECK (from_date <= to_date)
);

CREATE INDEX idx_custody_overrides_family ON custody_overrides(family_id);
CREATE INDEX idx_custody_overrides_family_status ON custody_overrides(family_id, status);
CREATE INDEX idx_custody_overrides_family_dates ON custody_overrides(family_id, from_date, to_date);

-- =====================================================
-- 2. RLS POLICIES (standard family-scoped)
-- =====================================================
ALTER TABLE custody_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "custody_overrides_read" ON custody_overrides
  FOR SELECT USING (family_id IN (SELECT user_family_ids()));

CREATE POLICY "custody_overrides_insert" ON custody_overrides
  FOR INSERT WITH CHECK (family_id IN (SELECT user_family_ids()));

CREATE POLICY "custody_overrides_update" ON custody_overrides
  FOR UPDATE USING (family_id IN (SELECT user_family_ids()));

CREATE POLICY "custody_overrides_delete" ON custody_overrides
  FOR DELETE USING (family_id IN (SELECT user_family_ids()));

-- Auto-update timestamp
CREATE TRIGGER custody_overrides_updated_at
  BEFORE UPDATE ON custody_overrides
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =====================================================
-- 3. NOTIFICATION TRIGGER
-- Fires on INSERT (new request) and UPDATE (approve/reject)
-- Uses SECURITY DEFINER to bypass notification INSERT RLS
-- =====================================================
CREATE OR REPLACE FUNCTION notify_on_custody_override()
RETURNS trigger AS $$
DECLARE
  v_partner_id uuid;
  v_recipient_id uuid;
  v_notif_type text;
  v_title text;
  v_message text;
  v_priority text;
  v_requires_action boolean;
  v_requester_name text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- New override requested: notify partner
    v_partner_id := get_family_partner(NEW.family_id, NEW.requested_by);

    IF v_partner_id IS NULL THEN
      -- Solo mode: auto-approve immediately
      NEW.status := 'approved';
      NEW.responded_by := NEW.requested_by;
      NEW.responded_at := now();
      RETURN NEW;
    END IF;

    SELECT display_name INTO v_requester_name
    FROM profiles WHERE id = NEW.requested_by;

    v_recipient_id := v_partner_id;
    v_notif_type := 'custody_override_requested';
    v_title := 'Custody Change Request';
    v_message := COALESCE(v_requester_name, 'Partner') ||
                 ' requests custody change: ' ||
                 TO_CHAR(NEW.from_date, 'Mon DD') || ' - ' || TO_CHAR(NEW.to_date, 'Mon DD');
    v_priority := 'high';
    v_requires_action := true;

  ELSIF TG_OP = 'UPDATE' THEN
    -- Only fire on status change
    IF OLD.status = NEW.status THEN
      RETURN NEW;
    END IF;

    IF NEW.status = 'approved' AND OLD.status = 'pending' THEN
      v_recipient_id := NEW.requested_by;
      v_notif_type := 'custody_override_approved';
      v_title := 'Custody Change Approved';
      v_message := 'Your custody change (' ||
                   TO_CHAR(NEW.from_date, 'Mon DD') || ' - ' || TO_CHAR(NEW.to_date, 'Mon DD') ||
                   ') was approved';
      v_priority := 'normal';
      v_requires_action := false;

    ELSIF NEW.status = 'rejected' AND OLD.status = 'pending' THEN
      v_recipient_id := NEW.requested_by;
      v_notif_type := 'custody_override_rejected';
      v_title := 'Custody Change Rejected';
      v_message := 'Your custody change (' ||
                   TO_CHAR(NEW.from_date, 'Mon DD') || ' - ' || TO_CHAR(NEW.to_date, 'Mon DD') ||
                   ') was not approved';
      v_priority := 'normal';
      v_requires_action := false;
    ELSE
      RETURN NEW;
    END IF;
  END IF;

  -- Insert notification (SECURITY DEFINER bypasses RLS)
  INSERT INTO notifications (
    family_id, recipient_id, type, category,
    title, message, priority,
    related_entity_type, related_entity_id, requires_action
  ) VALUES (
    NEW.family_id, v_recipient_id, v_notif_type, 'approval',
    v_title, v_message, v_priority,
    'custody_override', NEW.id, v_requires_action
  );

  -- Log to activity_log
  INSERT INTO activity_log (
    family_id, actor_id, action, entity_type, entity_id, changes
  ) VALUES (
    NEW.family_id,
    COALESCE(auth.uid(), NEW.requested_by),
    CASE WHEN TG_OP = 'INSERT' THEN 'created' ELSE 'updated' END,
    'custody_override',
    NEW.id,
    jsonb_build_object(
      'from_date', NEW.from_date,
      'to_date', NEW.to_date,
      'override_parent', NEW.override_parent,
      'status', NEW.status
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER custody_overrides_notify
  AFTER INSERT OR UPDATE ON custody_overrides
  FOR EACH ROW EXECUTE FUNCTION notify_on_custody_override();
