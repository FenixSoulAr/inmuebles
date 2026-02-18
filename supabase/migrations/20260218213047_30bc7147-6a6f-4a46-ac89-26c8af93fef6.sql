
-- ══════════════════════════════════════════════════════════
-- 1. OWNERS master table
-- ══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.owners (
  id            uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_user_id uuid        NOT NULL,   -- which app-user created this owner record
  full_name     text        NOT NULL,
  dni_cuit      text        ,
  address       text        ,
  email         text        ,
  phone         text        ,
  notes         text        ,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.owners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners: users manage their own owner records"
  ON public.owners FOR ALL
  USING (auth.uid() = owner_user_id)
  WITH CHECK (auth.uid() = owner_user_id);

CREATE TRIGGER update_owners_updated_at
  BEFORE UPDATE ON public.owners
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ══════════════════════════════════════════════════════════
-- 2. PROPERTY_OWNERS join table  (multiple owners per property)
-- ══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.property_owners (
  id                uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id       uuid        NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  owner_id          uuid        NOT NULL REFERENCES public.owners(id) ON DELETE CASCADE,
  ownership_percent numeric     ,   -- nullable: not always known
  role              text        ,   -- e.g. 'titular', 'cotitular', 'apoderado'
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (property_id, owner_id)
);

ALTER TABLE public.property_owners ENABLE ROW LEVEL SECURITY;

-- Access via property ownership
CREATE POLICY "PropertyOwners: manage via property"
  ON public.property_owners FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.properties p
      WHERE p.id = property_owners.property_id
        AND p.owner_user_id = auth.uid()
    )
  );

-- ══════════════════════════════════════════════════════════
-- 3. Extend contract_guarantors with new fields
--    (table already exists – add columns safely)
-- ══════════════════════════════════════════════════════════
ALTER TABLE public.contract_guarantors
  ADD COLUMN IF NOT EXISTS guarantee_type text DEFAULT 'fiador_solidario',
  ADD COLUMN IF NOT EXISTS company_name   text,
  ADD COLUMN IF NOT EXISTS email          text,
  ADD COLUMN IF NOT EXISTS sort_order     integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS details        jsonb;
