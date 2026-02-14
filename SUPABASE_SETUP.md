# Supabase Setup Guide - Becket AI

## ✅ Steps to Fix Database Issues

### Step 1: Run the Migration SQL

1. Open your Supabase Dashboard
2. Go to **SQL Editor**
3. Click **New Query**
4. Copy the entire contents of `supabase-migration.sql`
5. Paste and click **Run**

This will:
- Add the missing `created_by` column to `expenses` table
- Verify all required columns exist
- Show you the current schema

### Step 2: Verify Tables Exist

Make sure these core tables exist in your database:

#### ✅ Required Tables (for current features):
- [ ] `profiles`
- [ ] `families`
- [ ] `family_members`
- [ ] `children`
- [ ] `expenses`
- [ ] `understandings`
- [ ] `invitations`

#### 📋 Tables Needed Later (for future features):
- `events`
- `event_children`
- `custody_cycles`
- `trustees_schools`
- `trustees_activities`
- `trustees_people`
- `handoffs`
- `tasks`
- `task_comments`
- `snapshots`
- `notifications`
- etc. (see DATA_SCHEMA.md for complete list)

### Step 3: Create Missing Tables (if needed)

If any core tables are missing, here's the SQL to create them:

```sql
-- Profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS profiles (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email text,
    display_name text,
    avatar_url text,
    lang text DEFAULT 'en',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Families table
CREATE TABLE IF NOT EXISTS families (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    mode text NOT NULL,
    home_count int NOT NULL,
    relationship_status text,
    agreement_basis text,
    plan text DEFAULT 'essential',
    currency text DEFAULT 'NIS',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Family members table
CREATE TABLE IF NOT EXISTS family_members (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id uuid REFERENCES families(id) ON DELETE CASCADE,
    profile_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
    parent_label text NOT NULL,
    role text DEFAULT 'parent',
    joined_at timestamptz DEFAULT now(),
    UNIQUE(family_id, profile_id)
);

-- Children table
CREATE TABLE IF NOT EXISTS children (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id uuid REFERENCES families(id) ON DELETE CASCADE,
    name text NOT NULL,
    gender text,
    date_of_birth date,
    medical_notes text,
    avatar_url text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Invitations table
CREATE TABLE IF NOT EXISTS invitations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id uuid REFERENCES families(id) ON DELETE CASCADE,
    email text NOT NULL,
    token text UNIQUE,
    status text DEFAULT 'pending',
    expires_at timestamptz,
    created_at timestamptz DEFAULT now()
);

-- Understandings table
CREATE TABLE IF NOT EXISTS understandings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id uuid NOT NULL,
    family_id uuid REFERENCES families(id) ON DELETE CASCADE,
    child_id uuid REFERENCES children(id) ON DELETE SET NULL,
    subject text NOT NULL,
    category text NOT NULL,
    content text NOT NULL,
    proposed_by uuid REFERENCES profiles(id),
    proposed_at timestamptz NOT NULL,
    status text DEFAULT 'pending',
    version_number int DEFAULT 1,
    replaces_id uuid REFERENCES understandings(id),
    accepted_at timestamptz,
    accepted_by uuid REFERENCES profiles(id),
    rejected_at timestamptz,
    rejected_by uuid REFERENCES profiles(id),
    rejection_reason text,
    valid_from date,
    valid_until date,
    is_temporary boolean DEFAULT false,
    expires_on date,
    expense_rules jsonb,
    attachment_url text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Expenses table (complete with all required columns)
CREATE TABLE IF NOT EXISTS expenses (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id uuid REFERENCES families(id) ON DELETE CASCADE NOT NULL,
    child_id uuid REFERENCES children(id) ON DELETE SET NULL,
    understanding_id uuid REFERENCES understandings(id),
    title text NOT NULL,
    description text,
    amount decimal NOT NULL,
    category text NOT NULL,
    date date NOT NULL,
    payer_id uuid REFERENCES profiles(id),
    status text DEFAULT 'counted',
    requires_approval_reason text,
    approved_by uuid REFERENCES profiles(id),
    approved_at timestamptz,
    split_dad_percent int,
    split_mom_percent int,
    split_dad_amount decimal,
    split_mom_amount decimal,
    receipt_url text,
    created_by uuid REFERENCES profiles(id) NOT NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Expense budget cache table (optional - for budget tracking optimization)
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

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_expenses_family_date ON expenses(family_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_status ON expenses(status, family_id);
CREATE INDEX IF NOT EXISTS idx_children_family ON children(family_id);
CREATE INDEX IF NOT EXISTS idx_family_members_profile ON family_members(profile_id);
CREATE INDEX IF NOT EXISTS idx_budget_cache_lookup ON expense_budget_cache(family_id, child_id, category, period_type, period_key);
```

### Step 4: Enable Row Level Security (RLS)

Run this SQL to enable RLS and create basic policies:

