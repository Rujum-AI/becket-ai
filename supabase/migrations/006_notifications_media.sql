-- =====================================================
-- BECKET AI - NOTIFICATIONS & MEDIA
-- Migration 006: Snapshots, Notifications, Activity Log, Documents
-- =====================================================

-- =====================================================
-- 1. SNAPSHOTS
-- =====================================================
CREATE TABLE snapshots (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  family_id uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  file_url text NOT NULL,
  file_type text NOT NULL CHECK (file_type IN ('image', 'video')),
  timestamp timestamptz NOT NULL,
  uploaded_by uuid NOT NULL REFERENCES profiles(id),
  event_id uuid REFERENCES events(id),
  caption text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_snapshots_family ON snapshots(family_id, timestamp DESC);
CREATE INDEX idx_snapshots_event ON snapshots(event_id);
CREATE INDEX idx_snapshots_uploader ON snapshots(uploaded_by, timestamp DESC);

ALTER TABLE snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "snapshots_read" ON snapshots
  FOR SELECT USING (family_id IN (SELECT user_family_ids()));

CREATE POLICY "snapshots_insert" ON snapshots
  FOR INSERT WITH CHECK (family_id IN (SELECT user_family_ids()));

CREATE POLICY "snapshots_update" ON snapshots
  FOR UPDATE USING (family_id IN (SELECT user_family_ids()));

CREATE POLICY "snapshots_delete" ON snapshots
  FOR DELETE USING (family_id IN (SELECT user_family_ids()));

-- Add FK constraint to handoffs now that snapshots exist
ALTER TABLE handoffs
  ADD CONSTRAINT fk_handoffs_snapshot
  FOREIGN KEY (snapshot_id) REFERENCES snapshots(id);

-- =====================================================
-- 2. NOTIFICATIONS
-- =====================================================
CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  family_id uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES profiles(id),
  type text NOT NULL,
  category text NOT NULL CHECK (category IN ('handoff', 'task', 'ask', 'approval', 'event', 'expense', 'nudge')),

  title text NOT NULL,
  message text NOT NULL,
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),

  related_entity_type text CHECK (related_entity_type IN ('event', 'understanding', 'expense', 'task', 'snapshot', 'handoff')),
  related_entity_id uuid,

  requires_action boolean NOT NULL DEFAULT false,
  action_taken boolean NOT NULL DEFAULT false,
  action_taken_at timestamptz,

  read boolean NOT NULL DEFAULT false,
  read_at timestamptz,

  escalation_level int NOT NULL DEFAULT 0,
  parent_notification_id uuid REFERENCES notifications(id),

  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_recipient ON notifications(recipient_id, read, created_at DESC);
CREATE INDEX idx_notifications_family_category ON notifications(family_id, category, created_at DESC);
CREATE INDEX idx_notifications_entity ON notifications(related_entity_type, related_entity_id);
CREATE INDEX idx_notifications_created ON notifications(created_at);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications_read" ON notifications
  FOR SELECT USING (recipient_id = auth.uid());

CREATE POLICY "notifications_update" ON notifications
  FOR UPDATE USING (recipient_id = auth.uid());

-- System can insert notifications
CREATE POLICY "notifications_insert" ON notifications
  FOR INSERT WITH CHECK (true);

-- =====================================================
-- CLEANUP: Delete notifications older than 3 months
-- =====================================================
CREATE OR REPLACE FUNCTION cleanup_notifications()
RETURNS void AS $$
BEGIN
  DELETE FROM notifications
  WHERE created_at < NOW() - INTERVAL '3 months';
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 3. ACTIVITY_LOG
-- =====================================================
CREATE TABLE activity_log (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  family_id uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES profiles(id),
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  changes jsonb,
  timestamp timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_activity_log_family ON activity_log(family_id, entity_type, timestamp DESC);
CREATE INDEX idx_activity_log_entity ON activity_log(entity_type, entity_id, timestamp DESC);

ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "activity_log_read" ON activity_log
  FOR SELECT USING (family_id IN (SELECT user_family_ids()));

CREATE POLICY "activity_log_insert" ON activity_log
  FOR INSERT WITH CHECK (family_id IN (SELECT user_family_ids()));

-- =====================================================
-- 4. DOCUMENTS
-- =====================================================
CREATE TABLE documents (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  family_id uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  name text NOT NULL,
  file_type text NOT NULL CHECK (file_type IN ('pdf', 'image', 'document')),
  file_url text NOT NULL,
  category text NOT NULL CHECK (category IN ('agreement', 'receipt', 'medical', 'other')),
  related_entity_type text,
  related_entity_id uuid,
  uploaded_by uuid NOT NULL REFERENCES profiles(id),
  uploaded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_documents_family ON documents(family_id, category, uploaded_at DESC);

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "documents_read" ON documents
  FOR SELECT USING (family_id IN (SELECT user_family_ids()));

CREATE POLICY "documents_insert" ON documents
  FOR INSERT WITH CHECK (family_id IN (SELECT user_family_ids()));

CREATE POLICY "documents_delete" ON documents
  FOR DELETE USING (family_id IN (SELECT user_family_ids()));
