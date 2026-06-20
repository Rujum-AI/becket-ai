-- =====================================================
-- BECKET AI - SYNC CATEGORY BUDGETS FROM ACTIVE RULES
-- Migration 040: DB-level sync, so app paths can't drift
-- =====================================================
--
-- Why: migration 039 added category_budgets and the app-side helper
-- syncCategoryBudgetsFromRule() that runs on saveExpenseRules /
-- approveExpenseRules. That works IF the app code is fresh and IF
-- every future path remembers to call it. Both fragile.
--
-- This moves the sync to the database: whenever an understanding
-- becomes active (INSERT status='active' OR UPDATE status→'active'),
-- the trigger replaces the family/child-scope budgets with whatever
-- the rule's JSONB carries. Single source of truth, no way to miss.
--
-- Also runs a one-shot sync over every currently-active rule so the
-- table reflects today's reality without waiting for the next save.

CREATE OR REPLACE FUNCTION sync_category_budgets_from_rule()
RETURNS trigger AS $$
DECLARE
  v_cat jsonb;
BEGIN
  -- Only react to the 'expenses' category — other understanding
  -- categories (parenting, holidays, etc.) don't carry budget data.
  IF NEW.category != 'expenses' THEN
    RETURN NEW;
  END IF;

  -- We only care when this row IS active. Inserts that go straight
  -- to 'pending' or anything else are ignored until they activate
  -- via UPDATE.
  IF NEW.status != 'active' THEN
    RETURN NEW;
  END IF;

  -- For UPDATE, only fire on transitions INTO active. Re-saves that
  -- keep status='active' (rare; valid_until tweaks, etc.) still
  -- benefit from re-syncing, so we don't add that guard.

  -- Replace-all in scope: wipe budgets for this rule's family + child
  -- scope, then insert from the JSONB.
  DELETE FROM category_budgets
  WHERE family_id = NEW.family_id
    AND child_id IS NOT DISTINCT FROM NEW.child_id;

  IF NEW.expense_rules ? 'categories' THEN
    FOR v_cat IN SELECT * FROM jsonb_array_elements(NEW.expense_rules->'categories')
    LOOP
      IF (v_cat->>'name') IN ('education','activities','healthcare','clothing','food','legal','events','other')
         AND v_cat ? 'budget_limit'
         AND (v_cat->'budget_limit'->>'amount') IS NOT NULL
         AND (v_cat->'budget_limit'->>'amount')::numeric > 0
      THEN
        INSERT INTO category_budgets (
          family_id, child_id, category, period, limit_amount, created_by
        ) VALUES (
          NEW.family_id,
          NEW.child_id,
          v_cat->>'name',
          COALESCE(NULLIF(v_cat->'budget_limit'->>'period', ''), 'monthly'),
          (v_cat->'budget_limit'->>'amount')::numeric,
          NEW.proposed_by
        );
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS understandings_sync_budgets_insert ON understandings;
CREATE TRIGGER understandings_sync_budgets_insert
  AFTER INSERT ON understandings
  FOR EACH ROW EXECUTE FUNCTION sync_category_budgets_from_rule();

DROP TRIGGER IF EXISTS understandings_sync_budgets_update ON understandings;
CREATE TRIGGER understandings_sync_budgets_update
  AFTER UPDATE OF status ON understandings
  FOR EACH ROW
  WHEN (NEW.status = 'active' AND OLD.status IS DISTINCT FROM 'active')
  EXECUTE FUNCTION sync_category_budgets_from_rule();

-- =====================================================
-- One-shot reconciliation for currently-active rules.
-- Touch each active row so the AFTER INSERT trigger logic effectively
-- re-runs via the INSERT path (we don't have a way to fire the
-- trigger directly here, so we use a no-op UPDATE that doesn't
-- match the UPDATE-trigger guard — instead we call the function
-- inline with a synthetic NEW record by selecting active rules and
-- replaying the sync logic.)
--
-- Simplest: just iterate active rules and re-run the same replace-all
-- logic the trigger does.
DO $$
DECLARE
  r record;
  v_cat jsonb;
BEGIN
  FOR r IN
    SELECT * FROM understandings
    WHERE status = 'active' AND category = 'expenses'
  LOOP
    DELETE FROM category_budgets
    WHERE family_id = r.family_id
      AND child_id IS NOT DISTINCT FROM r.child_id;

    IF r.expense_rules ? 'categories' THEN
      FOR v_cat IN SELECT * FROM jsonb_array_elements(r.expense_rules->'categories')
      LOOP
        IF (v_cat->>'name') IN ('education','activities','healthcare','clothing','food','legal','events','other')
           AND v_cat ? 'budget_limit'
           AND (v_cat->'budget_limit'->>'amount') IS NOT NULL
           AND (v_cat->'budget_limit'->>'amount')::numeric > 0
        THEN
          INSERT INTO category_budgets (
            family_id, child_id, category, period, limit_amount, created_by
          ) VALUES (
            r.family_id,
            r.child_id,
            v_cat->>'name',
            COALESCE(NULLIF(v_cat->'budget_limit'->>'period', ''), 'monthly'),
            (v_cat->'budget_limit'->>'amount')::numeric,
            r.proposed_by
          );
        END IF;
      END LOOP;
    END IF;
  END LOOP;
END $$;
