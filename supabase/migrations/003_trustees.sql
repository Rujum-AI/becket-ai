-- =====================================================
-- BECKET AI - TRUSTEES SYSTEM
-- Migration 003: Schools, Activities, People, Schedules
-- =====================================================

-- =====================================================
-- 1. TRUSTEES_SCHOOLS
-- =====================================================
CREATE TABLE trustees_schools (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  family_id uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  name text NOT NULL,
  address text,
  contact_phone text,
  default_items jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_trustees_schools_family ON trustees_schools(family_id);

ALTER TABLE trustees_schools ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trustees_schools_read" ON trustees_schools
  FOR SELECT USING (family_id IN (SELECT user_family_ids()));

CREATE POLICY "trustees_schools_insert" ON trustees_schools
  FOR INSERT WITH CHECK (family_id IN (SELECT user_family_ids()));

CREATE POLICY "trustees_schools_update" ON trustees_schools
  FOR UPDATE USING (family_id IN (SELECT user_family_ids()));

CREATE POLICY "trustees_schools_delete" ON trustees_schools
  FOR DELETE USING (family_id IN (SELECT user_family_ids()));

CREATE TRIGGER trustees_schools_updated_at BEFORE UPDATE ON trustees_schools
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =====================================================
-- 2. TRUSTEES_ACTIVITIES
-- =====================================================
CREATE TABLE trustees_activities (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  family_id uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  name text NOT NULL,
  address text,
  contact_phone text,
  default_items jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_trustees_activities_family ON trustees_activities(family_id);

ALTER TABLE trustees_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trustees_activities_read" ON trustees_activities
  FOR SELECT USING (family_id IN (SELECT user_family_ids()));

CREATE POLICY "trustees_activities_insert" ON trustees_activities
  FOR INSERT WITH CHECK (family_id IN (SELECT user_family_ids()));

CREATE POLICY "trustees_activities_update" ON trustees_activities
  FOR UPDATE USING (family_id IN (SELECT user_family_ids()));

CREATE POLICY "trustees_activities_delete" ON trustees_activities
  FOR DELETE USING (family_id IN (SELECT user_family_ids()));

CREATE TRIGGER trustees_activities_updated_at BEFORE UPDATE ON trustees_activities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =====================================================
-- 3. TRUSTEES_PEOPLE
-- =====================================================
CREATE TABLE trustees_people (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  family_id uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  name text NOT NULL,
  relationship text NOT NULL,
  contact_phone text,
  address text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_trustees_people_family ON trustees_people(family_id);

ALTER TABLE trustees_people ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trustees_people_read" ON trustees_people
  FOR SELECT USING (family_id IN (SELECT user_family_ids()));

CREATE POLICY "trustees_people_insert" ON trustees_people
  FOR INSERT WITH CHECK (family_id IN (SELECT user_family_ids()));

CREATE POLICY "trustees_people_update" ON trustees_people
  FOR UPDATE USING (family_id IN (SELECT user_family_ids()));

CREATE POLICY "trustees_people_delete" ON trustees_people
  FOR DELETE USING (family_id IN (SELECT user_family_ids()));

CREATE TRIGGER trustees_people_updated_at BEFORE UPDATE ON trustees_people
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =====================================================
-- 4. TRUSTEE_CHILDREN (Junction table)
-- =====================================================
CREATE TABLE trustee_children (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  trustee_type text NOT NULL CHECK (trustee_type IN ('school', 'activity', 'person')),
  trustee_id uuid NOT NULL,
  child_id uuid NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  UNIQUE(trustee_type, trustee_id, child_id)
);

CREATE INDEX idx_trustee_children_child ON trustee_children(child_id);
CREATE INDEX idx_trustee_children_trustee ON trustee_children(trustee_type, trustee_id);

ALTER TABLE trustee_children ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trustee_children_read" ON trustee_children
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM children
      WHERE children.id = trustee_children.child_id
      AND children.family_id IN (SELECT user_family_ids())
    )
  );

CREATE POLICY "trustee_children_insert" ON trustee_children
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM children
      WHERE children.id = trustee_children.child_id
      AND children.family_id IN (SELECT user_family_ids())
    )
  );

CREATE POLICY "trustee_children_delete" ON trustee_children
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM children
      WHERE children.id = trustee_children.child_id
      AND children.family_id IN (SELECT user_family_ids())
    )
  );

-- =====================================================
-- 5. TRUSTEE_SCHEDULES
-- =====================================================
CREATE TABLE trustee_schedules (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  trustee_type text NOT NULL CHECK (trustee_type IN ('school', 'activity')),
  trustee_id uuid NOT NULL,
  child_id uuid NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  days jsonb NOT NULL,
  start_date date NOT NULL,
  end_date date,
  repeat_freq int NOT NULL DEFAULT 1,
  generated_until date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_trustee_schedules_trustee ON trustee_schedules(trustee_type, trustee_id);
CREATE INDEX idx_trustee_schedules_child ON trustee_schedules(child_id);

ALTER TABLE trustee_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trustee_schedules_read" ON trustee_schedules
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM children
      WHERE children.id = trustee_schedules.child_id
      AND children.family_id IN (SELECT user_family_ids())
    )
  );

CREATE POLICY "trustee_schedules_insert" ON trustee_schedules
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM children
      WHERE children.id = trustee_schedules.child_id
      AND children.family_id IN (SELECT user_family_ids())
    )
  );

CREATE POLICY "trustee_schedules_update" ON trustee_schedules
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM children
      WHERE children.id = trustee_schedules.child_id
      AND children.family_id IN (SELECT user_family_ids())
    )
  );

CREATE POLICY "trustee_schedules_delete" ON trustee_schedules
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM children
      WHERE children.id = trustee_schedules.child_id
      AND children.family_id IN (SELECT user_family_ids())
    )
  );

CREATE TRIGGER trustee_schedules_updated_at BEFORE UPDATE ON trustee_schedules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =====================================================
-- Fix foreign key for events table (from migration 002)
-- We need to add the FK constraints now that trustee tables exist
-- =====================================================

ALTER TABLE events
  ADD CONSTRAINT fk_events_school
  FOREIGN KEY (school_id) REFERENCES trustees_schools(id);

ALTER TABLE events
  ADD CONSTRAINT fk_events_activity
  FOREIGN KEY (activity_id) REFERENCES trustees_activities(id);

ALTER TABLE events
  ADD CONSTRAINT fk_events_person
  FOREIGN KEY (person_id) REFERENCES trustees_people(id);
