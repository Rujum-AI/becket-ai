-- =====================================================
-- BECKET AI - TASKS, UNDERSTANDINGS, EXPENSES
-- Migration 005
-- =====================================================

-- =====================================================
-- 1. TASKS
-- =====================================================
CREATE TABLE tasks (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  family_id uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  child_id uuid REFERENCES children(id) ON DELETE SET NULL,
  type text NOT NULL CHECK (type IN ('task', 'ask')),
  name text NOT NULL,
  description text,
  urgency text NOT NULL CHECK (urgency IN ('low', 'mid', 'high', 'urgent')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed', 'rejected')),
  owner_id uuid REFERENCES profiles(id),
  creator_id uuid NOT NULL REFERENCES profiles(id),
  due_date date,
  becomes_event boolean NOT NULL DEFAULT false,
  related_event_id uuid REFERENCES events(id),
  event_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX idx_tasks_family ON tasks(family_id);
CREATE INDEX idx_tasks_family_status_type ON tasks(family_id, status, type);
CREATE INDEX idx_tasks_owner_status ON tasks(owner_id, status);
CREATE INDEX idx_tasks_child ON tasks(child_id, type, status);

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tasks_read" ON tasks
  FOR SELECT USING (family_id IN (SELECT user_family_ids()));

CREATE POLICY "tasks_insert" ON tasks
  FOR INSERT WITH CHECK (family_id IN (SELECT user_family_ids()));

CREATE POLICY "tasks_update" ON tasks
  FOR UPDATE USING (family_id IN (SELECT user_family_ids()));

CREATE POLICY "tasks_delete" ON tasks
  FOR DELETE USING (family_id IN (SELECT user_family_ids()));

CREATE TRIGGER tasks_updated_at BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =====================================================
-- 2. TASK_COMMENTS
-- =====================================================
CREATE TABLE task_comments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES profiles(id),
  text text NOT NULL,
  action text CHECK (action IN ('created', 'status_change', 'assigned', 'comment', 'approved', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_task_comments_task ON task_comments(task_id, created_at);

ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "task_comments_read" ON task_comments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM tasks
      WHERE tasks.id = task_comments.task_id
      AND tasks.family_id IN (SELECT user_family_ids())
    )
  );

CREATE POLICY "task_comments_insert" ON task_comments
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM tasks
      WHERE tasks.id = task_comments.task_id
      AND tasks.family_id IN (SELECT user_family_ids())
    )
  );

-- =====================================================
-- 3. UNDERSTANDINGS
-- =====================================================
CREATE TABLE understandings (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id uuid NOT NULL DEFAULT uuid_generate_v4(),
  family_id uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  child_id uuid REFERENCES children(id) ON DELETE SET NULL,
  subject text NOT NULL,
  category text NOT NULL CHECK (category IN ('parenting', 'expenses', 'holidays', 'other')),
  content text NOT NULL,

  proposed_by uuid NOT NULL REFERENCES profiles(id),
  proposed_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'superseded', 'active', 'terminated')),

  version_number int NOT NULL DEFAULT 1,
  replaces_id uuid REFERENCES understandings(id),

  accepted_at timestamptz,
  accepted_by uuid REFERENCES profiles(id),
  rejected_at timestamptz,
  rejected_by uuid REFERENCES profiles(id),
  rejection_reason text,

  valid_from date,
  valid_until date,

  is_temporary boolean NOT NULL DEFAULT false,
  expires_on date,

  expense_rules jsonb,
  attachment_url text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_understandings_family ON understandings(family_id);
CREATE INDEX idx_understandings_family_status_category ON understandings(family_id, status, category);
CREATE INDEX idx_understandings_group ON understandings(group_id, version_number);
CREATE INDEX idx_understandings_validity ON understandings(family_id, child_id, category, valid_from, valid_until);

ALTER TABLE understandings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "understandings_read" ON understandings
  FOR SELECT USING (family_id IN (SELECT user_family_ids()));

CREATE POLICY "understandings_insert" ON understandings
  FOR INSERT WITH CHECK (family_id IN (SELECT user_family_ids()));

CREATE POLICY "understandings_update" ON understandings
  FOR UPDATE USING (family_id IN (SELECT user_family_ids()));

