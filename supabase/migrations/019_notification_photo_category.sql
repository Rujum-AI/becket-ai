-- Add 'photo' to notifications category CHECK constraint
-- Allows photo upload notifications to be sent to co-parent

ALTER TABLE notifications
  DROP CONSTRAINT IF EXISTS notifications_category_check;

ALTER TABLE notifications
  ADD CONSTRAINT notifications_category_check
  CHECK (category IN ('handoff', 'task', 'ask', 'approval', 'event', 'expense', 'nudge', 'photo'));
