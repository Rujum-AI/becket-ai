-- =====================================================
-- BECKET AI - CORE TABLES
-- Migration 001: Profiles, Families, Children, Invitations
-- =====================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. PROFILES
-- =====================================================
CREATE TABLE profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  display_name text,
  avatar_url text,
  lang text NOT NULL DEFAULT 'he' CHECK (lang IN ('en', 'he')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS Policies for profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Trigger to auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO profiles (id, email, display_name)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- =====================================================
-- 2. FAMILIES
-- =====================================================
CREATE TABLE families (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  mode text NOT NULL CHECK (mode IN ('solo', 'co-parent')),
  home_count int NOT NULL DEFAULT 1 CHECK (home_count IN (1, 2)),
  relationship_status text CHECK (relationship_status IN ('together', 'apart', 'separated')),
  agreement_basis text CHECK (agreement_basis IN ('formal', 'verbal', 'building')),
  plan text NOT NULL DEFAULT 'essential' CHECK (plan IN ('essential', 'ai-assistant', 'ai-mediator', 'full')),
  currency text NOT NULL DEFAULT 'NIS' CHECK (currency IN ('NIS', 'USD', 'SGD', 'EUR')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- =====================================================
-- 3. FAMILY_MEMBERS
-- =====================================================
CREATE TABLE family_members (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  family_id uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  parent_label text NOT NULL,
  role text NOT NULL DEFAULT 'parent' CHECK (role IN ('admin', 'parent')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(family_id, profile_id)
);

CREATE INDEX idx_family_members_family ON family_members(family_id);
CREATE INDEX idx_family_members_profile ON family_members(profile_id);

-- =====================================================
-- 4. INVITATIONS
-- =====================================================
CREATE TABLE invitations (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  family_id uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  email text NOT NULL,
  token text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired')),
  expires_at timestamptz NOT NULL DEFAULT (now() + INTERVAL '7 days'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_invitations_token ON invitations(token);
CREATE INDEX idx_invitations_family ON invitations(family_id);

-- =====================================================
-- 5. CHILDREN
-- =====================================================
CREATE TABLE children (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  family_id uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  name text NOT NULL,
  gender text NOT NULL CHECK (gender IN ('boy', 'girl')),
  date_of_birth date NOT NULL,
  medical_notes text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_children_family ON children(family_id);

-- =====================================================
-- HELPER FUNCTION: Get user's family IDs
-- =====================================================
CREATE OR REPLACE FUNCTION user_family_ids()
RETURNS SETOF uuid AS $$
  SELECT family_id FROM family_members
  WHERE profile_id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- =====================================================
-- RLS POLICIES FOR FAMILY-SCOPED TABLES
-- =====================================================

-- FAMILIES
ALTER TABLE families ENABLE ROW LEVEL SECURITY;

CREATE POLICY "family_read" ON families
  FOR SELECT USING (id IN (SELECT user_family_ids()));

CREATE POLICY "family_insert" ON families
  FOR INSERT WITH CHECK (true); -- Anyone can create a family

CREATE POLICY "family_update" ON families
  FOR UPDATE USING (id IN (SELECT user_family_ids()));

CREATE POLICY "family_delete" ON families
  FOR DELETE USING (id IN (SELECT user_family_ids()));

-- FAMILY_MEMBERS
ALTER TABLE family_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "family_members_read" ON family_members
  FOR SELECT USING (family_id IN (SELECT user_family_ids()));

CREATE POLICY "family_members_insert" ON family_members
  FOR INSERT WITH CHECK (family_id IN (SELECT user_family_ids()));

CREATE POLICY "family_members_delete" ON family_members
  FOR DELETE USING (family_id IN (SELECT user_family_ids()));

-- INVITATIONS
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invitations_read" ON invitations
  FOR SELECT USING (family_id IN (SELECT user_family_ids()) OR email = auth.email());

CREATE POLICY "invitations_insert" ON invitations
  FOR INSERT WITH CHECK (family_id IN (SELECT user_family_ids()));

CREATE POLICY "invitations_update" ON invitations
  FOR UPDATE USING (email = auth.email() OR family_id IN (SELECT user_family_ids()));

-- CHILDREN
ALTER TABLE children ENABLE ROW LEVEL SECURITY;

CREATE POLICY "children_read" ON children
  FOR SELECT USING (family_id IN (SELECT user_family_ids()));

CREATE POLICY "children_insert" ON children
  FOR INSERT WITH CHECK (family_id IN (SELECT user_family_ids()));

CREATE POLICY "children_update" ON children
  FOR UPDATE USING (family_id IN (SELECT user_family_ids()));

CREATE POLICY "children_delete" ON children
  FOR DELETE USING (family_id IN (SELECT user_family_ids()));

-- =====================================================
-- AUTO-UPDATE TIMESTAMPS
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER families_updated_at BEFORE UPDATE ON families
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER children_updated_at BEFORE UPDATE ON children
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