```sql
-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE families ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE children ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE understandings ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

-- Helper function for family access
CREATE OR REPLACE FUNCTION user_family_ids()
RETURNS SETOF uuid AS $$
  SELECT family_id FROM family_members
  WHERE profile_id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Profiles: users can only read/update their own
CREATE POLICY "users_read_own_profile" ON profiles
  FOR SELECT USING (id = auth.uid());

CREATE POLICY "users_update_own_profile" ON profiles
  FOR UPDATE USING (id = auth.uid());

-- Families: users can read if they're a member
CREATE POLICY "family_read" ON families
  FOR SELECT USING (id IN (SELECT user_family_ids()));

-- Family members: users can read if in the family
CREATE POLICY "family_members_read" ON family_members
  FOR SELECT USING (family_id IN (SELECT user_family_ids()));

CREATE POLICY "family_members_insert" ON family_members
  FOR INSERT WITH CHECK (family_id IN (SELECT user_family_ids()));

-- Children: family-scoped access
CREATE POLICY "children_read" ON children
  FOR SELECT USING (family_id IN (SELECT user_family_ids()));

CREATE POLICY "children_insert" ON children
  FOR INSERT WITH CHECK (family_id IN (SELECT user_family_ids()));

CREATE POLICY "children_update" ON children
  FOR UPDATE USING (family_id IN (SELECT user_family_ids()));

-- Expenses: family-scoped access
CREATE POLICY "expenses_read" ON expenses
  FOR SELECT USING (family_id IN (SELECT user_family_ids()));

CREATE POLICY "expenses_insert" ON expenses
  FOR INSERT WITH CHECK (family_id IN (SELECT user_family_ids()));

CREATE POLICY "expenses_update" ON expenses
  FOR UPDATE USING (family_id IN (SELECT user_family_ids()));

CREATE POLICY "expenses_delete" ON expenses
  FOR DELETE USING (family_id IN (SELECT user_family_ids()));

-- Understandings: family-scoped access
CREATE POLICY "understandings_read" ON understandings
  FOR SELECT USING (family_id IN (SELECT user_family_ids()));

CREATE POLICY "understandings_insert" ON understandings
  FOR INSERT WITH CHECK (family_id IN (SELECT user_family_ids()));

CREATE POLICY "understandings_update" ON understandings
  FOR UPDATE USING (family_id IN (SELECT user_family_ids()));

-- Invitations: family-scoped access
CREATE POLICY "invitations_read" ON invitations
  FOR SELECT USING (family_id IN (SELECT user_family_ids()));

CREATE POLICY "invitations_insert" ON invitations
  FOR INSERT WITH CHECK (family_id IN (SELECT user_family_ids()));

-- Expense budget cache: family-scoped access (auto-updated by triggers)
CREATE POLICY "budget_cache_read" ON expense_budget_cache
  FOR SELECT USING (family_id IN (SELECT user_family_ids()));

CREATE POLICY "budget_cache_insert" ON expense_budget_cache
  FOR INSERT WITH CHECK (family_id IN (SELECT user_family_ids()));

CREATE POLICY "budget_cache_update" ON expense_budget_cache
  FOR UPDATE USING (family_id IN (SELECT user_family_ids()));

CREATE POLICY "budget_cache_delete" ON expense_budget_cache
  FOR DELETE USING (family_id IN (SELECT user_family_ids()));
```

### Step 4.5: Database Triggers

Run this SQL to create essential triggers:

```sql
-- Trigger to auto-create profile when user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on auth.users table
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to auto-update updated_at timestamps
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to tables
DROP TRIGGER IF EXISTS set_updated_at ON profiles;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON families;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON families
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON children;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON children
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON expenses;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON expenses
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON understandings;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON understandings
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
```

### Step 5: Test the Setup

1. Refresh your app
2. Try adding an expense
3. Check Supabase → Table Editor → expenses
4. You should see the new expense with all fields filled

## 🔍 Troubleshooting

### If you still get errors:

1. **Check browser console** (F12) for the exact error message
2. **Check Supabase logs**:
   - Go to Supabase Dashboard
   - Click "Logs" in sidebar
   - Filter by "Postgres Logs"
   - Look for errors

3. **Verify table structure**:
   ```sql
   SELECT column_name, data_type, is_nullable
   FROM information_schema.columns
   WHERE table_name = 'expenses'
   ORDER BY ordinal_position;
   ```

4. **Check RLS policies**:
   ```sql
   SELECT schemaname, tablename, policyname
   FROM pg_policies
   WHERE tablename IN ('expenses', 'children', 'families');
   ```

## 📝 Next Steps

After the database is set up:
1. Test adding expenses ✅
2. Test child filtering in finance page ✅
3. Test expense rules setup panel ✅
4. Implement other features (dashboard, management, etc.)

## 🚀 Complete Schema

For the full schema including all 25 tables, see `DATA_SCHEMA.md`.

For now, the 7 core tables above are enough to get finance features working!
