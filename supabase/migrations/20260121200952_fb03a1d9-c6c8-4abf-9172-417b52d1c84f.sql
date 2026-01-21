-- Add amount and notes columns to tax_obligations for editable tax records
ALTER TABLE public.tax_obligations
ADD COLUMN amount numeric NULL,
ADD COLUMN notes text NULL;