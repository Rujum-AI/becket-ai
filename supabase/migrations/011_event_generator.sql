-- =====================================================
-- BECKET AI - EVENT GENERATOR
-- Migration 011: Auto-generate scheduled events
-- Creates pickup/dropoff events from custody cycles
-- Creates school/activity events from trustee schedules
-- =====================================================

-- =====================================================
-- 0. ADD 'custody_cycle' to events.generated_from_type check constraint
-- =====================================================
ALTER TABLE events DROP CONSTRAINT IF EXISTS events_generated_from_type_check;
ALTER TABLE events ADD CONSTRAINT events_generated_from_type_check
  CHECK (generated_from_type IN ('trustee_schedule', 'manual', 'ask_approved', 'custody_cycle'));

-- =====================================================
-- 1. HELPER: Get custody parent ID for a specific date
-- Returns the profile_id of the parent who has custody on that date
-- Returns NULL if no custody cycle defined
-- =====================================================
CREATE OR REPLACE FUNCTION get_custody_parent_id(
  p_family_id uuid,
  p_date date
)
RETURNS uuid AS $$
DECLARE
  v_cycle_id uuid;
  v_cycle_length int;
  v_cycle_data jsonb;
  v_valid_from date;
  v_days_since_start int;
  v_cycle_day int;
  v_parent_label text;
