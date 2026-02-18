
-- Safe migration: add columns to contracts table only if they don't exist
DO $$
BEGIN
  -- index_notes
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'contracts' AND column_name = 'index_notes'
  ) THEN
    ALTER TABLE public.contracts ADD COLUMN index_notes text;
  END IF;

  -- tenant_insurance_notes
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'contracts' AND column_name = 'tenant_insurance_notes'
  ) THEN
    ALTER TABLE public.contracts ADD COLUMN tenant_insurance_notes text;
  END IF;

  -- pdf_url
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'contracts' AND column_name = 'pdf_url'
  ) THEN
    ALTER TABLE public.contracts ADD COLUMN pdf_url text;
  END IF;

  -- currency (rent) — already exists as 'currency', ensure default
  -- currency_deposit — already exists, ensure default
  -- deposit — already exists
  -- seguro_tipo — already exists
  -- seguro_obligatorio — already exists
END
$$;
