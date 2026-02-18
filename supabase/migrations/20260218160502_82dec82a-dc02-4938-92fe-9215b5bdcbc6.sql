
-- Add missing proof audit fields to payment_proofs
ALTER TABLE public.payment_proofs
  ADD COLUMN IF NOT EXISTS proof_waived_reason text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS proof_waived_note text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS proof_reviewed_by uuid DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS proof_reviewed_at timestamp with time zone DEFAULT NULL;

-- Backfill proof_status based on existing data
-- If files array is non-empty => uploaded
-- If proof_status = 'approved_without_proof' => waived (rename to new enum value)
-- Otherwise => required
UPDATE public.payment_proofs
SET proof_status = 'uploaded'
WHERE array_length(files, 1) > 0
  AND (proof_status IS NULL OR proof_status NOT IN ('uploaded', 'waived'));

UPDATE public.payment_proofs
SET 
  proof_status = 'waived',
  proof_waived_reason = 'owner_decision',
  proof_reviewed_by = approved_by,
  proof_reviewed_at = approved_at
WHERE proof_status = 'approved_without_proof';

UPDATE public.payment_proofs
SET proof_status = 'required'
WHERE proof_status IS NULL
   OR proof_status NOT IN ('uploaded', 'waived', 'required');
