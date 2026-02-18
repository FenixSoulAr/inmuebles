
-- Add adjustment fields to contracts table
ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS adjustment_base_date date,
  ADD COLUMN IF NOT EXISTS currency_deposit text DEFAULT 'ARS',
  ADD COLUMN IF NOT EXISTS grace_days integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS penalty_type text,
  ADD COLUMN IF NOT EXISTS penalty_value numeric;

-- Create contract_adjustments table for manual adjustment history
CREATE TABLE IF NOT EXISTS public.contract_adjustments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  adjustment_date date NOT NULL,
  previous_amount numeric NOT NULL,
  calculated_amount numeric NOT NULL,
  confirmed_amount numeric,
  confirmed_by uuid REFERENCES public.profiles(id),
  confirmed_at timestamp with time zone,
  note text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.contract_adjustments ENABLE ROW LEVEL SECURITY;

-- RLS: owners can manage adjustments via their contract
CREATE POLICY "Owners can manage contract adjustments via contract"
  ON public.contract_adjustments
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.contracts c
      JOIN public.properties p ON c.property_id = p.id
      WHERE c.id = contract_adjustments.contract_id
        AND p.owner_user_id = auth.uid()
    )
  );

-- Index for fast lookup by contract
CREATE INDEX IF NOT EXISTS idx_contract_adjustments_contract_id
  ON public.contract_adjustments(contract_id);

-- Create contract_guarantors table (contract-level, coexists with tenant guarantors)
CREATE TABLE IF NOT EXISTS public.contract_guarantors (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  guarantor_type text NOT NULL DEFAULT 'individual', -- individual, company, insurance
  full_name text NOT NULL,
  document_or_cuit text,
  address text,
  phone text,
  insurance_policy_number text,
  insurance_valid_from date,
  insurance_valid_to date,
  coverage_amount numeric,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.contract_guarantors ENABLE ROW LEVEL SECURITY;

-- RLS: owners can manage guarantors via their contract
CREATE POLICY "Owners can manage contract guarantors via contract"
  ON public.contract_guarantors
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.contracts c
      JOIN public.properties p ON c.property_id = p.id
      WHERE c.id = contract_guarantors.contract_id
        AND p.owner_user_id = auth.uid()
    )
  );

-- Index for fast lookup by contract
CREATE INDEX IF NOT EXISTS idx_contract_guarantors_contract_id
  ON public.contract_guarantors(contract_id);

-- Trigger for updated_at on contract_guarantors
CREATE TRIGGER update_contract_guarantors_updated_at
  BEFORE UPDATE ON public.contract_guarantors
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
