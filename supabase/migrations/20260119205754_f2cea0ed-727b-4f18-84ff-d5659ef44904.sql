-- Create profiles table for owner users
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- RLS policies for profiles
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Properties table
CREATE TABLE public.properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'apartment' CHECK (type IN ('apartment', 'house', 'commercial', 'land', 'other')),
  full_address TEXT NOT NULL,
  internal_identifier TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'vacant' CHECK (status IN ('occupied', 'vacant', 'under_repair')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view own properties" ON public.properties
  FOR SELECT USING (auth.uid() = owner_user_id);

CREATE POLICY "Owners can create properties" ON public.properties
  FOR INSERT WITH CHECK (auth.uid() = owner_user_id);

CREATE POLICY "Owners can update own properties" ON public.properties
  FOR UPDATE USING (auth.uid() = owner_user_id);

CREATE POLICY "Owners can delete own properties" ON public.properties
  FOR DELETE USING (auth.uid() = owner_user_id);

-- Ownership stakes
CREATE TABLE public.ownership_stakes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  holder_type TEXT NOT NULL CHECK (holder_type IN ('person', 'company')),
  holder_name TEXT NOT NULL,
  share_percent DECIMAL(5,2) NOT NULL CHECK (share_percent > 0 AND share_percent <= 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ownership_stakes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage stakes via property" ON public.ownership_stakes
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.properties WHERE properties.id = ownership_stakes.property_id AND properties.owner_user_id = auth.uid())
  );

-- Property documents
CREATE TABLE public.property_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('deed', 'bylaws', 'plans', 'insurance', 'tax', 'other')),
  file_url TEXT NOT NULL,
  original_file_name TEXT NOT NULL,
  generated_name TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.property_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage documents via property" ON public.property_documents
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.properties WHERE properties.id = property_documents.property_id AND properties.owner_user_id = auth.uid())
  );

-- Tenants table
CREATE TABLE public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  doc_id TEXT,
  email TEXT,
  phone TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view own tenants" ON public.tenants
  FOR SELECT USING (auth.uid() = owner_user_id);

CREATE POLICY "Owners can create tenants" ON public.tenants
  FOR INSERT WITH CHECK (auth.uid() = owner_user_id);

CREATE POLICY "Owners can update own tenants" ON public.tenants
  FOR UPDATE USING (auth.uid() = owner_user_id);

CREATE POLICY "Owners can delete own tenants" ON public.tenants
  FOR DELETE USING (auth.uid() = owner_user_id);

-- Guarantors
CREATE TABLE public.guarantors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  contact_info TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.guarantors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage guarantors via tenant" ON public.guarantors
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.tenants WHERE tenants.id = guarantors.tenant_id AND tenants.owner_user_id = auth.uid())
  );

-- Tenancy links (history)
CREATE TABLE public.tenancy_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tenancy_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage tenancy links" ON public.tenancy_links
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.properties WHERE properties.id = tenancy_links.property_id AND properties.owner_user_id = auth.uid())
  );

-- Contracts table
CREATE TABLE public.contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  initial_rent DECIMAL(12,2) NOT NULL,
  current_rent DECIMAL(12,2) NOT NULL,
  deposit DECIMAL(12,2),
  clauses_text TEXT,
  clause_flags JSONB DEFAULT '{}',
  signed_contract_file_url TEXT,
  adjustment_type TEXT NOT NULL DEFAULT 'manual' CHECK (adjustment_type IN ('ipc', 'icl', 'fixed', 'manual')),
  adjustment_frequency INTEGER DEFAULT 12,
  next_adjustment_date DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage contracts via property" ON public.contracts
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.properties WHERE properties.id = contracts.property_id AND properties.owner_user_id = auth.uid())
  );

-- Contract adjustment events
CREATE TABLE public.contract_adjustment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  effective_date DATE NOT NULL,
  previous_rent DECIMAL(12,2) NOT NULL,
  new_rent DECIMAL(12,2) NOT NULL,
  method TEXT NOT NULL CHECK (method IN ('auto', 'manual')),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.contract_adjustment_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage adjustments via contract" ON public.contract_adjustment_events
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.contracts c
      JOIN public.properties p ON c.property_id = p.id
      WHERE c.id = contract_adjustment_events.contract_id AND p.owner_user_id = auth.uid()
    )
  );

-- Rent due records
CREATE TABLE public.rent_dues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  period_month TEXT NOT NULL,
  due_date DATE NOT NULL,
  expected_amount DECIMAL(12,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'overdue' CHECK (status IN ('paid', 'partial', 'overdue')),
  balance_due DECIMAL(12,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.rent_dues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage rent dues via property" ON public.rent_dues
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.properties WHERE properties.id = rent_dues.property_id AND properties.owner_user_id = auth.uid())
  );

