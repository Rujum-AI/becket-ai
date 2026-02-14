-- =====================================================
-- BECKET AI - TRUSTEE EVENT GENERATOR
-- Migration 014: Replace placeholder with real implementation
-- Generates school/activity events from trustee_schedules
-- =====================================================

-- Fix FK constraints: allow deleting trustees without blocking on events
ALTER TABLE events DROP CONSTRAINT IF EXISTS fk_events_school;
ALTER TABLE events ADD CONSTRAINT fk_events_school
  FOREIGN KEY (school_id) REFERENCES trustees_schools(id) ON DELETE SET NULL;

ALTER TABLE events DROP CONSTRAINT IF EXISTS fk_events_activity;
ALTER TABLE events ADD CONSTRAINT fk_events_activity
  FOREIGN KEY (activity_id) REFERENCES trustees_activities(id) ON DELETE SET NULL;

ALTER TABLE events DROP CONSTRAINT IF EXISTS fk_events_person;
ALTER TABLE events ADD CONSTRAINT fk_events_person
  FOREIGN KEY (person_id) REFERENCES trustees_people(id) ON DELETE SET NULL;

-- =====================================================
-- GENERATE TRUSTEE EVENTS
-- Reads trustee_schedules, creates school/activity events
-- Idempotent: won't create duplicates
-- =====================================================
CREATE OR REPLACE FUNCTION generate_trustee_events(
  p_family_id uuid,
  p_from_date date,
  p_to_date date
)
RETURNS int AS $fn$
DECLARE
  v_schedule record;
  v_current_date date;
  v_dow int;
  v_day_data jsonb;
  v_start_time time;
  v_end_time time;
  v_event_id uuid;
  v_events_created int := 0;
  v_custody_parent uuid;
  v_trustee_name text;
  v_event_type text;
  v_school_id uuid;
  v_activity_id uuid;
BEGIN
  -- Loop through all active schedules for this family
  FOR v_schedule IN
    SELECT
      ts.id as schedule_id,
      ts.trustee_type,
      ts.trustee_id,
      ts.child_id,
      ts.days,
      ts.start_date,
      ts.end_date,
      ts.repeat_freq,
      CASE
        WHEN ts.trustee_type = 'school' THEN s.name
        WHEN ts.trustee_type = 'activity' THEN a.name
      END as trustee_name
    FROM trustee_schedules ts
    LEFT JOIN trustees_schools s ON ts.trustee_type = 'school' AND ts.trustee_id = s.id
    LEFT JOIN trustees_activities a ON ts.trustee_type = 'activity' AND ts.trustee_id = a.id
    WHERE (s.family_id = p_family_id OR a.family_id = p_family_id)
      AND ts.start_date <= p_to_date
      AND (ts.end_date IS NULL OR ts.end_date >= p_from_date)
  LOOP
    v_event_type := v_schedule.trustee_type;
    v_trustee_name := v_schedule.trustee_name;

    -- Set location FK based on type
    IF v_schedule.trustee_type = 'school' THEN
      v_school_id := v_schedule.trustee_id;
      v_activity_id := NULL;
    ELSE
      v_school_id := NULL;
      v_activity_id := v_schedule.trustee_id;
    END IF;

    -- Loop through each date in range
    v_current_date := GREATEST(p_from_date, v_schedule.start_date);
    WHILE v_current_date <= LEAST(p_to_date, COALESCE(v_schedule.end_date, p_to_date)) LOOP
      -- day_of_week: 0=Sun, 1=Mon ... 6=Sat
      v_dow := EXTRACT(DOW FROM v_current_date)::int;

      -- Get day config from schedule (days is a JSON array indexed 0-6)
      v_day_data := v_schedule.days->v_dow;

      -- Check if this day is active
      IF v_day_data IS NOT NULL AND (v_day_data->>'active')::boolean = true THEN
        v_start_time := (v_day_data->>'start')::time;
        v_end_time := (v_day_data->>'end')::time;

        -- Skip if times are empty/null
        IF v_start_time IS NOT NULL AND v_end_time IS NOT NULL THEN
          -- Check idempotency: event for this schedule+child+date
          IF NOT EXISTS (
            SELECT 1 FROM events
            WHERE family_id = p_family_id
              AND type = v_event_type
              AND DATE(start_time) = v_current_date
              AND generated_from_type = 'trustee_schedule'
              AND generated_from_id = v_schedule.schedule_id
              AND EXISTS (
                SELECT 1 FROM event_children
                WHERE event_id = events.id
                  AND child_id = v_schedule.child_id
              )
          ) THEN
            -- Get custody parent for expected_by
            v_custody_parent := get_custody_parent_id(p_family_id, v_current_date);

            INSERT INTO events (
              family_id, type, title, start_time, end_time,
              status, expected_by, created_by,
              school_id, activity_id,
              generated_from_type, generated_from_id
            ) VALUES (
              p_family_id,
              v_event_type,
              COALESCE(v_trustee_name, v_event_type),
              (v_current_date + v_start_time)::timestamptz,
              (v_current_date + v_end_time)::timestamptz,
              'scheduled',
              v_custody_parent,
              COALESCE(v_custody_parent, (SELECT profile_id FROM family_members WHERE family_id = p_family_id LIMIT 1)),
              v_school_id,
              v_activity_id,
              'trustee_schedule',
              v_schedule.schedule_id
            ) RETURNING id INTO v_event_id;

            INSERT INTO event_children (event_id, child_id)
            VALUES (v_event_id, v_schedule.child_id);

            v_events_created := v_events_created + 1;
          END IF;
        END IF;
      END IF;

      v_current_date := v_current_date + 1;
    END LOOP;
  END LOOP;

  RETURN v_events_created;
END;
$fn$ LANGUAGE plpgsql SECURITY DEFINER;
