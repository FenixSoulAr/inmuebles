
-- Add professional contract generation fields to contracts table
ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS tipo_contrato text DEFAULT 'vivienda',
  ADD COLUMN IF NOT EXISTS usa_seguro boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS seguro_tipo text DEFAULT null,
  ADD COLUMN IF NOT EXISTS seguro_obligatorio boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS expensas_ordinarias boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS expensas_extraordinarias boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS impuestos_a_cargo_locatario boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS permite_subalquiler boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS permite_mascotas boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS texto_contrato text DEFAULT null;
