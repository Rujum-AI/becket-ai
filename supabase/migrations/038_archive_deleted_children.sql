-- =====================================================
-- BECKET AI - ARCHIVE DELETED CHILDREN
-- Migration 038: BEFORE DELETE trigger backs up children to a parallel
-- archive table so customer support can revert.
-- =====================================================
--
-- Why: removing a child cascades to tasks/expenses/events references
-- via FKs (mostly ON DELETE SET NULL). Once the row's gone, there's no
-- way to fully reconstruct it from app state alone — name, DOB,
-- medical notes vanish. Customer support needs a safety net.
--
-- Design choice: hard-delete on children stays, archive happens via
-- trigger. That means:
--   - App code (deleteChild in useFamily, future scripts, dashboard
--     ops) doesn't change — every delete path is captured.
--   - Atomic with the delete (same txn). No window where archive
--     could miss.
--   - Family members can read their own archive (RLS) in case we
--     ever surface "recently deleted" UI; for now nothing reads it.
--   - Customer support reverts via service_role (bypasses RLS), no
--     restore RPC yet — adding one would require an "are you sure
--     the slot is empty" guard that's premature today.

-- =====================================================
-- 1. deleted_children ARCHIVE TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS deleted_children (
  -- Snapshot of every children column at the time of delete
  id uuid NOT NULL,
  family_id uuid NOT NULL,
  name text,
  gender text,
  date_of_birth date,
  medical_notes text,
  avatar_url text,
  current_status text,
  current_parent_id uuid,
  status_changed_at timestamptz,
  status_changed_by uuid,
  original_created_at timestamptz,
  original_updated_at timestamptz,

  -- Audit: who deleted it and when
  deleted_at timestamptz NOT NULL DEFAULT now(),
  deleted_by uuid REFERENCES profiles(id),

  -- Archive row's own PK (not the original id — multiple deletes of
  -- the same logical child after restore-then-delete would collide)
  archive_id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);

CREATE INDEX IF NOT EXISTS idx_deleted_children_family_deleted_at
  ON deleted_children(family_id, deleted_at DESC);

CREATE INDEX IF NOT EXISTS idx_deleted_children_original_id
  ON deleted_children(id);

COMMENT ON TABLE deleted_children IS
  'Snapshot of every children row at the moment of DELETE. Written automatically by the children_archive_on_delete trigger. Customer support queries this to revert accidental deletes.';

-- =====================================================
-- 2. RLS — family can READ their own archive; writes happen only via trigger
-- =====================================================
ALTER TABLE deleted_children ENABLE ROW LEVEL SECURITY;

CREATE POLICY "deleted_children_read" ON deleted_children
  FOR SELECT USING (family_id IN (SELECT user_family_ids()));

-- No INSERT/UPDATE/DELETE policies. Trigger uses SECURITY DEFINER to
-- bypass RLS for the archive write. Restores happen via service_role.

-- =====================================================
-- 3. BEFORE DELETE TRIGGER ON children
-- =====================================================
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

DROP TRIGGER IF EXISTS children_archive_on_delete ON children;
CREATE TRIGGER children_archive_on_delete
  BEFORE DELETE ON children
  FOR EACH ROW EXECUTE FUNCTION archive_deleted_child();
