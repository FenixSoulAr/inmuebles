
-- Create payments table linked to obligations
CREATE TABLE public.payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  obligation_id UUID NOT NULL REFERENCES public.obligations(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  paid_at DATE NOT NULL DEFAULT CURRENT_DATE,
  method TEXT NOT NULL DEFAULT 'transfer',
  notes TEXT,
  attachment_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- RLS: owners can manage payments via obligation -> property
CREATE POLICY "Owners can manage payments via obligation"
ON public.payments
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM obligations o
    JOIN properties p ON o.property_id = p.id
    WHERE o.id = payments.obligation_id AND p.owner_user_id = auth.uid()
  )
);

-- Index for fast lookups
CREATE INDEX idx_payments_obligation_id ON public.payments(obligation_id);
