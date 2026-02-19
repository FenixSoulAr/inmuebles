
-- ============================================================
-- STORAGE HARDENING: Make all 3 buckets private + tighten RLS
-- ============================================================

-- 1. Make all buckets private
UPDATE storage.buckets
SET public = false
WHERE id IN ('documents', 'proof-files', 'contract-documents');

-- ============================================================
-- 2. DOCUMENTS bucket — drop old permissive policies
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can upload documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their documents" ON storage.objects;

-- Scoped INSERT: user can only upload to their own user-id subfolder
CREATE POLICY "documents_insert_own_folder"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Scoped SELECT: user can only view their own files
CREATE POLICY "documents_select_own_folder"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Scoped DELETE: user can only delete their own files
CREATE POLICY "documents_delete_own_folder"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- ============================================================
-- 3. PROOF-FILES bucket — drop old permissive policies
-- ============================================================
DROP POLICY IF EXISTS "Anyone can upload proof files" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can read proof files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete proof files" ON storage.objects;

-- Public submissions still need to upload (token-protected by app logic)
CREATE POLICY "proof_files_insert_public"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'proof-files');

-- Only the contract owner can VIEW proof files
CREATE POLICY "proof_files_select_owner"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'proof-files'
  AND EXISTS (
    SELECT 1
    FROM contracts c
    JOIN properties p ON c.property_id = p.id
    WHERE c.id::text = (storage.foldername(name))[1]
    AND p.owner_user_id = auth.uid()
  )
);

-- Only owner can DELETE proof files
CREATE POLICY "proof_files_delete_owner"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'proof-files'
  AND EXISTS (
    SELECT 1
    FROM contracts c
    JOIN properties p ON c.property_id = p.id
    WHERE c.id::text = (storage.foldername(name))[1]
    AND p.owner_user_id = auth.uid()
  )
);

-- ============================================================
-- 4. CONTRACT-DOCUMENTS bucket — drop old permissive policies
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can upload contract documents" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view contract documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete contract documents" ON storage.objects;

-- INSERT: only owner of the contract can upload
CREATE POLICY "contract_docs_insert_owner"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'contract-documents'
  AND EXISTS (
    SELECT 1
    FROM contracts c
    JOIN properties p ON c.property_id = p.id
    WHERE c.id::text = (storage.foldername(name))[1]
    AND p.owner_user_id = auth.uid()
  )
);

-- SELECT: only contract owner can view
CREATE POLICY "contract_docs_select_owner"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'contract-documents'
  AND EXISTS (
    SELECT 1
    FROM contracts c
    JOIN properties p ON c.property_id = p.id
    WHERE c.id::text = (storage.foldername(name))[1]
    AND p.owner_user_id = auth.uid()
  )
);

-- DELETE: only contract owner can delete
CREATE POLICY "contract_docs_delete_owner"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'contract-documents'
  AND EXISTS (
    SELECT 1
    FROM contracts c
    JOIN properties p ON c.property_id = p.id
    WHERE c.id::text = (storage.foldername(name))[1]
    AND p.owner_user_id = auth.uid()
  )
);
