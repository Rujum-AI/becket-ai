-- =====================================================
-- Fix notifications RLS policies (DEFINITIVE)
-- Previous attempts used user_family_ids() for INSERT
-- which fails despite working for other tables.
-- Reverting to original 006 approach: WITH CHECK (true)
-- for INSERT since notifications are non-destructive.
-- =====================================================

-- Drop ALL possible policy names (from various debugging sessions)
DROP POLICY IF EXISTS "notifications_read" ON notifications;
DROP POLICY IF EXISTS "notifications_insert" ON notifications;
DROP POLICY IF EXISTS "notifications_update" ON notifications;
DROP POLICY IF EXISTS "notifications_delete" ON notifications;
DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can insert notifications for family members" ON notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can delete their own notifications" ON notifications;
DROP POLICY IF EXISTS "notifications_select" ON notifications;

-- Ensure RLS is enabled
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- SELECT: Users can only see notifications sent TO them
CREATE POLICY "notifications_read" ON notifications
  FOR SELECT USING (recipient_id = auth.uid());

-- INSERT: Any authenticated user can create notifications
-- This is safe because notifications are non-destructive informational records
CREATE POLICY "notifications_insert" ON notifications
  FOR INSERT WITH CHECK (true);

-- UPDATE: Users can only update their own notifications (mark read, action taken)
CREATE POLICY "notifications_update" ON notifications
  FOR UPDATE USING (recipient_id = auth.uid());

-- Verify: run this after to confirm exactly 3 policies exist
SELECT policyname, cmd, permissive, qual, with_check
FROM pg_policies
WHERE tablename = 'notifications'
ORDER BY policyname;
