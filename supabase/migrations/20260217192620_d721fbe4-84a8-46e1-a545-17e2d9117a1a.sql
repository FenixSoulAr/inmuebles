
-- Add proof_status, approved_by, approved_at to payment_proofs
ALTER TABLE public.payment_proofs
  ADD COLUMN IF NOT EXISTS proof_status text NOT NULL DEFAULT 'required',
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at timestamp with time zone;

-- Add a comment for clarity
COMMENT ON COLUMN public.payment_proofs.proof_status IS 'required | uploaded | approved_without_proof';
