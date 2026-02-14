-- =====================================================
-- BECKET AI - CUSTODY & EVENTS
-- Migration 002: Custody Cycles, Events, Event Children
-- =====================================================

-- =====================================================
-- 1. CUSTODY_CYCLES
-- =====================================================
CREATE TABLE custody_cycles (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  family_id uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  cycle_length int NOT NULL CHECK (cycle_length IN (7, 14)),
  cycle_data jsonb NOT NULL,
  valid_from date NOT NULL,
  valid_until date,
  version_number int NOT NULL DEFAULT 1,
  replaces_cycle_id uuid REFERENCES custody_cycles(id),
  created_by uuid NOT NULL REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_custody_cycles_family ON custody_cycles(family_id);
CREATE INDEX idx_custody_cycles_validity ON custody_cycles(family_id, valid_from, valid_until);
CREATE INDEX idx_custody_cycles_replaces ON custody_cycles(replaces_cycle_id);

-- RLS
ALTER TABLE custody_cycles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "custody_cycles_read" ON custody_cycles
  FOR SELECT USING (family_id IN (SELECT user_family_ids()));

CREATE POLICY "custody_cycles_insert" ON custody_cycles
  FOR INSERT WITH CHECK (family_id IN (SELECT user_family_ids()));

CREATE POLICY "custody_cycles_update" ON custody_cycles
  FOR UPDATE USING (family_id IN (SELECT user_family_ids()));

-- =====================================================
-- 2. EVENTS
-- =====================================================
CREATE TABLE events (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  family_id uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('pickup', 'dropoff', 'school', 'activity', 'friend_visit', 'appointment', 'manual')),
  title text NOT NULL,
  description text,
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  all_day boolean NOT NULL DEFAULT false,

  -- Location (polymorphic - only ONE should be set)
  -- FK constraints added in migration 003 after trustee tables exist
  school_id uuid,
  activity_id uuid,
  person_id uuid,
  parent_id uuid REFERENCES profiles(id),
  location_name text,

  -- Status & confirmation
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'confirmed', 'pending_approval', 'missed', 'cancelled')),
  expected_by uuid REFERENCES profiles(id),
  confirmed_at timestamptz,
  confirmed_by uuid REFERENCES profiles(id),
  scheduled_time timestamptz,
  actual_time timestamptz,

  -- Generation metadata
  generated_from_type text CHECK (generated_from_type IN ('trustee_schedule', 'manual', 'ask_approved')),
  generated_from_id uuid,
  recurrence_rule text,
  recurrence_exception boolean NOT NULL DEFAULT false,
  parent_event_id uuid REFERENCES events(id),

  created_by uuid NOT NULL REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- Ensure only one location type is set
  CONSTRAINT check_single_location CHECK (
    (school_id IS NOT NULL)::int +
    (activity_id IS NOT NULL)::int +
    (person_id IS NOT NULL)::int +
    (parent_id IS NOT NULL)::int +
    (location_name IS NOT NULL)::int <= 1
  )
);

CREATE INDEX idx_events_family ON events(family_id);
CREATE INDEX idx_events_family_time ON events(family_id, start_time, end_time);
CREATE INDEX idx_events_family_type_status ON events(family_id, type, status);
CREATE INDEX idx_events_status_expected ON events(status, expected_by);
CREATE INDEX idx_events_parent ON events(parent_event_id);
CREATE INDEX idx_events_generated_from ON events(generated_from_type, generated_from_id);

-- RLS
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "events_read" ON events
  FOR SELECT USING (family_id IN (SELECT user_family_ids()));

CREATE POLICY "events_insert" ON events
  FOR INSERT WITH CHECK (family_id IN (SELECT user_family_ids()));

CREATE POLICY "events_update" ON events
  FOR UPDATE USING (family_id IN (SELECT user_family_ids()));

CREATE POLICY "events_delete" ON events
  FOR DELETE USING (family_id IN (SELECT user_family_ids()));

-- Auto-update timestamp
CREATE TRIGGER events_updated_at BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =====================================================
-- 3. EVENT_CHILDREN (Junction table)
-- =====================================================
CREATE TABLE event_children (
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  child_id uuid NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  PRIMARY KEY (event_id, child_id)
);

CREATE INDEX idx_event_children_child ON event_children(child_id, event_id);

-- RLS (inherits from events)
ALTER TABLE event_children ENABLE ROW LEVEL SECURITY;

CREATE POLICY "event_children_read" ON event_children
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = event_children.event_id
      AND events.family_id IN (SELECT user_family_ids())
    )
  );

CREATE POLICY "event_children_insert" ON event_children
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = event_children.event_id
      AND events.family_id IN (SELECT user_family_ids())
    )
  );

CREATE POLICY "event_children_delete" ON event_children
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = event_children.event_id
      AND events.family_id IN (SELECT user_family_ids())
    )
  );

-- =====================================================
-- FUNCTION: Get custody parent for a date
-- =====================================================
CREATE OR REPLACE FUNCTION get_custody_parent(
  p_family_id uuid,
  p_date date
)
RETURNS text AS $$
DECLARE
  v_cycle record;
  v_day_in_cycle int;
  v_parent_label text;
BEGIN
  -- Find active custody cycle
  SELECT * INTO v_cycle
  FROM custody_cycles
  WHERE family_id = p_family_id
    AND valid_from <= p_date
    AND (valid_until >= p_date OR valid_until IS NULL)
  ORDER BY valid_from DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Calculate day in cycle
  v_day_in_cycle := MOD(p_date - v_cycle.valid_from, v_cycle.cycle_length);

  -- Extract parent from cycle_data
  SELECT (cycle_data->v_day_in_cycle->>'parent_label')::text INTO v_parent_label;

  RETURN v_parent_label;
END;
$$ LANGUAGE plpgsql STABLE;
