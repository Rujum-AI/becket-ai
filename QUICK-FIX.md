## 🚨 QUICK FIX - Run This Now in Supabase

**Copy this entire SQL block and run it in Supabase SQL Editor:**

```sql
-- 1. Create expense_budget_cache table if it doesn't exist
CREATE TABLE IF NOT EXISTS expense_budget_cache (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id uuid REFERENCES families(id) ON DELETE CASCADE NOT NULL,
    child_id uuid REFERENCES children(id) ON DELETE SET NULL,
    category text NOT NULL,
    period_type text NOT NULL,
    period_key text NOT NULL,
    total_amount decimal DEFAULT 0,
    updated_at timestamptz DEFAULT now(),
    UNIQUE(family_id, child_id, category, period_type, period_key)
);

-- 2. Enable RLS on the table
ALTER TABLE expense_budget_cache ENABLE ROW LEVEL SECURITY;

-- 3. Add RLS policies
CREATE POLICY "budget_cache_read" ON expense_budget_cache
  FOR SELECT USING (family_id IN (SELECT user_family_ids()));

CREATE POLICY "budget_cache_insert" ON expense_budget_cache
  FOR INSERT WITH CHECK (family_id IN (SELECT user_family_ids()));

CREATE POLICY "budget_cache_update" ON expense_budget_cache
  FOR UPDATE USING (family_id IN (SELECT user_family_ids()));

CREATE POLICY "budget_cache_delete" ON expense_budget_cache
  FOR DELETE USING (family_id IN (SELECT user_family_ids()));
```

**Then refresh your app and try adding an expense again!**

---

## ⚠️ Note about Console Errors

The React/sidecar errors you see are from a Chrome extension, NOT your app. Ignore them.

The only error that matters is:
```
new row violates row-level security policy for table "expense_budget_cache"
```

That's what the SQL above fixes! ✅
