
-- 1. Extend contracts table with public submission token
ALTER TABLE public.contracts
ADD COLUMN public_submission_token text,
ADD COLUMN token_status text NOT NULL DEFAULT 'active',
ADD COLUMN token_created_at timestamptz,
ADD COLUMN token_rotated_at timestamptz;

CREATE UNIQUE INDEX idx_contracts_submission_token 
ON public.contracts(public_submission_token) 
WHERE public_submission_token IS NOT NULL;

-- Generate tokens for existing active contracts
UPDATE public.contracts 
SET public_submission_token = encode(gen_random_bytes(32), 'hex'),
    token_created_at = now()
WHERE is_active = true AND public_submission_token IS NULL;

-- 2. Create payment_proofs table
CREATE TABLE public.payment_proofs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('rent', 'service')),
  service_type text CHECK (service_type IN ('expensas', 'abl', 'luz', 'agua', 'gas', 'internet', 'seguro', 'otro')),
  period text NOT NULL,
  amount numeric NOT NULL,
  paid_at date NOT NULL DEFAULT CURRENT_DATE,
  comment text,
  files text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'replaced')),
  rejection_reason text,
  replaces_proof_id uuid REFERENCES public.payment_proofs(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_proofs ENABLE ROW LEVEL SECURITY;

-- Owners can manage proofs via contract -> property
CREATE POLICY "Owners can manage proofs via contract"
ON public.payment_proofs
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM contracts c
    JOIN properties p ON c.property_id = p.id
    WHERE c.id = payment_proofs.contract_id
    AND p.owner_user_id = auth.uid()
  )
);

-- Index for duplicate checks
CREATE INDEX idx_payment_proofs_contract_period_type 
ON public.payment_proofs(contract_id, period, type, service_type) 
WHERE status IN ('pending', 'approved');

-- 3. Create storage bucket for proof files
INSERT INTO storage.buckets (id, name, public) VALUES ('proof-files', 'proof-files', true);

-- Allow anonymous uploads to proof-files bucket
CREATE POLICY "Anyone can upload proof files"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'proof-files');

-- Allow anyone to read proof files
CREATE POLICY "Anyone can read proof files"
ON storage.objects FOR SELECT
USING (bucket_id = 'proof-files');

-- Allow authenticated users to delete proof files
CREATE POLICY "Authenticated users can delete proof files"
ON storage.objects FOR DELETE
USING (bucket_id = 'proof-files' AND auth.role() = 'authenticated');
