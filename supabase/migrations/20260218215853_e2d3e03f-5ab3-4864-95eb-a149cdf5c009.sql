
-- ═══════════════════════════════════════════════════════════
-- documents table: unified store for property & contract docs
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.documents (
  id            uuid                     PRIMARY KEY DEFAULT gen_random_uuid(),
  scope         text                     NOT NULL CHECK (scope IN ('property', 'contract')),
  property_id   uuid                     REFERENCES public.properties(id) ON DELETE CASCADE,
  contract_id   uuid                     REFERENCES public.contracts(id) ON DELETE CASCADE,
  doc_type      text                     NOT NULL DEFAULT 'otros',
  title         text                     NOT NULL,
  file_url      text                     NOT NULL,
  file_name     text,
  mime_type     text,
  file_size     bigint,
  notes         text,
  created_by    uuid                     NOT NULL DEFAULT auth.uid(),
  created_at    timestamptz              NOT NULL DEFAULT now()
);

-- Enforce scope constraints via trigger (more robust than CHECK for cross-col)
CREATE OR REPLACE FUNCTION public.documents_scope_check()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.scope = 'property' THEN
    IF NEW.property_id IS NULL THEN
      RAISE EXCEPTION 'property_id is required when scope = property';
    END IF;
    IF NEW.contract_id IS NOT NULL THEN
      RAISE EXCEPTION 'contract_id must be NULL when scope = property';
    END IF;
  ELSIF NEW.scope = 'contract' THEN
    IF NEW.contract_id IS NULL THEN
      RAISE EXCEPTION 'contract_id is required when scope = contract';
    END IF;
    IF NEW.property_id IS NOT NULL THEN
      RAISE EXCEPTION 'property_id must be NULL when scope = contract';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER documents_scope_check_trigger
  BEFORE INSERT OR UPDATE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.documents_scope_check();

-- RLS
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- Property-scoped docs: user owns the property
CREATE POLICY "Documents: property scope via property ownership"
  ON public.documents
  FOR ALL
  USING (
    (scope = 'property' AND EXISTS (
      SELECT 1 FROM public.properties p
      WHERE p.id = documents.property_id AND p.owner_user_id = auth.uid()
    ))
    OR
    (scope = 'contract' AND EXISTS (
      SELECT 1 FROM public.contracts c
      JOIN public.properties p ON p.id = c.property_id
      WHERE c.id = documents.contract_id AND p.owner_user_id = auth.uid()
    ))
  )
  WITH CHECK (
    (scope = 'property' AND EXISTS (
      SELECT 1 FROM public.properties p
      WHERE p.id = documents.property_id AND p.owner_user_id = auth.uid()
    ))
    OR
    (scope = 'contract' AND EXISTS (
      SELECT 1 FROM public.contracts c
      JOIN public.properties p ON p.id = c.property_id
      WHERE c.id = documents.contract_id AND p.owner_user_id = auth.uid()
    ))
  );

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_documents_property_id ON public.documents(property_id);
CREATE INDEX IF NOT EXISTS idx_documents_contract_id ON public.documents(contract_id);
CREATE INDEX IF NOT EXISTS idx_documents_scope       ON public.documents(scope);
