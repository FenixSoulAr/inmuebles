ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS rural_payment_frequency_months integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS rural_canon_unit text DEFAULT 'kg_carne',
  ADD COLUMN IF NOT EXISTS rural_price_per_unit numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS rural_canon_notes text DEFAULT NULL;