
-- Add missing columns to contract_adjustments
ALTER TABLE public.contract_adjustments
  ADD COLUMN IF NOT EXISTS manual_percentage numeric,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft';

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_contract_adjustments_contract_status
  ON public.contract_adjustments(contract_id, status);

-- Also ensure next_adjustment_date exists on contracts (for calculated display)
-- It already exists, but ensure it can be null
ALTER TABLE public.contracts
  ALTER COLUMN next_adjustment_date DROP NOT NULL;
