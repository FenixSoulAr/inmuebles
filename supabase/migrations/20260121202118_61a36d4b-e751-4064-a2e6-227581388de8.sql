-- Add active column to tax_obligations for soft delete functionality
ALTER TABLE public.tax_obligations
ADD COLUMN active boolean NOT NULL DEFAULT true;