-- =====================================================
-- BECKET AI - CUSTODY CYCLE: SUNDAY ALIGNMENT
-- Migration 047: Fix SQL/JS cycle-index mismatch
-- =====================================================
--
-- The cycle editor (saveCycle in supabaseUnderstandings.js) and the
-- calendar (custodySchedule Proxy in supabaseDashboard.js) both treat
-- cycle_data[i] as "the parent for day i, where i % 7 = day_of_week
-- (0=Sun, 6=Sat)". The JS calendar consequently shifts its epoch back
-- to the Sunday of valid_from when computing cycleDay.
--
-- The SQL helpers (get_custody_parent_id from 011 and get_custody_parent
-- from 002) did NOT do that shift — they computed
--   cycle_day = MOD(p_date - valid_from, cycle_length)
-- which treats cycle_data[0] as "the parent on valid_from", not "Sunday".
--
-- For any family whose valid_from isn't a Sunday, the cron-generated
-- handoffs and trustee-generated school events landed on DIFFERENT
-- custody days than what the calendar showed. Symptom: handoff events
-- on days the calendar paints as the same parent (no actual transition);
-- school events with dropoff_by/pickup_by that don't match the visual
-- custody color.
--
-- This migration:
--   1. Rewrites both helpers to shift epoch to the Sunday of valid_from
--   2. Deletes all FUTURE generator-produced events (custody_cycle +
--      trustee_schedule) so they get rebuilt with the corrected helper
--   3. Re-runs generate_recurring_events(3) to refill the next 3 months

-- =====================================================
-- 1. get_custody_parent_id (uuid) — Sunday-aligned
-- =====================================================
CREATE OR REPLACE FUNCTION get_custody_parent_id(
  p_family_id uuid,
  p_date date
)
RETURNS uuid AS $$
DECLARE
  v_cycle_length int;
  v_cycle_data jsonb;
  v_valid_from date;
  v_cycle_epoch date;
  v_cycle_day int;
  v_parent_label text;
BEGIN
  SELECT cycle_length, cycle_data, valid_from
  INTO v_cycle_length, v_cycle_data, v_valid_from
  FROM custody_cycles
  WHERE family_id = p_family_id
    AND valid_from <= p_date
    AND (valid_until IS NULL OR valid_until >= p_date)
  ORDER BY valid_from DESC
  LIMIT 1;

  IF v_cycle_length IS NULL THEN
    RETURN NULL;
  END IF;

  -- Shift the epoch back to the Sunday on/before valid_from so cycle_data[i]
  -- with i % 7 = day_of_week (Sun=0..Sat=6) lines up with reality.
  v_cycle_epoch := v_valid_from - EXTRACT(DOW FROM v_valid_from)::int;
  v_cycle_day := MOD(p_date - v_cycle_epoch, v_cycle_length);

  v_parent_label := v_cycle_data->v_cycle_day->>'parent_label';

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
-- 2. get_custody_parent (text) — Sunday-aligned
-- =====================================================
CREATE OR REPLACE FUNCTION get_custody_parent(
  p_family_id uuid,
  p_date date
)
RETURNS text AS $$
DECLARE
  v_cycle_length int;
  v_cycle_data jsonb;
  v_valid_from date;
  v_cycle_epoch date;
  v_cycle_day int;
BEGIN
  SELECT cycle_length, cycle_data, valid_from
  INTO v_cycle_length, v_cycle_data, v_valid_from
  FROM custody_cycles
  WHERE family_id = p_family_id
    AND valid_from <= p_date
    AND (valid_until IS NULL OR valid_until >= p_date)
  ORDER BY valid_from DESC
  LIMIT 1;

  IF v_cycle_length IS NULL THEN
    RETURN NULL;
  END IF;

  v_cycle_epoch := v_valid_from - EXTRACT(DOW FROM v_valid_from)::int;
  v_cycle_day := MOD(p_date - v_cycle_epoch, v_cycle_length);

  RETURN (v_cycle_data->v_cycle_day->>'parent_label');
END;
$$ LANGUAGE plpgsql STABLE;

-- =====================================================
-- 3. WIPE FUTURE GENERATOR-PRODUCED EVENTS
-- Past events are history — they happened on the dates they happened.
-- Only future rows get rebuilt with the corrected helper.
-- =====================================================
DELETE FROM events
WHERE start_time >= now()
  AND generated_from_type IN ('custody_cycle', 'trustee_schedule');

-- =====================================================
-- 4. REGENERATE the next 3 months for all families
-- =====================================================
SELECT generate_recurring_events(3);
