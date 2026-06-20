-- =====================================================
-- BECKET AI - SCHOOL SUPERSEDES CUSTODY HANDOFF
-- Migration 046: Only one handoff per transition day
-- =====================================================
--
-- Before: the daily cron generated a "Custody Handoff - Dropoff" at
-- 18:00 on the outgoing day and a "Custody Handoff - Pickup" at 08:00
-- on the incoming day, independent of school. After Wave 1+2 the
-- school event itself carries dropoff_by / pickup_by — so a school
-- day saw BOTH the school event AND a redundant pair of handoffs.
-- Parents got asked about a handoff that doesn't happen (the kid
-- just goes to school).
--
-- After: school owns the handoff. If a child has a school event on
-- the INCOMING custody day, generate_custody_events skips both the
-- outgoing-evening dropoff and the incoming-morning pickup for that
-- child. The transition is implicit in the school event.
--
-- This migration:
--   1. Rewrites generate_custody_events with the school-aware guard
--   2. Deletes existing FUTURE custody_cycle pickup/dropoff events
--      already superseded by a school event (per family timezone)

-- =====================================================
-- 1. REWRITE generate_custody_events
-- Per-child skip when a school event covers the incoming day.
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
  v_family_tz text;
  v_has_school_next_day boolean;
BEGIN
  SELECT COALESCE(timezone, 'Asia/Jerusalem') INTO v_family_tz FROM families WHERE id = p_family_id;
  EXECUTE format('SET LOCAL timezone = %L', v_family_tz);

  SELECT id INTO v_cycle_id
  FROM custody_cycles
  WHERE family_id = p_family_id
    AND valid_from <= p_from_date
    AND (valid_until IS NULL OR valid_until >= p_from_date)
  ORDER BY valid_from DESC
  LIMIT 1;

  IF v_cycle_id IS NULL THEN
    RETURN 0;
  END IF;

  v_current_date := p_from_date;
  WHILE v_current_date < p_to_date LOOP
    v_today_parent := get_custody_parent_id(p_family_id, v_current_date);
    v_tomorrow_parent := get_custody_parent_id(p_family_id, v_current_date + 1);

    IF v_today_parent IS NOT NULL
       AND v_tomorrow_parent IS NOT NULL
       AND v_today_parent != v_tomorrow_parent THEN

      FOR v_child_record IN
        SELECT id FROM children WHERE family_id = p_family_id
      LOOP
        -- If this child has a school event on the incoming day, the
        -- school IS the handoff: skip both dropoff (outgoing 18:00)
        -- and pickup (incoming 08:00) for this child on this transition.
        SELECT EXISTS (
          SELECT 1
          FROM events e
          JOIN event_children ec ON ec.event_id = e.id
          WHERE e.family_id = p_family_id
            AND e.type = 'school'
            AND e.status != 'cancelled'
            AND DATE(e.start_time) = v_current_date + 1
            AND ec.child_id = v_child_record.id
        ) INTO v_has_school_next_day;

        IF v_has_school_next_day THEN
          CONTINUE;
        END IF;

        -- No school on the incoming day → original handoff logic.
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
          INSERT INTO events (
            family_id, type, title, start_time, end_time,
            status, expected_by, created_by,
            generated_from_type, generated_from_id
          ) VALUES (
            p_family_id, 'dropoff', 'Custody Handoff - Dropoff',
            (v_current_date + v_dropoff_time)::timestamptz,
            (v_current_date + v_dropoff_time + interval '15 minutes')::timestamptz,
            'scheduled', v_today_parent, v_today_parent,
            'custody_cycle', v_cycle_id
          ) RETURNING id INTO v_event_id;

          INSERT INTO event_children (event_id, child_id)
          VALUES (v_event_id, v_child_record.id);

          v_events_created := v_events_created + 1;
        END IF;

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
          INSERT INTO events (
            family_id, type, title, start_time, end_time,
            status, expected_by, created_by,
            generated_from_type, generated_from_id
          ) VALUES (
            p_family_id, 'pickup', 'Custody Handoff - Pickup',
            ((v_current_date + 1) + v_pickup_time)::timestamptz,
            ((v_current_date + 1) + v_pickup_time + interval '15 minutes')::timestamptz,
            'scheduled', v_tomorrow_parent, v_tomorrow_parent,
            'custody_cycle', v_cycle_id
          ) RETURNING id INTO v_event_id;

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
-- 2. CLEANUP: delete future custody_cycle handoffs already
-- superseded by a school event for the same child.
-- Past events stay (they happened — history is history).
-- Per-family timezone to match the date math the generators use.
-- =====================================================
DO $$
DECLARE
  v_family record;
BEGIN
  FOR v_family IN
    SELECT id, COALESCE(timezone, 'Asia/Jerusalem') AS tz FROM families
  LOOP
    EXECUTE format('SET LOCAL timezone = %L', v_family.tz);

    -- Delete future dropoffs whose NEXT day has a school event for the same child.
    DELETE FROM events e
    WHERE e.family_id = v_family.id
      AND e.type = 'dropoff'
      AND e.generated_from_type = 'custody_cycle'
      AND e.start_time >= now()
      AND EXISTS (
        SELECT 1
        FROM events sch
        JOIN event_children sec ON sec.event_id = sch.id
        JOIN event_children ec  ON ec.event_id  = e.id
        WHERE sch.family_id = e.family_id
          AND sch.type = 'school'
          AND sch.status != 'cancelled'
          AND DATE(sch.start_time) = DATE(e.start_time) + 1
          AND sec.child_id = ec.child_id
      );

    -- Delete future pickups whose SAME day has a school event for the same child.
    DELETE FROM events e
    WHERE e.family_id = v_family.id
      AND e.type = 'pickup'
      AND e.generated_from_type = 'custody_cycle'
      AND e.start_time >= now()
      AND EXISTS (
        SELECT 1
        FROM events sch
        JOIN event_children sec ON sec.event_id = sch.id
        JOIN event_children ec  ON ec.event_id  = e.id
        WHERE sch.family_id = e.family_id
          AND sch.type = 'school'
          AND sch.status != 'cancelled'
          AND DATE(sch.start_time) = DATE(e.start_time)
          AND sec.child_id = ec.child_id
      );
  END LOOP;
END $$;
