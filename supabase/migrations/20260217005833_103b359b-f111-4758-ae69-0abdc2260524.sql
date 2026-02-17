
-- Add rent_due_day and currency to contracts
ALTER TABLE public.contracts 
ADD COLUMN IF NOT EXISTS rent_due_day integer DEFAULT 5,
ADD COLUMN IF NOT EXISTS currency text DEFAULT 'ARS';

-- Create contract_services table
CREATE TABLE public.contract_services (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  service_type text NOT NULL,
  due_day integer DEFAULT 5,
  expected_amount numeric,
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create obligations table
CREATE TABLE public.obligations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  property_id uuid NOT NULL REFERENCES public.properties(id),
  period text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('rent', 'service')),
  service_type text,
  due_date date NOT NULL,
  expected_amount numeric,
  currency text DEFAULT 'ARS',
  status text NOT NULL DEFAULT 'pending_send',
  payment_proof_id uuid REFERENCES public.payment_proofs(id),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Unique index using COALESCE for the composite key
CREATE UNIQUE INDEX idx_obligations_unique_key 
ON public.obligations(contract_id, period, kind, COALESCE(service_type, '__none__'));

-- Add obligation_id to payment_proofs
ALTER TABLE public.payment_proofs 
ADD COLUMN IF NOT EXISTS obligation_id uuid REFERENCES public.obligations(id);

-- RLS for contract_services
ALTER TABLE public.contract_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage contract services via contract"
ON public.contract_services
FOR ALL
USING (EXISTS (
  SELECT 1 FROM contracts c
  JOIN properties p ON c.property_id = p.id
  WHERE c.id = contract_services.contract_id
  AND p.owner_user_id = auth.uid()
));

-- RLS for obligations
ALTER TABLE public.obligations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage obligations via property"
ON public.obligations
FOR ALL
USING (EXISTS (
  SELECT 1 FROM properties p
  WHERE p.id = obligations.property_id
  AND p.owner_user_id = auth.uid()
));

-- Indexes
CREATE INDEX idx_obligations_contract_period ON public.obligations(contract_id, period);
CREATE INDEX idx_obligations_status ON public.obligations(status);
CREATE INDEX idx_contract_services_contract ON public.contract_services(contract_id);
