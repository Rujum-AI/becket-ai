-- =====================================================
-- BECKET AI - SNAPSHOT CATEGORIES (photo / doc)
-- Migration 017: Add category column + expand bucket for PDFs
-- =====================================================

-- 1. Add category column to snapshots
ALTER TABLE snapshots
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'photo'
  CHECK (category IN ('photo', 'doc'));

-- 2. Expand file_type check to include 'document'
ALTER TABLE snapshots DROP CONSTRAINT IF EXISTS snapshots_file_type_check;
ALTER TABLE snapshots ADD CONSTRAINT snapshots_file_type_check
  CHECK (file_type IN ('image', 'video', 'document'));

-- 3. Update storage bucket to also accept PDFs
UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'image/jpeg', 'image/png', 'image/webp',
  'application/pdf'
]
WHERE id = 'snapshots';

-- 4. Partial index for fast document queries
CREATE INDEX IF NOT EXISTS idx_snapshots_docs
  ON snapshots(family_id, category)
  WHERE category = 'doc';
