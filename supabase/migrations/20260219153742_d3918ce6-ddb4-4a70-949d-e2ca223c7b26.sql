
-- Add new fields to contracts table for full contract type support

-- price_mode: how the price is structured (monthly, daily, weekly, full stay)
ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS price_mode text NOT NULL DEFAULT 'mensual'
    CHECK (price_mode IN ('mensual', 'diario', 'semanal', 'total_estadia'));

-- has_price_update: whether contract has periodic price adjustments
ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS has_price_update boolean NOT NULL DEFAULT false;

-- deposit_type: how the deposit is expressed
ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS deposit_type text NOT NULL DEFAULT 'monto_fijo'
    CHECK (deposit_type IN ('monto_fijo', 'equivalente_dias', 'equivalente_meses'));

-- update_percentage: for fixed % adjustments (complements existing adjustment_type)
ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS update_percentage numeric NULL;

-- Ensure tipo_contrato supports permanente / temporario / comercial
-- (existing column is text so values are flexible, but set a good default)
ALTER TABLE public.contracts
  ALTER COLUMN tipo_contrato SET DEFAULT 'permanente';

-- Backfill: map existing 'vivienda' → 'permanente' for consistency
UPDATE public.contracts SET tipo_contrato = 'permanente' WHERE tipo_contrato = 'vivienda' OR tipo_contrato IS NULL;

-- Backfill has_price_update from existing adjustment_type
UPDATE public.contracts SET has_price_update = true WHERE adjustment_type != 'manual';

-- Backfill price_mode (all existing are monthly by definition)
UPDATE public.contracts SET price_mode = 'mensual' WHERE price_mode IS NULL;

-- Backfill deposit_type
UPDATE public.contracts SET deposit_type = 'monto_fijo' WHERE deposit_type IS NULL;