-- Rent payments
CREATE TABLE public.rent_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rent_due_id UUID NOT NULL REFERENCES public.rent_dues(id) ON DELETE CASCADE,
  payment_date DATE NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  method TEXT NOT NULL DEFAULT 'transfer' CHECK (method IN ('transfer', 'cash')),
  receipt_file_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.rent_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage payments via rent due" ON public.rent_payments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.rent_dues rd
      JOIN public.properties p ON rd.property_id = p.id
      WHERE rd.id = rent_payments.rent_due_id AND p.owner_user_id = auth.uid()
    )
  );

-- Utility obligations
CREATE TABLE public.utility_obligations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('electricity', 'gas', 'water', 'hoa', 'insurance')),
  payer TEXT NOT NULL CHECK (payer IN ('tenant', 'owner')),
  frequency TEXT NOT NULL DEFAULT 'monthly',
  due_day_of_month INTEGER DEFAULT 10,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.utility_obligations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage utilities via property" ON public.utility_obligations
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.properties WHERE properties.id = utility_obligations.property_id AND properties.owner_user_id = auth.uid())
  );

-- Utility proofs
CREATE TABLE public.utility_proofs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  utility_obligation_id UUID NOT NULL REFERENCES public.utility_obligations(id) ON DELETE CASCADE,
  period_month TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'not_submitted' CHECK (status IN ('paid_with_proof', 'not_submitted', 'overdue')),
  submitted_at TIMESTAMPTZ,
  file_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.utility_proofs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage proofs via utility" ON public.utility_proofs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.utility_obligations uo
      JOIN public.properties p ON uo.property_id = p.id
      WHERE uo.id = utility_proofs.utility_obligation_id AND p.owner_user_id = auth.uid()
    )
  );

-- Maintenance issues
CREATE TABLE public.maintenance_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  reported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  description TEXT NOT NULL,
  requested_by TEXT NOT NULL CHECK (requested_by IN ('tenant', 'owner')),
  payer TEXT NOT NULL CHECK (payer IN ('tenant', 'owner')),
  estimate_amount DECIMAL(12,2),
  receipt_file_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'resolved')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.maintenance_issues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage maintenance via property" ON public.maintenance_issues
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.properties WHERE properties.id = maintenance_issues.property_id AND properties.owner_user_id = auth.uid())
  );

-- Tax obligations
CREATE TABLE public.tax_obligations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('municipal', 'property', 'income')),
  frequency TEXT NOT NULL DEFAULT 'annual',
  due_date DATE NOT NULL,
  responsible TEXT NOT NULL CHECK (responsible IN ('tenant', 'owner')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('ok', 'pending')),
  receipt_file_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tax_obligations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage taxes via property" ON public.tax_obligations
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.properties WHERE properties.id = tax_obligations.property_id AND properties.owner_user_id = auth.uid())
  );

-- Alerts
CREATE TABLE public.alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  related_entity_type TEXT,
  related_entity_id UUID,
  title TEXT NOT NULL,
  description TEXT,
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'done')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view own alerts" ON public.alerts
  FOR SELECT USING (auth.uid() = owner_user_id);

CREATE POLICY "Owners can create alerts" ON public.alerts
  FOR INSERT WITH CHECK (auth.uid() = owner_user_id);

CREATE POLICY "Owners can update own alerts" ON public.alerts
  FOR UPDATE USING (auth.uid() = owner_user_id);

CREATE POLICY "Owners can delete own alerts" ON public.alerts
  FOR DELETE USING (auth.uid() = owner_user_id);

-- Function to update updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_properties_updated_at BEFORE UPDATE ON public.properties
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_contracts_updated_at BEFORE UPDATE ON public.contracts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_rent_dues_updated_at BEFORE UPDATE ON public.rent_dues
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_maintenance_issues_updated_at BEFORE UPDATE ON public.maintenance_issues
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tax_obligations_updated_at BEFORE UPDATE ON public.tax_obligations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for documents
INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', true);

-- Storage policies
CREATE POLICY "Authenticated users can upload documents"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'documents' AND auth.role() = 'authenticated');

CREATE POLICY "Users can view their documents"
ON storage.objects FOR SELECT
USING (bucket_id = 'documents' AND auth.role() = 'authenticated');

CREATE POLICY "Users can delete their documents"
ON storage.objects FOR DELETE
USING (bucket_id = 'documents' AND auth.role() = 'authenticated');