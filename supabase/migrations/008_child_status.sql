-- =====================================================
-- BECKET AI - CHILD STATUS
-- Migration 008: Add live status tracking to children
-- =====================================================
-- Phase 4.1: Pickup/dropoff button press changes child status.
-- Custody cycle determines EXPECTED parent, button press is the ACTUAL status.

ALTER TABLE children
  ADD COLUMN IF NOT EXISTS current_status text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS current_parent_id uuid REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS status_changed_at timestamptz,
  ADD COLUMN IF NOT EXISTS status_changed_by uuid REFERENCES profiles(id);

-- Allow status updates by family members
-- (children table already has RLS from 001_core_tables.sql)

-- Verify
SELECT id, name, current_status, current_parent_id
FROM children
LIMIT 5;
