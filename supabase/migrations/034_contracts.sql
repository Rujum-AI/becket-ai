-- =====================================================
-- BECKET AI - CONTRACTS (DATA, NOT ENUM)
-- Migration 034: contracts table + storage bucket
-- =====================================================
--
-- Why: until now the family "contract" was just families.agreement_basis,
-- a 3-value enum ('formal'|'verbal'|'building') that nothing downstream
-- reads. That can't represent what's actually agreed (which categories
-- are shared, what custody looks like, which budgets exist).
--
-- This wave adds the data backbone:
--   - contracts table with source_type (questionnaire | document | mixed),
--     optional raw_doc_url, and a free-form parsed_terms jsonb.
--   - contracts storage bucket so a parent can upload a court order /
--     mediation agreement PDF.
--
-- parsed_terms is intentionally schemaless this wave — the AI ingestion
-- pipeline (later) writes whatever shape it wants, we tighten with a
-- CHECK or a view once the shape stabilizes. Migrations are cheap.

-- =====================================================
-- 1. CONTRACTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,

  source_type text NOT NULL CHECK (source_type IN ('questionnaire', 'document', 'mixed')),
  raw_doc_url text,  -- storage path inside the 'contracts' bucket; null for pure-questionnaire contracts
  parsed_terms jsonb NOT NULL DEFAULT '{}'::jsonb,

  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),

  created_by uuid REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contracts_family_status ON contracts(family_id, status);

-- Only one ACTIVE contract per family at a time. Multiple drafts/archived are fine.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_contracts_one_active_per_family
  ON contracts(family_id) WHERE status = 'active';

-- updated_at maintenance trigger (reuses helper from 001)
DROP TRIGGER IF EXISTS contracts_updated_at ON contracts;
CREATE TRIGGER contracts_updated_at
  BEFORE UPDATE ON contracts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =====================================================
-- 2. RLS — family-scoped, admin-write
-- =====================================================
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contracts_read" ON contracts
  FOR SELECT USING (family_id IN (SELECT user_family_ids()));

CREATE POLICY "contracts_insert" ON contracts
  FOR INSERT WITH CHECK (
    family_id IN (SELECT user_family_ids())
    AND created_by = auth.uid()
  );

CREATE POLICY "contracts_update" ON contracts
  FOR UPDATE USING (family_id IN (SELECT user_family_ids()));

CREATE POLICY "contracts_delete" ON contracts
  FOR DELETE USING (
    family_id IN (SELECT user_family_ids())
    AND created_by = auth.uid()
  );

-- =====================================================
-- 3. REALTIME — so a parent uploading a contract is visible to the co-parent
-- =====================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'contracts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE contracts;
  END IF;
END $$;

-- =====================================================
-- 4. STORAGE BUCKET — 'contracts'
-- =====================================================
-- Private bucket; accepts PDF + images (court orders are often photographed).
-- 10MB cap (legal docs run long).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'contracts',
  'contracts',
  false,
  10485760,  -- 10MB
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Family-scoped RLS on storage.objects, mirrors snapshots/documents pattern.
-- Path convention: {family_id}/{filename}
DROP POLICY IF EXISTS "contracts_storage_select" ON storage.objects;
CREATE POLICY "contracts_storage_select" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'contracts'
    AND (storage.foldername(name))[1]::uuid IN (SELECT user_family_ids())
  );

DROP POLICY IF EXISTS "contracts_storage_insert" ON storage.objects;
CREATE POLICY "contracts_storage_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'contracts'
    AND (storage.foldername(name))[1]::uuid IN (SELECT user_family_ids())
  );

DROP POLICY IF EXISTS "contracts_storage_delete" ON storage.objects;
CREATE POLICY "contracts_storage_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'contracts'
    AND (storage.foldername(name))[1]::uuid IN (SELECT user_family_ids())
  );

-- =====================================================
-- 5. AI INGESTION STUB
-- =====================================================
-- Placeholder RPC the AI pipeline will call to parse a raw_doc_url
-- into parsed_terms. Today it's a no-op that flips draft → active so
-- the rest of the app can be wired against it without waiting on AI.
CREATE OR REPLACE FUNCTION public.ingest_contract(p_contract_id uuid)
RETURNS jsonb AS $$
DECLARE
  v_contract record;
BEGIN
  SELECT * INTO v_contract FROM contracts WHERE id = p_contract_id;
  IF v_contract IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  IF v_contract.family_id NOT IN (SELECT user_family_ids()) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authorized');
  END IF;

  -- TODO(wave-AI): call out to AI parser; for now just mark as active.
  UPDATE contracts
    SET status = 'active', updated_at = now()
    WHERE id = p_contract_id;

  RETURN jsonb_build_object('ok', true, 'contract_id', p_contract_id, 'stub', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
