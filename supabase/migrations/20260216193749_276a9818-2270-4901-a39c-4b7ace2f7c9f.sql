
-- Create property_valuations table for valuation history
CREATE TABLE public.property_valuations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  valuation_amount NUMERIC NOT NULL,
  valuation_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.property_valuations ENABLE ROW LEVEL SECURITY;

-- RLS policy: owners can manage valuations via property
CREATE POLICY "Owners can manage valuations via property"
ON public.property_valuations
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM properties
    WHERE properties.id = property_valuations.property_id
    AND properties.owner_user_id = auth.uid()
  )
);

-- Index for faster lookups
CREATE INDEX idx_property_valuations_property_id ON public.property_valuations(property_id);
CREATE INDEX idx_property_valuations_date ON public.property_valuations(valuation_date DESC);
