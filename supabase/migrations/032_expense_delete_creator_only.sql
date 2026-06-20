-- =====================================================
-- BECKET AI - EXPENSE DELETE: CREATOR ONLY
-- Migration 032: Restrict expense deletion to the row's creator
-- =====================================================
--
-- Before: any family member could delete any expense in the family — the
-- client-side guard in deleteExpense() was bypassable via the REST API,
-- so a co-parent could silently wipe the other parent's entries.
--
-- After: only the profile that created the expense (created_by = auth.uid())
-- AND belongs to the family may delete it. Family membership stays as the
-- outer guard so deletes are still scoped per-family.

DROP POLICY IF EXISTS "expenses_delete" ON expenses;

CREATE POLICY "expenses_delete" ON expenses
  FOR DELETE USING (
    family_id IN (SELECT user_family_ids())
    AND created_by = auth.uid()
  );
