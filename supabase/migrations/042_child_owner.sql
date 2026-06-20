-- =====================================================
-- BECKET AI - EXPLICIT CHILD OWNER
-- Migration 042: contract-level "owner" per child
-- =====================================================
--
-- Why: children.current_status / current_parent_id capture WHERE the
-- child is right now (calendar-derived). But the audit flagged a
-- separate concept the contract should define: WHO is primarily
-- responsible for this child? In separated families this often differs
-- from per-day custody — one parent might be "the school contact",
-- "the medical decision-maker" for child A, while the other carries
-- that role for child B. Custody schedule still drives day-by-day
-- ownership; owner_label is the stable contract-level answer.
--
-- Values:
--   'dad'    — primary owner is the parent labelled 'dad'
--   'mom'    — primary owner is the parent labelled 'mom'
--   'shared' — explicit shared responsibility
--   NULL     — unset / not yet decided (existing rows default here)

ALTER TABLE children ADD COLUMN IF NOT EXISTS owner_label TEXT
  CHECK (owner_label IS NULL OR owner_label IN ('dad', 'mom', 'shared'));

COMMENT ON COLUMN children.owner_label IS
  'Contract-level primary parent owner (dad | mom | shared | NULL=unset). Separate from per-day custody status — that comes from custody_cycles.';

-- The delete-archive trigger from 038 only stores the columns it knew
-- about at the time. Update the archive table + trigger so a future
-- DELETE captures the new owner_label too.

ALTER TABLE deleted_children ADD COLUMN IF NOT EXISTS owner_label TEXT;

CREATE OR REPLACE FUNCTION archive_deleted_child()
RETURNS trigger AS $$
BEGIN
  INSERT INTO deleted_children (
    id, family_id, name, gender, date_of_birth, medical_notes, avatar_url,
    current_status, current_parent_id, status_changed_at, status_changed_by,
    owner_label,
    original_created_at, original_updated_at,
    deleted_by
  ) VALUES (
    OLD.id, OLD.family_id, OLD.name, OLD.gender, OLD.date_of_birth, OLD.medical_notes, OLD.avatar_url,
    OLD.current_status, OLD.current_parent_id, OLD.status_changed_at, OLD.status_changed_by,
    OLD.owner_label,
    OLD.created_at, OLD.updated_at,
    auth.uid()
  );
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
