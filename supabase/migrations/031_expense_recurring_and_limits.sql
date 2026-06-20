-- =====================================================
-- BECKET AI - EXPENSE RECURRING + ITEM LIMITS
-- Migration 031: Recurring metadata on expenses
-- =====================================================

ALTER TABLE expenses ADD COLUMN IF NOT EXISTS
  is_recurring boolean NOT NULL DEFAULT false;

ALTER TABLE expenses ADD COLUMN IF NOT EXISTS
  recurrence_period text CHECK (recurrence_period IN ('monthly', 'weekly', 'yearly'));

-- exceeds_count is a valid pending reason when a category's item-count limit
-- is reached (e.g. only one after-school activity may be auto-split).
ALTER TABLE expenses DROP CONSTRAINT IF EXISTS expenses_requires_approval_reason_check;
ALTER TABLE expenses ADD CONSTRAINT expenses_requires_approval_reason_check
  CHECK (requires_approval_reason IN ('category_other', 'exceeds_budget', 'exceeds_count', 'no_rule'));
