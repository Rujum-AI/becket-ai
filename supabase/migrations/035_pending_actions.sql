-- =====================================================
-- BECKET AI - UNIVERSAL PENDING/APPROVAL FRAMEWORK
-- Migration 035: pending_actions table + RLS + realtime + notify
-- =====================================================
--
-- Why: today "this needs the other parent's approval" lives in three
-- different shapes — expenses.requires_approval_reason, events with
-- status='pending_approval', and the rule-change flow in
-- understandings. No way to query "what's waiting on me" across types,
-- no shared approve/reject UI, no place for AI to plug in.
--
-- pending_actions is one table that points (target_type, target_id) at
-- whatever is awaiting a decision. The downstream UI reads it once per
-- type and renders Pending sections. Future AI sits on this table.
--
-- This wave: table + RLS + realtime + insert-notify trigger + backfill.
-- The decide-side trigger (auto-update target on approve/reject) lands
-- in Wave 2.3 when the approve/reject UI gets wired — keeps blast
-- radius small per wave.

-- =====================================================
-- 1. PENDING_ACTIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS pending_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,

  -- What needs a decision
  target_type text NOT NULL CHECK (target_type IN ('expense', 'event', 'task', 'rule_change', 'custody_override')),
  target_id uuid NOT NULL,
  reason text,  -- e.g. 'category_other', 'exceeds_budget', 'cross_day_event' — drives the UI message

  -- Who proposed it
  requested_by uuid NOT NULL REFERENCES profiles(id),
  requested_at timestamptz NOT NULL DEFAULT now(),

  -- Lifecycle
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  decided_by uuid REFERENCES profiles(id),
  decided_at timestamptz,
  decision_reason text,  -- optional free-text from the decider

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pending_actions_family_status ON pending_actions(family_id, status);
CREATE INDEX IF NOT EXISTS idx_pending_actions_target ON pending_actions(target_type, target_id);

-- Only ONE outstanding pending row per target — prevents duplicate requests piling up.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_pending_actions_one_pending_per_target
  ON pending_actions(target_type, target_id) WHERE status = 'pending';

DROP TRIGGER IF EXISTS pending_actions_updated_at ON pending_actions;
CREATE TRIGGER pending_actions_updated_at
  BEFORE UPDATE ON pending_actions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =====================================================
-- 2. RLS — read = family, insert = requester, update = the OTHER parent
-- =====================================================
ALTER TABLE pending_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pending_actions_read" ON pending_actions
  FOR SELECT USING (family_id IN (SELECT user_family_ids()));

CREATE POLICY "pending_actions_insert" ON pending_actions
  FOR INSERT WITH CHECK (
    family_id IN (SELECT user_family_ids())
    AND requested_by = auth.uid()
  );

-- Decisions: only the OTHER parent can update (approve/reject).
-- The requester can also update — but only to cancel their own request
-- (status='cancelled'). Enforcement of "only cancel" lives in the app
-- layer for now (a stricter CHECK can move here once 2.3 lands).
CREATE POLICY "pending_actions_update" ON pending_actions
  FOR UPDATE USING (
    family_id IN (SELECT user_family_ids())
    AND (
      requested_by != auth.uid()     -- the other parent decides
      OR requested_by = auth.uid()   -- or requester cancels
    )
  );

CREATE POLICY "pending_actions_delete" ON pending_actions
  FOR DELETE USING (
    family_id IN (SELECT user_family_ids())
    AND requested_by = auth.uid()
  );

-- =====================================================
-- 3. REALTIME — both parents' UIs need live updates
-- =====================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'pending_actions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE pending_actions;
  END IF;
END $$;

-- =====================================================
-- 4. NOTIFY ON INSERT — reuse existing notifications engine
-- =====================================================
CREATE OR REPLACE FUNCTION notify_on_pending_action()
RETURNS trigger AS $$
DECLARE
  v_partner_id uuid;
  v_requester_name text;
  v_title text;
  v_message text;
  v_target_label text;
BEGIN
  -- Only notify on initial pending creation
  IF NEW.status != 'pending' THEN
    RETURN NEW;
  END IF;

  v_partner_id := get_family_partner(NEW.family_id, NEW.requested_by);

  -- Solo mode (no partner): nothing to notify
  IF v_partner_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT display_name INTO v_requester_name
  FROM profiles WHERE id = NEW.requested_by;

  v_target_label := CASE NEW.target_type
    WHEN 'expense' THEN 'expense'
    WHEN 'event' THEN 'event'
    WHEN 'task' THEN 'task'
    WHEN 'rule_change' THEN 'rule change'
    WHEN 'custody_override' THEN 'custody change'
    ELSE NEW.target_type
  END;

  v_title := 'Approval needed';
  v_message := COALESCE(v_requester_name, 'Your co-parent') || ' added a ' || v_target_label || ' that needs your review';

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
    'pending_action_created',
    'approval',
    v_title,
    v_message,
    'normal',
    -- Map target_type to the constrained set the notifications table accepts.
    -- 'rule_change' → 'understanding' (closest match); others map 1:1.
    CASE NEW.target_type
      WHEN 'rule_change' THEN 'understanding'
      WHEN 'custody_override' THEN 'event'
      ELSE NEW.target_type
    END,
    NEW.target_id,
    true
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS pending_actions_notify ON pending_actions;
CREATE TRIGGER pending_actions_notify
  AFTER INSERT ON pending_actions
  FOR EACH ROW EXECUTE FUNCTION notify_on_pending_action();

-- =====================================================
-- 5. BACKFILL existing pending_approval expenses + events
-- =====================================================
-- One-shot, idempotent (NOT EXISTS guard). New flagged actions go
-- through the app layer; this just gets historical rows visible in the
-- new Pending UI.

INSERT INTO pending_actions (family_id, target_type, target_id, reason, requested_by, requested_at, status, created_at)
SELECT
  e.family_id,
  'expense',
  e.id,
  COALESCE(e.requires_approval_reason, 'legacy'),
  e.created_by,
  e.created_at,
  'pending',
  e.created_at
FROM expenses e
WHERE e.status = 'pending_approval'
  AND e.created_by IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM pending_actions pa
    WHERE pa.target_type = 'expense' AND pa.target_id = e.id AND pa.status = 'pending'
  );

INSERT INTO pending_actions (family_id, target_type, target_id, reason, requested_by, requested_at, status, created_at)
SELECT
  ev.family_id,
  'event',
  ev.id,
  'cross_day_event',
  ev.created_by,
  ev.created_at,
  'pending',
  ev.created_at
FROM events ev
WHERE ev.status = 'pending_approval'
  AND ev.created_by IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM pending_actions pa
    WHERE pa.target_type = 'event' AND pa.target_id = ev.id AND pa.status = 'pending'
  );
