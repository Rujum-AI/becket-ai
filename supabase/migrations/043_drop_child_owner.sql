-- =====================================================
-- BECKET AI - DROP children.owner_label
-- Migration 043: revert 042
-- =====================================================
--
-- The "explicit child owner" added in 042 was a misread of the audit.
-- A child's owner is derived from custody_cycles via get_custody_parent
-- — it's a per-time value driven by the schedule, not a static
-- contract-level field. Removing the column + restoring the archive
-- trigger to its pre-042 column set.

-- Restore the trigger function to its 038-era column set (without
-- owner_label) before dropping the source column, otherwise the
-- next DELETE would fail.
CREATE OR REPLACE FUNCTION archive_deleted_child()
RETURNS trigger AS $$
BEGIN
  INSERT INTO deleted_children (
    id, family_id, name, gender, date_of_birth, medical_notes, avatar_url,
    current_status, current_parent_id, status_changed_at, status_changed_by,
    original_created_at, original_updated_at,
    deleted_by
  ) VALUES (
    OLD.id, OLD.family_id, OLD.name, OLD.gender, OLD.date_of_birth, OLD.medical_notes, OLD.avatar_url,
    OLD.current_status, OLD.current_parent_id, OLD.status_changed_at, OLD.status_changed_by,
    OLD.created_at, OLD.updated_at,
    auth.uid()
  );
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER TABLE children DROP COLUMN IF EXISTS owner_label;

-- Keep the column on deleted_children for historical archive rows; it'll
-- just always be NULL going forward. Dropping it would also be fine but
-- preserves the past row shape on disk.
