-- =====================================================
-- BECKET AI - SCHOOL DROP-OFF / PICKUP SPLIT
-- Migration 044: Two-parent ownership for school events
-- =====================================================
--
-- Before: a school event carried a single `expected_by` parent — the
-- custody parent for the calendar day. On a custody transition (e.g.
-- dad's Monday → mom's Tuesday), Tuesday morning's school dropoff
-- expected MOM even though the child slept at dad's place. Parents
-- end up arguing the obvious: dad does the dropoff, mom picks up.
--
-- After: school events carry both `dropoff_by` (previous-night's
-- custody parent — the parent who slept with the child) and `pickup_by`
-- (current-day custody parent — receiving custody for the day).
-- expected_by stays = pickup_by so the existing status engine keeps
-- working without changes.
--
-- One-time swaps ("we're trading this Thursday — you drop off, I pick
-- up") flow through pending_actions with reason `swap_dropoff` or
-- `swap_pickup`. The unique-pending index is widened to include the
-- reason so both slots can be requested independently on the same day.
--
-- Activities and other event types are unchanged — they still use
-- expected_by alone. See VERSION.md v2.08.

-- =====================================================
-- 1. ADD COLUMNS
-- =====================================================
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS dropoff_by uuid REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS pickup_by uuid REFERENCES profiles(id);

CREATE INDEX IF NOT EXISTS idx_events_dropoff_by
  ON events(dropoff_by) WHERE dropoff_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_events_pickup_by
  ON events(pickup_by) WHERE pickup_by IS NOT NULL;

-- =====================================================
-- 2. RELAX pending_actions UNIQUE INDEX
-- Allow one pending row per (target, reason) instead of per target.
-- Lets swap_dropoff and swap_pickup coexist on the same event.
-- Strictly looser than before: existing flows used one reason per
-- target so nothing they rely on changes.
-- =====================================================
DROP INDEX IF EXISTS uniq_pending_actions_one_pending_per_target;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_pending_actions_one_pending_per_target_reason
  ON pending_actions(target_type, target_id, COALESCE(reason, ''))
  WHERE status = 'pending';

-- =====================================================
-- 3. REWRITE generate_trustee_events
-- For type='school': dropoff_by = previous-day custody, pickup_by =
-- current-day custody. expected_by = pickup_by (status-engine compat).
-- For 'split' days, get_custody_parent_id returns NULL — the slot
-- stays NULL and the UI surfaces an "Assign" CTA (Wave 2).
-- Non-school types unchanged.
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
    ELSE
      v_school_id := NULL;
      v_activity_id := v_schedule.trustee_id;
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
              -- Drop-off parent = previous-night's custody parent
              -- Pickup parent = current-day custody parent
              -- NULL on either slot means split day; UI prompts assignment.
              v_dropoff_by := get_custody_parent_id(p_family_id, v_current_date - 1);
              v_pickup_by := get_custody_parent_id(p_family_id, v_current_date);
              v_custody_parent := v_pickup_by;  -- expected_by mirrors pickup
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

-- =====================================================
-- 4. BACKFILL future school events (per-family, timezone-aware)
-- Past events are left alone — they're history, not actionable.
-- =====================================================
DO $$
DECLARE
  v_family record;
BEGIN
  FOR v_family IN
    SELECT id, COALESCE(timezone, 'Asia/Jerusalem') AS tz FROM families
  LOOP
    EXECUTE format('SET LOCAL timezone = %L', v_family.tz);

    UPDATE events e
    SET
      dropoff_by = get_custody_parent_id(e.family_id, DATE(e.start_time) - 1),
      pickup_by  = get_custody_parent_id(e.family_id, DATE(e.start_time))
    WHERE e.family_id = v_family.id
      AND e.type = 'school'
      AND e.start_time >= now()
      AND e.dropoff_by IS NULL
      AND e.pickup_by IS NULL;
  END LOOP;
END $$;
