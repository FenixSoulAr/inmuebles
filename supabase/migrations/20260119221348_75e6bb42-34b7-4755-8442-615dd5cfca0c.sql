-- Add notes column to rent_payments
ALTER TABLE public.rent_payments 
ADD COLUMN notes text DEFAULT NULL;

-- Also need to update rent_dues status constraint to allow 'due' status for unpaid items that are not overdue yet
-- First drop the existing constraint
ALTER TABLE public.rent_dues DROP CONSTRAINT IF EXISTS rent_dues_status_check;

-- Add new constraint with 'due' status
ALTER TABLE public.rent_dues 
ADD CONSTRAINT rent_dues_status_check 
CHECK (status IN ('paid', 'partial', 'overdue', 'due'));