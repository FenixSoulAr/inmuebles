-- Add unique constraint to prevent duplicate rent dues for same contract+period
ALTER TABLE public.rent_dues 
ADD CONSTRAINT rent_dues_contract_period_unique UNIQUE (contract_id, period_month);