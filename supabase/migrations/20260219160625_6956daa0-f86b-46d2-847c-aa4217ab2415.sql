
-- Add booking_channel and deposit_mode to contracts table
ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS booking_channel text DEFAULT 'directo',
  ADD COLUMN IF NOT EXISTS deposit_mode text NOT NULL DEFAULT 'required';

-- Add comments for clarity
COMMENT ON COLUMN public.contracts.booking_channel IS 'Canal de reserva para contratos temporarios: directo, airbnb, booking, otro';
COMMENT ON COLUMN public.contracts.deposit_mode IS 'Modalidad del depósito: required, not_required, platform_covered';
