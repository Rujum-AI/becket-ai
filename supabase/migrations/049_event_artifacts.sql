-- =====================================================
-- BECKET AI - EVENT ARTIFACTS
-- Migration 049: parent-captured moments tied to events
-- =====================================================
--
-- The brief is becoming a story, not a log. Pickups/dropoffs disappear
-- from the brief. School days appear only when a parent captured
-- something. Activities, friend visits, appointments and manual events
-- always appear and carry artifacts when present.
--
-- An artifact = one parent's capture in the moment, triggered by a
-- calendar-event notification. Three optional inputs: photo, mood
-- emoji, short note. Multiple captures per event are allowed (dad
-- photos at dropoff, mom notes at pickup).
--
-- New table — NOT an extension of snapshots — because:
--   (a) snapshots are media-first (1 row = 1 file); artifacts can be
--       note-only or mood-only with no file at all
--   (b) keeping them separate means existing snapshot/album code stays
--       untouched
-- Photo storage reuses the existing `snapshots` storage bucket
-- (migration 016) — no second bucket to manage.

-- =====================================================
-- 1. TABLE
-- =====================================================
CREATE TABLE event_artifacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  child_id uuid NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES profiles(id),
  photo_url text,
  mood text,
  note text,
  captured_at timestamptz NOT NULL DEFAULT NOW(),
  created_at timestamptz NOT NULL DEFAULT NOW(),

  -- At least one of (photo, mood, note) must be present.
  -- Note must also be non-empty after trim so " " doesn't sneak past.
  CONSTRAINT event_artifacts_nonempty CHECK (
    photo_url IS NOT NULL
    OR mood IS NOT NULL
    OR (note IS NOT NULL AND length(trim(note)) > 0)
  ),

  -- Locked vocabulary (plan 2026-06-21): Loved it / Had fun / Okay /
  -- Tired / Upset / Sick. Stored as compact slugs.
  CONSTRAINT event_artifacts_mood CHECK (
    mood IS NULL
    OR mood IN ('loved', 'fun', 'ok', 'tired', 'upset', 'sick')
  )
);

-- =====================================================
-- 2. INDEXES
-- =====================================================
-- Pulling a single event's captures (BriefStoryCard render, lightbox)
CREATE INDEX idx_event_artifacts_event_child
  ON event_artifacts(event_id, child_id);

-- Brief timeline query (per-child, newest first)
CREATE INDEX idx_event_artifacts_child_captured
  ON event_artifacts(child_id, captured_at DESC);

-- Family album / "you missed this" feed
CREATE INDEX idx_event_artifacts_family_captured
  ON event_artifacts(family_id, captured_at DESC);

-- Photo-only feed (album view filters by photo presence)
CREATE INDEX idx_event_artifacts_photo
  ON event_artifacts(family_id, captured_at DESC)
  WHERE photo_url IS NOT NULL;

-- =====================================================
-- 3. RLS — family-scoped, standard pattern
-- =====================================================
ALTER TABLE event_artifacts ENABLE ROW LEVEL SECURITY;

-- Anyone in the family can read all artifacts.
CREATE POLICY "event_artifacts_read" ON event_artifacts
  FOR SELECT USING (family_id IN (SELECT user_family_ids()));

-- Insert: must be in the family AND author_id must be self
-- (prevents impersonation: you can't log a capture as your co-parent).
CREATE POLICY "event_artifacts_insert" ON event_artifacts
  FOR INSERT WITH CHECK (
    family_id IN (SELECT user_family_ids())
    AND author_id = auth.uid()
  );

-- Update/Delete: only the author can edit their own capture.
-- Read stays family-wide; mutation stays personal.
CREATE POLICY "event_artifacts_update" ON event_artifacts
  FOR UPDATE USING (
    family_id IN (SELECT user_family_ids())
    AND author_id = auth.uid()
  );

CREATE POLICY "event_artifacts_delete" ON event_artifacts
  FOR DELETE USING (
    family_id IN (SELECT user_family_ids())
    AND author_id = auth.uid()
  );

-- =====================================================
-- 4. REALTIME — so the brief refreshes live when a co-parent captures
-- (Idempotent guard pattern from migration 037+.)
-- =====================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'event_artifacts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE event_artifacts;
  END IF;
END $$;
