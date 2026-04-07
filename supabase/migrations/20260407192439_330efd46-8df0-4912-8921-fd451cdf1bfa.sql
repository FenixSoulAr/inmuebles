
-- Add auth_user_id column to tenants
ALTER TABLE public.tenants ADD COLUMN auth_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Allow tenants to insert payment proofs for their own contracts
CREATE POLICY "tenant_ins_proof"
ON public.payment_proofs
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM contracts c
    JOIN tenants t ON t.id = c.tenant_id
    WHERE c.id = payment_proofs.contract_id
      AND t.auth_user_id = auth.uid()
  )
);

-- Allow tenants to read their own payment proofs
CREATE POLICY "tenant_sel_proof"
ON public.payment_proofs
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM contracts c
    JOIN tenants t ON t.id = c.tenant_id
    WHERE c.id = payment_proofs.contract_id
      AND t.auth_user_id = auth.uid()
  )
);
