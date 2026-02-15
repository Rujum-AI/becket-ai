-- =====================================================
-- BECKET AI - ENABLE REALTIME FOR NOTIFICATIONS
-- Migration 021: Supabase Realtime subscription support
-- Existing RLS policy (recipient_id = auth.uid()) filters
-- events per user automatically.
-- =====================================================

ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
