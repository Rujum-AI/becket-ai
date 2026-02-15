-- =====================================================
-- BECKET AI - STORAGE BUCKETS & SNAPSHOT CHILDREN
-- Migration 016: Create storage bucket + snapshot_children junction
-- =====================================================

-- =====================================================
-- 1. STORAGE BUCKET: snapshots
-- =====================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'snapshots',
  'snapshots',
  false,
  5242880,  -- 5MB max per file
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- RLS policies for storage objects
CREATE POLICY "snapshots_select" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'snapshots'
    AND (storage.foldername(name))[1]::uuid IN (SELECT user_family_ids())
  );

CREATE POLICY "snapshots_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'snapshots'
    AND (storage.foldername(name))[1]::uuid IN (SELECT user_family_ids())
  );

CREATE POLICY "snapshots_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'snapshots'
    AND (storage.foldername(name))[1]::uuid IN (SELECT user_family_ids())
  );

-- =====================================================
-- 2. SNAPSHOT_CHILDREN junction table
-- =====================================================
CREATE TABLE snapshot_children (
  snapshot_id uuid NOT NULL REFERENCES snapshots(id) ON DELETE CASCADE,
  child_id uuid NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  PRIMARY KEY (snapshot_id, child_id)
);

CREATE INDEX idx_snapshot_children_child ON snapshot_children(child_id);

ALTER TABLE snapshot_children ENABLE ROW LEVEL SECURITY;

CREATE POLICY "snapshot_children_read" ON snapshot_children
  FOR SELECT USING (
    snapshot_id IN (SELECT id FROM snapshots WHERE family_id IN (SELECT user_family_ids()))
  );

CREATE POLICY "snapshot_children_insert" ON snapshot_children
  FOR INSERT WITH CHECK (
    snapshot_id IN (SELECT id FROM snapshots WHERE family_id IN (SELECT user_family_ids()))
  );

CREATE POLICY "snapshot_children_delete" ON snapshot_children
  FOR DELETE USING (
    snapshot_id IN (SELECT id FROM snapshots WHERE family_id IN (SELECT user_family_ids()))
  );
