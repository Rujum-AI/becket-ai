-- =====================================================
-- BECKET AI - CATEGORY BUDGETS (NORMALIZED)
-- Migration 039: lift budgets out of understandings.expense_rules JSONB
-- =====================================================
--
-- Why: until now a category's monthly/yearly budget lived buried in
-- understandings.expense_rules.categories[].budget_limit. You can't
-- index it, can't easily report on it, AI can't reason about it
-- relationally. This migration makes budgets a first-class entity.
--
-- This wave does:
--   1. The category_budgets table + RLS + realtime
--   2. Idempotent backfill from the active expense rules' JSONB
-- The app cutover (read/write through this table instead of JSONB)
-- happens in follow-on commits on this branch (budgets-normalize).
--
-- Money budgets only. Item-count caps (cat.limit_count) stay in JSONB
-- for now — different concept, separate normalization.

-- =====================================================
-- 1. category_budgets
-- =====================================================
CREATE TABLE IF NOT EXISTS category_budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  child_id uuid REFERENCES children(id) ON DELETE CASCADE,  -- NULL = family-wide; not-NULL = per-child override
  category text NOT NULL CHECK (category IN ('education','activities','healthcare','clothing','food','legal','events','other')),
  period text NOT NULL CHECK (period IN ('monthly','yearly')),
  limit_amount numeric(12,2) NOT NULL CHECK (limit_amount > 0),

  created_by uuid REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- One budget per (family, category, child-scope, period). The COALESCE
-- on child_id collapses NULL into a sentinel so the unique index treats
-- "family-wide for category X / monthly" as a single row, while still
-- allowing per-child overrides with their own row.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_category_budgets
  ON category_budgets (family_id, category, COALESCE(child_id, '00000000-0000-0000-0000-000000000000'::uuid), period);

CREATE INDEX IF NOT EXISTS idx_category_budgets_family ON category_budgets(family_id);

DROP TRIGGER IF EXISTS category_budgets_updated_at ON category_budgets;
CREATE TRIGGER category_budgets_updated_at
  BEFORE UPDATE ON category_budgets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

COMMENT ON TABLE category_budgets IS
  'Normalized money budgets per category (and optionally per child). Replaces the budget_limit nested in understandings.expense_rules.categories[].';

-- =====================================================
-- 2. RLS — family-scoped read + write
-- =====================================================
ALTER TABLE category_budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "category_budgets_read" ON category_budgets
  FOR SELECT USING (family_id IN (SELECT user_family_ids()));

CREATE POLICY "category_budgets_insert" ON category_budgets
  FOR INSERT WITH CHECK (
    family_id IN (SELECT user_family_ids())
    AND created_by = auth.uid()
  );

CREATE POLICY "category_budgets_update" ON category_budgets
  FOR UPDATE USING (family_id IN (SELECT user_family_ids()));

CREATE POLICY "category_budgets_delete" ON category_budgets
  FOR DELETE USING (family_id IN (SELECT user_family_ids()));

-- =====================================================
-- 3. Realtime
-- =====================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'category_budgets'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE category_budgets;
  END IF;
END $$;

-- =====================================================
-- 4. Idempotent backfill from active expense rules
-- =====================================================
-- Source: understandings rows where status='active' and category='expenses'.
-- For each entry in expense_rules.categories[] that carries a non-zero
-- budget_limit, we land one category_budgets row. ON CONFLICT DO NOTHING
-- keeps the migration safe to re-run (and safe to re-apply after a partial
-- migration during a previous attempt).

INSERT INTO category_budgets (family_id, child_id, category, period, limit_amount, created_by, created_at, updated_at)
SELECT
  u.family_id,
  u.child_id,
  (cat.value->>'name'),
  COALESCE(NULLIF(cat.value->'budget_limit'->>'period', ''), 'monthly'),
  (cat.value->'budget_limit'->>'amount')::numeric,
  u.proposed_by,
  u.created_at,
  u.updated_at
FROM understandings u,
     jsonb_array_elements(u.expense_rules->'categories') AS cat
WHERE u.status = 'active'
  AND u.category = 'expenses'
  AND cat.value ? 'budget_limit'
  AND (cat.value->'budget_limit'->>'amount') IS NOT NULL
  AND (cat.value->'budget_limit'->>'amount')::numeric > 0
  -- Skip categories whose name isn't in the allowed set, just in case stale data exists
  AND (cat.value->>'name') IN ('education','activities','healthcare','clothing','food','legal','events','other')
ON CONFLICT (family_id, category, COALESCE(child_id, '00000000-0000-0000-0000-000000000000'::uuid), period) DO NOTHING;
