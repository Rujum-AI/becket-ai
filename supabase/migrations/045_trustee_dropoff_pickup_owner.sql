-- =====================================================
-- BECKET AI - TRUSTEE DROP-OFF / PICKUP OWNER CONFIG
-- Migration 045: Per-schedule rule for who drops off / picks up
-- =====================================================
--
-- Wave 1 (044) hard-coded the school rule: dropoff = previous-night's
-- parent, pickup = current-day parent. That's the right *default* but
-- not universal — some families want the current-day parent to do both
-- (e.g. early-morning daycare where the receiving parent picks up at
-- start of day). The setup screen should expose this choice.
--
-- This migration:
--   1. Adds dropoff_owner / pickup_owner to trustee_schedules
--      ('prev_day' | 'current_day'), defaulted to the school norm
--   2. Rewrites generate_trustee_events to read the per-schedule rule
--      instead of hard-coding it
--   3. Backfills existing rows with the school-norm defaults

-- =====================================================
-- 1. ADD COLUMNS
-- =====================================================
ALTER TABLE trustee_schedules
  ADD COLUMN IF NOT EXISTS dropoff_owner text
    CHECK (dropoff_owner IN ('prev_day', 'current_day')),
  ADD COLUMN IF NOT EXISTS pickup_owner text
    CHECK (pickup_owner IN ('prev_day', 'current_day'));

-- Defaults match the school norm: sleep-with parent drops off, current
-- day's parent picks up. Apply to existing rows so the generator's
-- next run keeps producing the same events as Wave 1.
UPDATE trustee_schedules
SET dropoff_owner = 'prev_day'
WHERE dropoff_owner IS NULL AND trustee_type = 'school';

UPDATE trustee_schedules
SET pickup_owner = 'current_day'
WHERE pickup_owner IS NULL AND trustee_type = 'school';

-- Activities default both to current_day — the parent on the day takes
-- the child to / from the activity. Generator still ignores these for
-- non-school types, but the defaults keep the data shape sane.
UPDATE trustee_schedules
SET dropoff_owner = 'current_day', pickup_owner = 'current_day'
WHERE (dropoff_owner IS NULL OR pickup_owner IS NULL)
  AND trustee_type = 'activity';

-- =====================================================
-- 2. REWRITE generate_trustee_events
-- For school: dropoff_by / pickup_by come from the schedule's
-- dropoff_owner / pickup_owner config. NULL config falls back to the
-- school norm (prev_day / current_day) so a row missing the value
-- still produces correct events.
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
  v_dropoff_by uuid;
  v_pickup_by uuid;
  v_trustee_name text;
  v_event_type text;
  v_school_id uuid;
  v_activity_id uuid;
  v_family_tz text;
  v_dropoff_rule text;
  v_pickup_rule text;
BEGIN
  SELECT COALESCE(timezone, 'Asia/Jerusalem') INTO v_family_tz FROM families WHERE id = p_family_id;
  EXECUTE format('SET LOCAL timezone = %L', v_family_tz);

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
      ts.dropoff_owner,
      ts.pickup_owner,
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

    IF v_schedule.trustee_type = 'school' THEN
      v_school_id := v_schedule.trustee_id;
      v_activity_id := NULL;
      v_dropoff_rule := COALESCE(v_schedule.dropoff_owner, 'prev_day');
      v_pickup_rule  := COALESCE(v_schedule.pickup_owner,  'current_day');
    ELSE
      v_school_id := NULL;
      v_activity_id := v_schedule.trustee_id;
      v_dropoff_rule := NULL;
      v_pickup_rule  := NULL;
    END IF;

    v_current_date := GREATEST(p_from_date, v_schedule.start_date);
    WHILE v_current_date <= LEAST(p_to_date, COALESCE(v_schedule.end_date, p_to_date)) LOOP
      v_dow := EXTRACT(DOW FROM v_current_date)::int;
      v_day_data := v_schedule.days->v_dow;

      IF v_day_data IS NOT NULL AND (v_day_data->>'active')::boolean = true THEN
        v_start_time := (v_day_data->>'start')::time;
        v_end_time := (v_day_data->>'end')::time;

        IF v_start_time IS NOT NULL AND v_end_time IS NOT NULL THEN
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
            IF v_event_type = 'school' THEN
              v_dropoff_by := get_custody_parent_id(
                p_family_id,
                CASE WHEN v_dropoff_rule = 'prev_day' THEN v_current_date - 1 ELSE v_current_date END
              );
              v_pickup_by := get_custody_parent_id(
                p_family_id,
                CASE WHEN v_pickup_rule = 'prev_day' THEN v_current_date - 1 ELSE v_current_date END
              );
              v_custody_parent := v_pickup_by;
            ELSE
              v_dropoff_by := NULL;
              v_pickup_by := NULL;
              v_custody_parent := get_custody_parent_id(p_family_id, v_current_date);
            END IF;

            INSERT INTO events (
              family_id, type, title, start_time, end_time,
              status, expected_by, dropoff_by, pickup_by, created_by,
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
              v_dropoff_by,
              v_pickup_by,
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
