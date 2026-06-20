-- =====================================================
-- BECKET AI - GENERATE_RECURRING_EVENTS ORDER FIX
-- Migration 048: school events first, custody handoffs second
-- =====================================================
--
-- 046 taught generate_custody_events to skip the handoff pair when
-- the incoming day already has a school event. But the orchestrator
-- `generate_recurring_events` calls custody-first, trustee-second.
-- After 047 wiped + regenerated everything, custody ran against an
-- empty events table — the school-supersession check never tripped
-- — and the trustee step then layered school events on top of the
-- redundant handoff pairs.
--
-- Fix: trustee first (creates school rows), then custody (which
-- now sees the school rows and skips superseded transitions).
--
-- Plus a one-shot cleanup of the handoffs that 047 left behind on
-- school days.

-- =====================================================
-- 1. RE-ORDER generate_recurring_events
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
  FOR v_family_record IN
    SELECT id FROM families
  LOOP
    -- School/activity FIRST so the custody generator can see them.
    v_trustee_count := generate_trustee_events(
      v_family_record.id,
      v_from_date,
      v_to_date
    );

    -- Custody handoffs SECOND — skips days where school already owns
    -- the transition.
    v_custody_count := generate_custody_events(
      v_family_record.id,
      v_from_date,
      v_to_date
    );

    family_id := v_family_record.id;
    custody_events_created := v_custody_count;
    trustee_events_created := v_trustee_count;
    total_events := v_custody_count + v_trustee_count;
    RETURN NEXT;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 2. ONE-SHOT CLEANUP: delete future custody handoffs left behind
-- by 047's wrong-order regeneration that are now superseded by an
-- existing school event for the same child.
-- (Same logic as 046's cleanup block — safe to run again.)
-- =====================================================
DO $$
DECLARE
  v_family record;
BEGIN
  FOR v_family IN
    SELECT id, COALESCE(timezone, 'Asia/Jerusalem') AS tz FROM families
  LOOP
    EXECUTE format('SET LOCAL timezone = %L', v_family.tz);

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
