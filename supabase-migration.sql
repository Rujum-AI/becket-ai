-- Becket AI - Database Migration
-- Run this in Supabase SQL Editor to fix schema mismatches

-- Check if created_by column exists in expenses table
-- If not, add it (for existing installations)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'expenses' AND column_name = 'created_by'
    ) THEN
        ALTER TABLE expenses
        ADD COLUMN created_by uuid REFERENCES profiles(id);

        -- Set existing rows to the payer_id as fallback
        UPDATE expenses SET created_by = payer_id WHERE created_by IS NULL;

        -- Make it NOT NULL after backfilling
        ALTER TABLE expenses ALTER COLUMN created_by SET NOT NULL;
    END IF;
END $$;

-- Verify all required columns exist
SELECT
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name IN ('expenses', 'understandings', 'families', 'children', 'family_members')
ORDER BY table_name, ordinal_position;
