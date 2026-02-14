-- =====================================================
-- BECKET AI - CRON JOBS
-- Migration 013: Schedule automated background tasks
-- Run in Supabase SQL Editor
-- =====================================================

-- Enable pg_cron (already available on Supabase, just needs enabling)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Grant usage to postgres role (required on Supabase)
GRANT USAGE ON SCHEMA cron TO postgres;

-- =====================================================
-- 1. DAILY: Generate upcoming events (2am UTC)
-- Creates pickup/dropoff + trustee events for all families
-- =====================================================
SELECT cron.unschedule('generate-recurring-events')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'generate-recurring-events'
);

SELECT cron.schedule(
  'generate-recurring-events',
  '0 2 * * *',
  'SELECT * FROM generate_recurring_events(3)'
);

-- =====================================================
-- 2. EVERY 5 MIN: Check for missed pickups/dropoffs
-- Alerts parents when a scheduled handoff is overdue
-- =====================================================
SELECT cron.unschedule('check-missed-pickups')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'check-missed-pickups'
);

SELECT cron.schedule(
  'check-missed-pickups',
  '*/5 * * * *',
  'SELECT check_missed_pickups()'
);

-- =====================================================
-- 3. EVERY 5 MIN: Check for expected dropoffs
-- Reminds parent 15min before school/activity starts
-- =====================================================
SELECT cron.unschedule('check-expected-dropoffs')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'check-expected-dropoffs'
);

SELECT cron.schedule(
  'check-expected-dropoffs',
  '*/5 * * * *',
  'SELECT check_expected_dropoffs()'
);

-- =====================================================
-- VERIFY: List all scheduled jobs
-- =====================================================
SELECT jobname, schedule, command FROM cron.job ORDER BY jobname;
