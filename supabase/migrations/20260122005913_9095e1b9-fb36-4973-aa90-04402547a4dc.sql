-- Drop the existing constraint and create a new one with the correct values
ALTER TABLE public.tenants DROP CONSTRAINT tenants_status_check;

ALTER TABLE public.tenants 
ADD CONSTRAINT tenants_status_check 
CHECK (status = ANY (ARRAY['active'::text, 'inactive'::text]));

-- Backfill any null status values to 'active' and update 'ended' to 'inactive'
UPDATE public.tenants SET status = 'active' WHERE status IS NULL;
UPDATE public.tenants SET status = 'inactive' WHERE status = 'ended';