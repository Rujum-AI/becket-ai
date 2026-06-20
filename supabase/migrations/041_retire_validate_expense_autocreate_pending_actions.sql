-- =====================================================
-- BECKET AI - RETIRE LEGACY VALIDATION + AUTO-CREATE PENDING ACTIONS
-- Migration 041
-- =====================================================
--
-- Two cleanup tasks the budgets-normalize cutover left dangling:
--
-- 1. The legacy validate_expense() trigger (from migration 005-era)
--    re-runs old JSONB-based budget/no-rule checks AFTER every insert
--    and forcibly flips status to 'pending_approval'. It contradicts
--    classifyExpense (the new app-side source of truth) and ignores
--    included_categories + the normalized category_budgets table.
--    Drop it.
--
-- 2. PendingSection on /finance reads from pending_actions. Until now
--    only the app's addExpense() wrote those rows. Any other path
--    (direct SQL, future automations, batch imports) would leave a
--    pending_approval expense without a corresponding pending_actions
--    row — so the approve UI on /finance has nothing to show, even
--    though the notification still fires. Move that responsibility to
--    a DB trigger: any expense that lands or transitions into
--    pending_approval gets its pending_actions row automatically.

-- ----------------------------------------------------
-- 1. Retire the legacy validation trigger
-- ----------------------------------------------------
DROP TRIGGER IF EXISTS expenses_auto_validate ON expenses;
DROP FUNCTION IF EXISTS trigger_validate_expense();
-- validate_expense() still exists in case anything else calls it; if
-- nothing does after a while we'll drop it too.

-- ----------------------------------------------------
-- 2. Auto-create pending_actions on pending_approval expenses
-- ----------------------------------------------------
CREATE OR REPLACE FUNCTION auto_create_pending_action_for_expense()
RETURNS trigger AS $$
BEGIN
  IF NEW.status != 'pending_approval' THEN
    RETURN NEW;
  END IF;

  -- Idempotent: skip if a pending row for this expense already exists
  IF EXISTS (
    SELECT 1 FROM pending_actions
    WHERE target_type = 'expense'
      AND target_id = NEW.id
      AND status = 'pending'
  ) THEN
    RETURN NEW;
  END IF;

  INSERT INTO pending_actions (family_id, target_type, target_id, reason, requested_by)
  VALUES (
    NEW.family_id,
    'expense',
    NEW.id,
    COALESCE(NEW.requires_approval_reason, 'no_rule'),
    NEW.created_by
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS expenses_auto_pending_action_insert ON expenses;
CREATE TRIGGER expenses_auto_pending_action_insert
  AFTER INSERT ON expenses
  FOR EACH ROW EXECUTE FUNCTION auto_create_pending_action_for_expense();

DROP TRIGGER IF EXISTS expenses_auto_pending_action_update ON expenses;
CREATE TRIGGER expenses_auto_pending_action_update
  AFTER UPDATE OF status ON expenses
  FOR EACH ROW
  WHEN (NEW.status = 'pending_approval' AND OLD.status IS DISTINCT FROM 'pending_approval')
  EXECUTE FUNCTION auto_create_pending_action_for_expense();

-- ----------------------------------------------------
-- 3. Backfill: any current pending_approval expense without a
--    pending_actions row gets one now, so existing pending entries
--    show up in /finance PendingSection too.
-- ----------------------------------------------------
INSERT INTO pending_actions (family_id, target_type, target_id, reason, requested_by, requested_at, status, created_at)
SELECT
  e.family_id,
  'expense',
  e.id,
  COALESCE(e.requires_approval_reason, 'no_rule'),
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
