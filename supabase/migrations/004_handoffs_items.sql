-- =====================================================
-- BECKET AI - HANDOFFS & ITEM TRACKING
-- Migration 004: Handoffs, Items, Item History
-- =====================================================

-- =====================================================
-- 1. HANDOFFS
-- =====================================================
CREATE TABLE handoffs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  family_id uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  child_id uuid NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  event_id uuid REFERENCES events(id) ON DELETE SET NULL,
  from_parent_id uuid NOT NULL REFERENCES profiles(id),
  to_parent_id uuid NOT NULL REFERENCES profiles(id),
  scheduled_at timestamptz NOT NULL,
  actual_at timestamptz NOT NULL,
  items_sent jsonb DEFAULT '[]'::jsonb,
  snapshot_id uuid, -- Will reference snapshots table (created in later migration)
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_handoffs_family ON handoffs(family_id);
CREATE INDEX idx_handoffs_child_time ON handoffs(child_id, actual_at DESC);
CREATE INDEX idx_handoffs_from_parent ON handoffs(from_parent_id, child_id, actual_at DESC);

ALTER TABLE handoffs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "handoffs_read" ON handoffs
  FOR SELECT USING (family_id IN (SELECT user_family_ids()));

CREATE POLICY "handoffs_insert" ON handoffs
  FOR INSERT WITH CHECK (family_id IN (SELECT user_family_ids()));

CREATE POLICY "handoffs_update" ON handoffs
  FOR UPDATE USING (family_id IN (SELECT user_family_ids()));

-- =====================================================
-- 2. ITEMS
-- =====================================================
CREATE TABLE items (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  child_id uuid NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text NOT NULL CHECK (category IN ('daily', 'seasonal', 'special')),
  current_status text NOT NULL DEFAULT 'unknown' CHECK (current_status IN ('with_dad', 'with_mom', 'at_school', 'missing', 'unknown')),
  last_seen_handoff_id uuid REFERENCES handoffs(id),
  last_seen_at timestamptz,
  flagged_missing_since timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_items_child ON items(child_id);
CREATE INDEX idx_items_child_status ON items(child_id, current_status);

ALTER TABLE items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "items_read" ON items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM children
      WHERE children.id = items.child_id
      AND children.family_id IN (SELECT user_family_ids())
    )
  );

CREATE POLICY "items_insert" ON items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM children
      WHERE children.id = items.child_id
      AND children.family_id IN (SELECT user_family_ids())
    )
  );

CREATE POLICY "items_update" ON items
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM children
      WHERE children.id = items.child_id
      AND children.family_id IN (SELECT user_family_ids())
    )
  );

CREATE POLICY "items_delete" ON items
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM children
      WHERE children.id = items.child_id
      AND children.family_id IN (SELECT user_family_ids())
    )
  );

CREATE TRIGGER items_updated_at BEFORE UPDATE ON items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =====================================================
-- 3. ITEM_HISTORY
-- Retention: 1 month
-- =====================================================
CREATE TABLE item_history (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_id uuid NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  handoff_id uuid NOT NULL REFERENCES handoffs(id) ON DELETE CASCADE,
  status_change text NOT NULL CHECK (status_change IN ('sent', 'received', 'flagged_missing', 'found')),
  with_parent_id uuid REFERENCES profiles(id),
  timestamp timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_item_history_item ON item_history(item_id, timestamp DESC);
CREATE INDEX idx_item_history_timestamp ON item_history(timestamp);

ALTER TABLE item_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "item_history_read" ON item_history
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM items
      JOIN children ON children.id = items.child_id
      WHERE items.id = item_history.item_id
      AND children.family_id IN (SELECT user_family_ids())
    )
  );

CREATE POLICY "item_history_insert" ON item_history
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM items
      JOIN children ON children.id = items.child_id
      WHERE items.id = item_history.item_id
      AND children.family_id IN (SELECT user_family_ids())
    )
  );

-- =====================================================
-- CLEANUP JOB: Delete item_history older than 1 month
-- This will be set up in pg_cron later
-- =====================================================
CREATE OR REPLACE FUNCTION cleanup_item_history()
RETURNS void AS $$
BEGIN
  DELETE FROM item_history
  WHERE timestamp < NOW() - INTERVAL '1 month';
END;
$$ LANGUAGE plpgsql;