CREATE TRIGGER understandings_updated_at BEFORE UPDATE ON understandings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =====================================================
-- 4. EXPENSES
-- =====================================================
CREATE TABLE expenses (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  family_id uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  child_id uuid REFERENCES children(id) ON DELETE SET NULL,
  understanding_id uuid REFERENCES understandings(id),

  title text NOT NULL,
  description text,
  amount decimal NOT NULL CHECK (amount >= 0),
  category text NOT NULL CHECK (category IN ('education', 'activities', 'healthcare', 'clothing', 'legal', 'food', 'events', 'other')),
  date date NOT NULL,

  payer_id uuid NOT NULL REFERENCES profiles(id),
  status text NOT NULL DEFAULT 'pending_approval' CHECK (status IN ('pending_approval', 'approved', 'rejected', 'counted')),
  requires_approval_reason text CHECK (requires_approval_reason IN ('category_other', 'exceeds_budget', 'no_rule')),
  approved_by uuid REFERENCES profiles(id),
  approved_at timestamptz,

  split_dad_percent int,
  split_mom_percent int,
  split_dad_amount decimal,
  split_mom_amount decimal,

  receipt_url text,

  created_by uuid NOT NULL REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_expenses_family ON expenses(family_id);
CREATE INDEX idx_expenses_family_date ON expenses(family_id, date DESC);
CREATE INDEX idx_expenses_family_child_category ON expenses(family_id, child_id, category, date);
CREATE INDEX idx_expenses_status ON expenses(status, family_id);
CREATE INDEX idx_expenses_understanding ON expenses(understanding_id);

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "expenses_read" ON expenses
  FOR SELECT USING (family_id IN (SELECT user_family_ids()));

CREATE POLICY "expenses_insert" ON expenses
  FOR INSERT WITH CHECK (family_id IN (SELECT user_family_ids()));

CREATE POLICY "expenses_update" ON expenses
  FOR UPDATE USING (family_id IN (SELECT user_family_ids()));

CREATE POLICY "expenses_delete" ON expenses
  FOR DELETE USING (family_id IN (SELECT user_family_ids()));

CREATE TRIGGER expenses_updated_at BEFORE UPDATE ON expenses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =====================================================
-- 5. EXPENSE_BUDGET_CACHE
-- =====================================================
CREATE TABLE expense_budget_cache (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  family_id uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  child_id uuid REFERENCES children(id) ON DELETE CASCADE,
  category text NOT NULL,
  period_type text NOT NULL CHECK (period_type IN ('monthly', 'yearly')),
  period_key text NOT NULL,
  total_amount decimal NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(family_id, child_id, category, period_type, period_key)
);

CREATE INDEX idx_expense_budget_cache_lookup ON expense_budget_cache(family_id, child_id, category, period_type, period_key);

ALTER TABLE expense_budget_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "expense_budget_cache_read" ON expense_budget_cache
  FOR SELECT USING (family_id IN (SELECT user_family_ids()));

-- =====================================================
-- TRIGGER: Update budget cache on expense changes
-- =====================================================
CREATE OR REPLACE FUNCTION update_expense_budget_cache()
RETURNS trigger AS $$
DECLARE
  v_period_key_monthly text;
  v_period_key_yearly text;
BEGIN
  -- Determine period keys
  v_period_key_monthly := TO_CHAR(COALESCE(NEW.date, OLD.date), 'YYYY-MM');
  v_period_key_yearly := TO_CHAR(COALESCE(NEW.date, OLD.date), 'YYYY');

  -- Recalculate monthly total
  INSERT INTO expense_budget_cache (family_id, child_id, category, period_type, period_key, total_amount)
  SELECT
    COALESCE(NEW.family_id, OLD.family_id),
    COALESCE(NEW.child_id, OLD.child_id),
    COALESCE(NEW.category, OLD.category),
    'monthly',
    v_period_key_monthly,
    COALESCE(SUM(amount), 0)
  FROM expenses
  WHERE family_id = COALESCE(NEW.family_id, OLD.family_id)
    AND (child_id = COALESCE(NEW.child_id, OLD.child_id) OR (child_id IS NULL AND COALESCE(NEW.child_id, OLD.child_id) IS NULL))
    AND category = COALESCE(NEW.category, OLD.category)
    AND TO_CHAR(date, 'YYYY-MM') = v_period_key_monthly
    AND status = 'counted'
  ON CONFLICT (family_id, child_id, category, period_type, period_key)
  DO UPDATE SET
    total_amount = EXCLUDED.total_amount,
    updated_at = now();

  -- Recalculate yearly total
  INSERT INTO expense_budget_cache (family_id, child_id, category, period_type, period_key, total_amount)
  SELECT
    COALESCE(NEW.family_id, OLD.family_id),
    COALESCE(NEW.child_id, OLD.child_id),
    COALESCE(NEW.category, OLD.category),
    'yearly',
    v_period_key_yearly,
    COALESCE(SUM(amount), 0)
  FROM expenses
  WHERE family_id = COALESCE(NEW.family_id, OLD.family_id)
    AND (child_id = COALESCE(NEW.child_id, OLD.child_id) OR (child_id IS NULL AND COALESCE(NEW.child_id, OLD.child_id) IS NULL))
    AND category = COALESCE(NEW.category, OLD.category)
    AND TO_CHAR(date, 'YYYY') = v_period_key_yearly
    AND status = 'counted'
  ON CONFLICT (family_id, child_id, category, period_type, period_key)
  DO UPDATE SET
    total_amount = EXCLUDED.total_amount,
    updated_at = now();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER expenses_budget_cache_update
  AFTER INSERT OR UPDATE OR DELETE ON expenses
  FOR EACH ROW EXECUTE FUNCTION update_expense_budget_cache();