BEGIN
  -- Get active custody cycle
  SELECT id, cycle_length, cycle_data, valid_from
  INTO v_cycle_id, v_cycle_length, v_cycle_data, v_valid_from
  FROM custody_cycles
  WHERE family_id = p_family_id
    AND valid_from <= p_date
    AND (valid_until IS NULL OR valid_until >= p_date)
  ORDER BY valid_from DESC
  LIMIT 1;

  -- No cycle defined
  IF v_cycle_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Calculate which day in the cycle this date falls on
  v_days_since_start := p_date - v_valid_from;
  v_cycle_day := MOD(v_days_since_start, v_cycle_length);

  -- Get parent_label for this cycle day (cycle_data is a JSON ARRAY)
  v_parent_label := v_cycle_data->v_cycle_day->>'parent_label';

  -- Convert parent_label to profile_id
  RETURN (
    SELECT profile_id
    FROM family_members
    WHERE family_id = p_family_id
      AND parent_label = v_parent_label
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- =====================================================
-- 2. GENERATE CUSTODY EVENTS
-- Creates pickup/dropoff events when custody parent changes
-- Idempotent: won't create duplicates
-- =====================================================
CREATE OR REPLACE FUNCTION generate_custody_events(
  p_family_id uuid,
  p_from_date date,
  p_to_date date
)
RETURNS int AS $$
DECLARE
  v_current_date date;
  v_today_parent uuid;
  v_tomorrow_parent uuid;
  v_cycle_id uuid;
  v_event_id uuid;
  v_events_created int := 0;
  v_dropoff_time time := '18:00:00';
  v_pickup_time time := '08:00:00';
  v_child_record record;
BEGIN
  -- Get active custody cycle ID
  SELECT id INTO v_cycle_id
  FROM custody_cycles
  WHERE family_id = p_family_id
    AND valid_from <= p_from_date
    AND (valid_until IS NULL OR valid_until >= p_from_date)
  ORDER BY valid_from DESC
  LIMIT 1;

  -- No custody cycle = no events to generate
  IF v_cycle_id IS NULL THEN
    RETURN 0;
  END IF;

  -- Loop through each date in range
  v_current_date := p_from_date;
  WHILE v_current_date < p_to_date LOOP
    -- Get custody parent for today and tomorrow
    v_today_parent := get_custody_parent_id(p_family_id, v_current_date);
    v_tomorrow_parent := get_custody_parent_id(p_family_id, v_current_date + 1);

    -- If custody parent changes between today and tomorrow
    IF v_today_parent IS NOT NULL
       AND v_tomorrow_parent IS NOT NULL
       AND v_today_parent != v_tomorrow_parent THEN

      -- Create dropoff event (end of today)
      -- For each child in the family
      FOR v_child_record IN
        SELECT id FROM children WHERE family_id = p_family_id
      LOOP
        -- Check if dropoff event already exists
        IF NOT EXISTS (
          SELECT 1 FROM events
          WHERE family_id = p_family_id
            AND type = 'dropoff'
            AND DATE(start_time) = v_current_date
            AND generated_from_type = 'custody_cycle'
            AND EXISTS (
              SELECT 1 FROM event_children
              WHERE event_id = events.id
                AND child_id = v_child_record.id
            )
        ) THEN
          -- Create dropoff event
          INSERT INTO events (
            family_id,
            type,
            title,
            start_time,
            end_time,
            status,
            expected_by,
            created_by,
            generated_from_type,
            generated_from_id
          ) VALUES (
            p_family_id,
            'dropoff',
            'Custody Handoff - Dropoff',
            (v_current_date + v_dropoff_time)::timestamptz,
            (v_current_date + v_dropoff_time + interval '15 minutes')::timestamptz,
            'scheduled',
            v_today_parent,
            v_today_parent,
            'custody_cycle',
            v_cycle_id
          ) RETURNING id INTO v_event_id;

          -- Link child to event
          INSERT INTO event_children (event_id, child_id)
          VALUES (v_event_id, v_child_record.id);

          v_events_created := v_events_created + 1;
        END IF;

        -- Check if pickup event already exists
        IF NOT EXISTS (
          SELECT 1 FROM events
          WHERE family_id = p_family_id
            AND type = 'pickup'
            AND DATE(start_time) = v_current_date + 1
            AND generated_from_type = 'custody_cycle'
            AND EXISTS (
              SELECT 1 FROM event_children
              WHERE event_id = events.id
                AND child_id = v_child_record.id
            )
        ) THEN
          -- Create pickup event (morning of tomorrow)
          INSERT INTO events (
            family_id,
            type,
            title,
            start_time,
            end_time,
            status,
            expected_by,
            created_by,
            generated_from_type,
            generated_from_id
          ) VALUES (
            p_family_id,
            'pickup',
            'Custody Handoff - Pickup',
            ((v_current_date + 1) + v_pickup_time)::timestamptz,
            ((v_current_date + 1) + v_pickup_time + interval '15 minutes')::timestamptz,
            'scheduled',
            v_tomorrow_parent,
            v_tomorrow_parent,
            'custody_cycle',
            v_cycle_id
          ) RETURNING id INTO v_event_id;

          -- Link child to event
          INSERT INTO event_children (event_id, child_id)
          VALUES (v_event_id, v_child_record.id);

          v_events_created := v_events_created + 1;
        END IF;
      END LOOP;
    END IF;

    v_current_date := v_current_date + 1;
  END LOOP;

  RETURN v_events_created;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 3. GENERATE TRUSTEE EVENTS (PLACEHOLDER)
-- TODO: Implement when trustees/schools/activities tables are created
-- For now, returns 0 (no events generated)
-- =====================================================
CREATE OR REPLACE FUNCTION generate_trustee_events(
  p_family_id uuid,
  p_from_date date,
  p_to_date date
)
RETURNS int AS $$
BEGIN
  -- Placeholder: trustees table doesn't exist yet
  -- Will be implemented in future migration
  RETURN 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 4. GENERATE RECURRING EVENTS (WRAPPER)
-- Generates all events for all families
-- Default: 3 months ahead
-- Run this daily via cron at 2am
-- =====================================================
CREATE OR REPLACE FUNCTION generate_recurring_events(
  p_months_ahead int DEFAULT 3
)
RETURNS TABLE(
  family_id uuid,
  custody_events_created int,
  trustee_events_created int,
  total_events int
) AS $$
DECLARE
  v_family_record record;
  v_from_date date := CURRENT_DATE;
  v_to_date date := CURRENT_DATE + (p_months_ahead || ' months')::interval;
  v_custody_count int;
  v_trustee_count int;
BEGIN
  -- Loop through all families
  FOR v_family_record IN
    SELECT id FROM families
  LOOP
    -- Generate custody events
    v_custody_count := generate_custody_events(
      v_family_record.id,
      v_from_date,
      v_to_date
    );

    -- Generate trustee events
    v_trustee_count := generate_trustee_events(
      v_family_record.id,
      v_from_date,
      v_to_date
    );

    -- Return results
    family_id := v_family_record.id;
    custody_events_created := v_custody_count;
    trustee_events_created := v_trustee_count;
    total_events := v_custody_count + v_trustee_count;
    RETURN NEXT;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 5. VERIFICATION
-- =====================================================

-- Test: Generate 1 month of events for all families
-- SELECT * FROM generate_recurring_events(1);

-- Check generated custody events
-- SELECT
--   type,
--   title,
--   DATE(start_time) as event_date,
--   TO_CHAR(start_time, 'HH24:MI') as time,
--   expected_by,
--   generated_from_type,
--   status
-- FROM events
-- WHERE generated_from_type = 'custody_cycle'
-- ORDER BY start_time
-- LIMIT 20;

-- Check how many children are linked to each event
-- SELECT e.id, e.title, e.start_time, COUNT(ec.child_id) as num_children
-- FROM events e
-- LEFT JOIN event_children ec ON ec.event_id = e.id
-- WHERE e.generated_from_type = 'custody_cycle'
-- GROUP BY e.id, e.title, e.start_time
-- ORDER BY e.start_time
-- LIMIT 20;
