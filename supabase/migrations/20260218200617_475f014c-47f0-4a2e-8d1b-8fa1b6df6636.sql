
-- Add basic_terms to contracts table
ALTER TABLE public.contracts 
ADD COLUMN IF NOT EXISTS basic_terms text;

-- Create contract_documents table
CREATE TABLE IF NOT EXISTS public.contract_documents (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  title text NOT NULL,
  doc_type text NOT NULL DEFAULT 'other',
  file_url text NOT NULL,
  file_name text,
  file_size bigint,
  mime_type text,
  uploaded_at timestamp with time zone NOT NULL DEFAULT now(),
  uploaded_by uuid,
  notes text,
  status text NOT NULL DEFAULT 'active',
  version integer DEFAULT 1,
  is_primary boolean DEFAULT false
);

-- Enable RLS
ALTER TABLE public.contract_documents ENABLE ROW LEVEL SECURITY;

-- RLS: owners can manage documents via their contracts/properties
CREATE POLICY "Owners can manage contract documents via contract"
ON public.contract_documents
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM contracts c
    JOIN properties p ON c.property_id = p.id
    WHERE c.id = contract_documents.contract_id
      AND p.owner_user_id = auth.uid()
  )
);

-- Index for fast lookups by contract
CREATE INDEX IF NOT EXISTS idx_contract_documents_contract_id 
  ON public.contract_documents(contract_id);

-- Ensure only one primary signed_contract per contract
-- We'll enforce this in application logic (not a constraint to remain flexible)
