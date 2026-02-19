
-- ══════════════════════════════════════════════════════════
-- 1. clause_templates: plantillas de cláusulas parametrizables
-- ══════════════════════════════════════════════════════════
CREATE TABLE public.clause_templates (
  id               uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_user_id    uuid        NOT NULL,
  name             text        NOT NULL,
  applies_to       text        NOT NULL DEFAULT 'todos',   -- permanente | temporario | comercial | todos
  is_optional      boolean     NOT NULL DEFAULT true,
  default_enabled  boolean     NOT NULL DEFAULT true,
  template_text    text        NOT NULL DEFAULT '',
  order_default    integer     NOT NULL DEFAULT 0,
  version          integer     NOT NULL DEFAULT 1,
  is_active        boolean     NOT NULL DEFAULT true,
  tags             text        NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.clause_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their clause templates"
  ON public.clause_templates
  FOR ALL
  USING  (auth.uid() = owner_user_id)
  WITH CHECK (auth.uid() = owner_user_id);

-- ══════════════════════════════════════════════════════════
-- 2. contract_clauses: snapshot de cláusulas por contrato
-- ══════════════════════════════════════════════════════════
CREATE TABLE public.contract_clauses (
  id                  uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contract_id         uuid        NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  clause_template_id  uuid        NULL     REFERENCES public.clause_templates(id) ON DELETE SET NULL,
  title               text        NOT NULL,
  rendered_text       text        NOT NULL DEFAULT '',
  order_position      integer     NOT NULL DEFAULT 0,
  enabled             boolean     NOT NULL DEFAULT true,
  source_version      integer     NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.contract_clauses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage contract clauses via contract"
  ON public.contract_clauses
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.contracts c
      JOIN public.properties p ON p.id = c.property_id
      WHERE c.id = contract_clauses.contract_id
        AND p.owner_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.contracts c
      JOIN public.properties p ON p.id = c.property_id
      WHERE c.id = contract_clauses.contract_id
        AND p.owner_user_id = auth.uid()
    )
  );

-- ══════════════════════════════════════════════════════════
-- 3. Agregar campos draft a contracts
-- ══════════════════════════════════════════════════════════
ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS draft_text              text        NULL,
  ADD COLUMN IF NOT EXISTS draft_last_generated_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS draft_status            text        NOT NULL DEFAULT 'no_generado';

-- ══════════════════════════════════════════════════════════
-- 4. Timestamps automáticos
-- ══════════════════════════════════════════════════════════
CREATE TRIGGER update_clause_templates_updated_at
  BEFORE UPDATE ON public.clause_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_contract_clauses_updated_at
  BEFORE UPDATE ON public.contract_clauses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
