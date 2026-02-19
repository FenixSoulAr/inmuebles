-- Add jurisdiction_region field to contracts for future country/region parametrization
-- Nullable, no validations, no active logic yet
ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS jurisdiction_region TEXT DEFAULT NULL;

COMMENT ON COLUMN public.contracts.jurisdiction_region IS 
  'Future use: jurisdiction/region code for the contract (e.g. AR-CABA, AR-BA, UY, CL). Nullable, no validations active.';
