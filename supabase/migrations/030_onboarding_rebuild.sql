-- =====================================================
-- BECKET AI - ONBOARDING REBUILD
-- Migration 030: Add family_type, dashboard_prefs, challenges
-- =====================================================

-- 1. Family type: solo / separated / together
ALTER TABLE families ADD COLUMN IF NOT EXISTS
  family_type text DEFAULT 'separated'
  CHECK (family_type IN ('solo', 'separated', 'together'));

-- 2. Dashboard preferences (which optional tabs are enabled)
ALTER TABLE families ADD COLUMN IF NOT EXISTS
  dashboard_prefs jsonb DEFAULT '{"finance":true,"management":true,"understandings":true}';

-- 3. Challenges selected during onboarding
ALTER TABLE families ADD COLUMN IF NOT EXISTS
  challenges jsonb DEFAULT '[]';

-- 4. Backfill family_type from existing mode column
UPDATE families SET family_type = CASE
  WHEN mode = 'solo' THEN 'solo'
  ELSE 'separated'
END;
