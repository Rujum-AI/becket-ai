-- =====================================================
-- BECKET AI - TEST DATA SEED
-- Populates family 8766befa with realistic weekly data
-- Run in Supabase SQL Editor
-- =====================================================

-- IDs for reference
-- Family:  8766befa-1622-4779-a213-5848537111e4
-- Dad:     172b500d-ff16-448c-a2e7-903b56cb0368
-- Mom:     327b4c04-4d20-4c38-a989-8b8a745000a7
-- Rom:     9d222e4c-... (boy)
-- Kai:     89c88462-... (girl)

DO $$
DECLARE
  v_family_id uuid := '8766befa-1622-4779-a213-5848537111e4';
  v_dad_id uuid := '172b500d-ff16-448c-a2e7-903b56cb0368';
  v_mom_id uuid := '327b4c04-4d20-4c38-a989-8b8a745000a7';
  v_rom_id uuid;
  v_kai_id uuid;

  -- Trustee IDs (will be generated)
  v_school_id uuid;
  v_soccer_id uuid;
  v_dance_id uuid;
  v_grandma_id uuid;

  -- Event IDs
  v_event_id uuid;

  -- Loop vars
  v_date date;
  v_day_of_week int; -- 0=Sun, 1=Mon, ..., 6=Sat
  v_custody_parent uuid;
