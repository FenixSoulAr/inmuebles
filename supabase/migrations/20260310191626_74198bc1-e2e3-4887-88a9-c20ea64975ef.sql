-- Fix: Replace permissive proof-files INSERT policy with contract-validated one
DROP POLICY IF EXISTS "proof_files_insert_public" ON storage.objects;

CREATE POLICY "proof_files_insert_token"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'proof-files'
  AND EXISTS (
    SELECT 1 FROM public.contracts
    WHERE id::text = (storage.foldername(name))[1]
      AND is_active = true
      AND token_status = 'active'
  )
);

-- Also create the server-side token generation function
CREATE OR REPLACE FUNCTION public.generate_submission_token(_contract_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = 'public'
AS $$
DECLARE
  new_token text;
BEGIN
  new_token := encode(gen_random_bytes(32), 'hex');
  
  UPDATE contracts
  SET public_submission_token = new_token,
      token_status = 'active',
      token_created_at = now()
  WHERE id = _contract_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Contract not found or access denied';
  END IF;
  
  RETURN new_token;
END;
$$;