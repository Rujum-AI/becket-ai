-- =====================================================
-- BECKET AI - REALTIME FOR EXPENSES + EVENTS
-- Migration 037: Extend supabase_realtime to the rest of the
-- pullable surface
-- =====================================================
--
-- Why: pending_actions was added to realtime in 035, but the targets
-- it points at (expenses, events) weren't. So when the decide trigger
-- flips an expense from 'pending_approval' to 'counted', the requester
-- never sees the change until they refresh. Same for cross-day events
-- after a partner approves.
--
-- This brings the rest of the per-family pullable surface online.
-- Tasks deliberately left off until we have a Pending Tasks UI to
-- consume them — adding tables to the publication is cheap, but
-- subscribing without a consumer just adds noise on the wire.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'expenses'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE expenses;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'events'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE events;
  END IF;
END $$;