BEGIN
  -- =====================================================
  -- 0. GET CHILDREN IDS
  -- =====================================================
  SELECT id INTO v_rom_id FROM children
    WHERE family_id = v_family_id AND name ILIKE '%rom%' LIMIT 1;
  SELECT id INTO v_kai_id FROM children
    WHERE family_id = v_family_id AND name ILIKE '%kai%' LIMIT 1;

  IF v_rom_id IS NULL OR v_kai_id IS NULL THEN
    RAISE EXCEPTION 'Children not found. Rom: %, Kai: %', v_rom_id, v_kai_id;
  END IF;

  -- =====================================================
  -- 1. CLEAN OLD GENERATED EVENTS (fresh start)
  -- =====================================================
  DELETE FROM event_children WHERE event_id IN (
    SELECT id FROM events WHERE family_id = v_family_id
      AND generated_from_type IS NOT NULL
  );
  DELETE FROM events WHERE family_id = v_family_id
    AND generated_from_type IS NOT NULL;

  -- =====================================================
  -- 2. CREATE TRUSTEES
  -- =====================================================

  -- School: Sunrise Elementary (Sun-Thu, 08:00-14:00)
  INSERT INTO trustees_schools (family_id, name, address, contact_phone, default_items)
  VALUES (
    v_family_id,
    'Sunrise Elementary',
    '12 HaShalom St, Tel Aviv',
    '03-555-1234',
    '["Backpack", "Water Bottle", "Lunch Box"]'::jsonb
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_school_id;

  -- If already exists, get the id
  IF v_school_id IS NULL THEN
    SELECT id INTO v_school_id FROM trustees_schools
      WHERE family_id = v_family_id AND name = 'Sunrise Elementary' LIMIT 1;
  END IF;

  -- Activity: Soccer Club (Mon + Wed, 16:00-17:30) - for Rom
  INSERT INTO trustees_activities (family_id, name, address, contact_phone, default_items)
  VALUES (
    v_family_id,
    'Soccer Club',
    'Sportek Park, Tel Aviv',
    '050-555-2222',
    '["Soccer Gear", "Water Bottle", "Cleats"]'::jsonb
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_soccer_id;

  IF v_soccer_id IS NULL THEN
    SELECT id INTO v_soccer_id FROM trustees_activities
      WHERE family_id = v_family_id AND name = 'Soccer Club' LIMIT 1;
  END IF;

  -- Activity: Dance Class (Tue + Thu, 16:00-17:00) - for Kai
  INSERT INTO trustees_activities (family_id, name, address, contact_phone, default_items)
  VALUES (
    v_family_id,
    'Dance Class',
    'Studio Move, Ramat Gan',
    '050-555-3333',
    '["Dance Shoes", "Water Bottle"]'::jsonb
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_dance_id;

  IF v_dance_id IS NULL THEN
    SELECT id INTO v_dance_id FROM trustees_activities
      WHERE family_id = v_family_id AND name = 'Dance Class' LIMIT 1;
  END IF;

  -- Person: Grandma Sarah
  INSERT INTO trustees_people (family_id, name, relationship, contact_phone, address)
  VALUES (
    v_family_id,
    'Grandma Sarah',
    'Family',
    '050-555-4444',
    '8 Ben Yehuda St, Herzliya'
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_grandma_id;

  IF v_grandma_id IS NULL THEN
    SELECT id INTO v_grandma_id FROM trustees_people
      WHERE family_id = v_family_id AND name = 'Grandma Sarah' LIMIT 1;
  END IF;

  -- =====================================================
  -- 3. LINK CHILDREN TO TRUSTEES
  -- =====================================================
  INSERT INTO trustee_children (trustee_type, trustee_id, child_id)
  VALUES
    ('school', v_school_id, v_rom_id),
    ('school', v_school_id, v_kai_id),
    ('activity', v_soccer_id, v_rom_id),
    ('activity', v_dance_id, v_kai_id),
    ('person', v_grandma_id, v_rom_id),
    ('person', v_grandma_id, v_kai_id)
  ON CONFLICT (trustee_type, trustee_id, child_id) DO NOTHING;

  -- =====================================================
  -- 4. CREATE SCHEDULES
  -- =====================================================

  -- School schedule: Sun-Thu 08:00-14:00 (both kids)
  -- days format: array of 7 objects (Sun=0 .. Sat=6)
  DELETE FROM trustee_schedules WHERE trustee_type = 'school' AND trustee_id = v_school_id;
  INSERT INTO trustee_schedules (trustee_type, trustee_id, child_id, days, start_date, repeat_freq)
  VALUES (
    'school', v_school_id, v_rom_id,
    '[
      {"active":true,"start":"08:00","end":"14:00"},
      {"active":true,"start":"08:00","end":"14:00"},
      {"active":true,"start":"08:00","end":"14:00"},
      {"active":true,"start":"08:00","end":"14:00"},
      {"active":true,"start":"08:00","end":"14:00"},
      {"active":false,"start":"","end":""},
      {"active":false,"start":"","end":""}
    ]'::jsonb,
    '2026-01-01', 1
  );
  INSERT INTO trustee_schedules (trustee_type, trustee_id, child_id, days, start_date, repeat_freq)
  VALUES (
    'school', v_school_id, v_kai_id,
    '[
      {"active":true,"start":"08:00","end":"14:00"},
      {"active":true,"start":"08:00","end":"14:00"},
      {"active":true,"start":"08:00","end":"14:00"},
      {"active":true,"start":"08:00","end":"14:00"},
      {"active":true,"start":"08:00","end":"14:00"},
      {"active":false,"start":"","end":""},
      {"active":false,"start":"","end":""}
    ]'::jsonb,
    '2026-01-01', 1
  );

  -- Soccer: Mon(1) + Wed(3) 16:00-17:30 - Rom only
  DELETE FROM trustee_schedules WHERE trustee_type = 'activity' AND trustee_id = v_soccer_id;
  INSERT INTO trustee_schedules (trustee_type, trustee_id, child_id, days, start_date, repeat_freq)
  VALUES (
    'activity', v_soccer_id, v_rom_id,
    '[
      {"active":false,"start":"","end":""},
      {"active":true,"start":"16:00","end":"17:30"},
      {"active":false,"start":"","end":""},
      {"active":true,"start":"16:00","end":"17:30"},
      {"active":false,"start":"","end":""},
      {"active":false,"start":"","end":""},
      {"active":false,"start":"","end":""}
    ]'::jsonb,
    '2026-01-01', 1
  );

  -- Dance: Tue(2) + Thu(4) 16:00-17:00 - Kai only
  DELETE FROM trustee_schedules WHERE trustee_type = 'activity' AND trustee_id = v_dance_id;
  INSERT INTO trustee_schedules (trustee_type, trustee_id, child_id, days, start_date, repeat_freq)
  VALUES (
    'activity', v_dance_id, v_kai_id,
    '[
      {"active":false,"start":"","end":""},
      {"active":false,"start":"","end":""},
      {"active":true,"start":"16:00","end":"17:00"},
      {"active":false,"start":"","end":""},
      {"active":true,"start":"16:00","end":"17:00"},
      {"active":false,"start":"","end":""},
      {"active":false,"start":"","end":""}
    ]'::jsonb,
    '2026-01-01', 1
  );

  -- =====================================================
  -- 5. GENERATE WEEKLY EVENTS (4 weeks: today + 28 days)
  -- =====================================================
  v_date := CURRENT_DATE;

  WHILE v_date < CURRENT_DATE + 28 LOOP
    -- day_of_week: 0=Sun, 1=Mon ... 6=Sat
    v_day_of_week := EXTRACT(DOW FROM v_date)::int;

    -- Get custody parent for this date
    v_custody_parent := get_custody_parent_id(v_family_id, v_date);

    -- ----- SCHOOL: Sun(0) - Thu(4) -----
    IF v_day_of_week BETWEEN 0 AND 4 THEN
      -- School event for Rom
      INSERT INTO events (family_id, type, title, start_time, end_time, status,
        expected_by, created_by, school_id, generated_from_type, generated_from_id)
      VALUES (
        v_family_id, 'school', 'Sunrise Elementary',
        (v_date + '08:00'::time)::timestamptz,
        (v_date + '14:00'::time)::timestamptz,
        'scheduled', v_custody_parent, v_dad_id, v_school_id,
        'trustee_schedule', v_school_id
      ) RETURNING id INTO v_event_id;
      INSERT INTO event_children (event_id, child_id) VALUES (v_event_id, v_rom_id);

      -- School event for Kai
      INSERT INTO events (family_id, type, title, start_time, end_time, status,
        expected_by, created_by, school_id, generated_from_type, generated_from_id)
      VALUES (
        v_family_id, 'school', 'Sunrise Elementary',
        (v_date + '08:00'::time)::timestamptz,
        (v_date + '14:00'::time)::timestamptz,
        'scheduled', v_custody_parent, v_dad_id, v_school_id,
        'trustee_schedule', v_school_id
      ) RETURNING id INTO v_event_id;
      INSERT INTO event_children (event_id, child_id) VALUES (v_event_id, v_kai_id);
    END IF;

    -- ----- SOCCER: Mon(1) + Wed(3) - Rom -----
    IF v_day_of_week IN (1, 3) THEN
      INSERT INTO events (family_id, type, title, start_time, end_time, status,
        expected_by, created_by, activity_id, generated_from_type, generated_from_id)
      VALUES (
        v_family_id, 'activity', 'Soccer Club',
        (v_date + '16:00'::time)::timestamptz,
        (v_date + '17:30'::time)::timestamptz,
        'scheduled', v_custody_parent, v_dad_id, v_soccer_id,
        'trustee_schedule', v_soccer_id
      ) RETURNING id INTO v_event_id;
      INSERT INTO event_children (event_id, child_id) VALUES (v_event_id, v_rom_id);
    END IF;

    -- ----- DANCE: Tue(2) + Thu(4) - Kai -----
    IF v_day_of_week IN (2, 4) THEN
      INSERT INTO events (family_id, type, title, start_time, end_time, status,
        expected_by, created_by, activity_id, generated_from_type, generated_from_id)
      VALUES (
        v_family_id, 'activity', 'Dance Class',
        (v_date + '16:00'::time)::timestamptz,
        (v_date + '17:00'::time)::timestamptz,
        'scheduled', v_custody_parent, v_dad_id, v_dance_id,
        'trustee_schedule', v_dance_id
      ) RETURNING id INTO v_event_id;
      INSERT INTO event_children (event_id, child_id) VALUES (v_event_id, v_kai_id);
    END IF;

    -- ----- GRANDMA VISIT: Wed(3) afternoon - both kids -----
    IF v_day_of_week = 3 THEN
      INSERT INTO events (family_id, type, title, start_time, end_time, status,
        expected_by, created_by, person_id, generated_from_type, generated_from_id)
      VALUES (
        v_family_id, 'friend_visit', 'Grandma Sarah',
        (v_date + '14:30'::time)::timestamptz,
        (v_date + '16:00'::time)::timestamptz,
        'scheduled', v_custody_parent, v_dad_id, v_grandma_id,
        'manual', v_grandma_id
      ) RETURNING id INTO v_event_id;
      INSERT INTO event_children (event_id, child_id) VALUES (v_event_id, v_rom_id);
      INSERT INTO event_children (event_id, child_id) VALUES (v_event_id, v_kai_id);
    END IF;

    v_date := v_date + 1;
  END LOOP;

  -- =====================================================
  -- 6. RE-GENERATE CUSTODY EVENTS (pickup/dropoff)
  -- =====================================================
  PERFORM generate_custody_events(v_family_id, CURRENT_DATE, CURRENT_DATE + 28);

  -- =====================================================
  -- 7. SET CHILDREN STATUS (Rom with dad, Kai with dad)
  -- =====================================================
  UPDATE children SET
    current_status = 'with_dad',
    current_parent_id = v_dad_id,
    status_changed_at = NOW(),
    status_changed_by = v_dad_id
  WHERE family_id = v_family_id;

  RAISE NOTICE 'Seed complete! Rom: %, Kai: %', v_rom_id, v_kai_id;
END;
$$;

-- =====================================================
-- VERIFY
-- =====================================================
SELECT type, title, DATE(start_time) as date,
  TO_CHAR(start_time, 'HH24:MI') as start,
  TO_CHAR(end_time, 'HH24:MI') as "end",
  (SELECT COUNT(*) FROM event_children ec WHERE ec.event_id = e.id) as children
FROM events e
WHERE family_id = '8766befa-1622-4779-a213-5848537111e4'
  AND start_time >= CURRENT_DATE::timestamptz
  AND start_time < (CURRENT_DATE + 8)::timestamptz
ORDER BY start_time, type;
