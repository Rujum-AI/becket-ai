-- Quick fix for expense_budget_cache RLS issue
-- Run this in Supabase SQL Editor

-- Option 1: Add RLS policies (RECOMMENDED)
ALTER TABLE expense_budget_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "budget_cache_read" ON expense_budget_cache
  FOR SELECT USING (family_id IN (SELECT user_family_ids()));

CREATE POLICY "budget_cache_insert" ON expense_budget_cache
  FOR INSERT WITH CHECK (family_id IN (SELECT user_family_ids()));

CREATE POLICY "budget_cache_update" ON expense_budget_cache
  FOR UPDATE USING (family_id IN (SELECT user_family_ids()));

CREATE POLICY "budget_cache_delete" ON expense_budget_cache
  FOR DELETE USING (family_id IN (SELECT user_family_ids()));

-- Option 2: If triggers don't exist yet, just disable RLS temporarily
-- (Only use this if you want to move fast and add triggers later)
-- ALTER TABLE expense_budget_cache DISABLE ROW LEVEL SECURITY;
