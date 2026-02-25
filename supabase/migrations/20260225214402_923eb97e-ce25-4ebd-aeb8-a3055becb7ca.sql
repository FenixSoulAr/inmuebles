
-- ============================================================
-- MULTI-TENANT: Correct order migration
-- ============================================================

-- 1. Create tables
CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE TYPE public.project_role AS ENUM ('owner', 'admin', 'collaborator', 'viewer');
CREATE TYPE public.membership_status AS ENUM ('active', 'invited', 'removed');

CREATE TABLE public.project_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.project_role NOT NULL DEFAULT 'collaborator',
  status public.membership_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(project_id, user_id)
);
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_pm_user ON public.project_members(user_id);
CREATE INDEX idx_pm_project ON public.project_members(project_id);

CREATE TABLE public.project_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  email text NOT NULL,
  role public.project_role NOT NULL DEFAULT 'collaborator',
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  status text NOT NULL DEFAULT 'pending',
  invited_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at timestamptz
);
ALTER TABLE public.project_invites ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_pi_token ON public.project_invites(token);
CREATE INDEX idx_pi_project ON public.project_invites(project_id);

-- 2. Security definer helpers
CREATE OR REPLACE FUNCTION public.is_project_member(_uid uuid, _pid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM project_members WHERE user_id=_uid AND project_id=_pid AND status='active')
$$;

CREATE OR REPLACE FUNCTION public.get_project_role(_uid uuid, _pid uuid)
RETURNS public.project_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM project_members WHERE user_id=_uid AND project_id=_pid AND status='active' LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.has_write_role(_uid uuid, _pid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM project_members WHERE user_id=_uid AND project_id=_pid AND status='active' AND role IN ('owner','admin','collaborator'))
$$;

CREATE OR REPLACE FUNCTION public.has_admin_role(_uid uuid, _pid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM project_members WHERE user_id=_uid AND project_id=_pid AND status='active' AND role IN ('owner','admin'))
$$;

-- 3. accept_invite RPC
CREATE OR REPLACE FUNCTION public.accept_invite(_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_invite record; v_uid uuid; v_email text;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RETURN '{"error":"not_authenticated"}'::jsonb; END IF;
  SELECT email INTO v_email FROM auth.users WHERE id = v_uid;
  SELECT * INTO v_invite FROM project_invites WHERE token=_token AND status='pending' AND expires_at>now();
  IF v_invite IS NULL THEN RETURN '{"error":"invite_invalid_or_expired"}'::jsonb; END IF;
  IF lower(v_invite.email) != lower(v_email) THEN RETURN '{"error":"email_mismatch"}'::jsonb; END IF;
  INSERT INTO project_members (project_id, user_id, role, status)
    VALUES (v_invite.project_id, v_uid, v_invite.role, 'active')
    ON CONFLICT (project_id, user_id) DO UPDATE SET role=v_invite.role, status='active';
  UPDATE project_invites SET status='accepted', accepted_at=now() WHERE id=v_invite.id;
  RETURN jsonb_build_object('success',true,'project_id',v_invite.project_id,'role',v_invite.role::text);
END;
$$;

-- 4. RLS for new tables
CREATE POLICY "sel_projects" ON public.projects FOR SELECT USING (is_project_member(auth.uid(), id));
CREATE POLICY "ins_projects" ON public.projects FOR INSERT TO authenticated WITH CHECK (auth.uid()=created_by);
CREATE POLICY "upd_projects" ON public.projects FOR UPDATE USING (get_project_role(auth.uid(), id)='owner');
CREATE POLICY "del_projects" ON public.projects FOR DELETE USING (get_project_role(auth.uid(), id)='owner');

CREATE POLICY "sel_pm" ON public.project_members FOR SELECT USING (is_project_member(auth.uid(), project_id));
CREATE POLICY "ins_pm" ON public.project_members FOR INSERT TO authenticated WITH CHECK (has_admin_role(auth.uid(), project_id));
CREATE POLICY "upd_pm" ON public.project_members FOR UPDATE USING (has_admin_role(auth.uid(), project_id));
CREATE POLICY "del_pm" ON public.project_members FOR DELETE USING (has_admin_role(auth.uid(), project_id));

CREATE POLICY "sel_pi" ON public.project_invites FOR SELECT USING (is_project_member(auth.uid(), project_id));
CREATE POLICY "ins_pi" ON public.project_invites FOR INSERT TO authenticated WITH CHECK (has_admin_role(auth.uid(), project_id));
CREATE POLICY "upd_pi" ON public.project_invites FOR UPDATE USING (has_admin_role(auth.uid(), project_id));
CREATE POLICY "del_pi" ON public.project_invites FOR DELETE USING (has_admin_role(auth.uid(), project_id));

-- ============================================================
-- 5. DROP ALL OLD RLS POLICIES FIRST (before touching columns)
-- ============================================================
-- Direct owner_user_id policies
DROP POLICY IF EXISTS "Owners can create properties" ON public.properties;
DROP POLICY IF EXISTS "Owners can delete own properties" ON public.properties;
DROP POLICY IF EXISTS "Owners can update own properties" ON public.properties;
DROP POLICY IF EXISTS "Owners can view own properties" ON public.properties;
DROP POLICY IF EXISTS "Owners can create tenants" ON public.tenants;
DROP POLICY IF EXISTS "Owners can delete own tenants" ON public.tenants;
DROP POLICY IF EXISTS "Owners can update own tenants" ON public.tenants;
DROP POLICY IF EXISTS "Owners can view own tenants" ON public.tenants;
DROP POLICY IF EXISTS "Owners: users manage their own owner records" ON public.owners;
DROP POLICY IF EXISTS "Owners can create alerts" ON public.alerts;
DROP POLICY IF EXISTS "Owners can delete own alerts" ON public.alerts;
DROP POLICY IF EXISTS "Owners can update own alerts" ON public.alerts;
DROP POLICY IF EXISTS "Owners can view own alerts" ON public.alerts;
DROP POLICY IF EXISTS "Owners manage their clause templates" ON public.clause_templates;

-- Join-based policies referencing properties.owner_user_id
DROP POLICY IF EXISTS "Owners can manage contracts via property" ON public.contracts;
DROP POLICY IF EXISTS "Owners manage contract clauses via contract" ON public.contract_clauses;
DROP POLICY IF EXISTS "Owners can manage contract services via contract" ON public.contract_services;
DROP POLICY IF EXISTS "Owners can manage contract documents via contract" ON public.contract_documents;
DROP POLICY IF EXISTS "Owners can manage contract guarantors via contract" ON public.contract_guarantors;
DROP POLICY IF EXISTS "Owners can manage contract adjustments via contract" ON public.contract_adjustments;
DROP POLICY IF EXISTS "Owners can manage adjustments via contract" ON public.contract_adjustment_events;
DROP POLICY IF EXISTS "Owners can manage obligations via property" ON public.obligations;
DROP POLICY IF EXISTS "Owners can manage proofs via contract" ON public.payment_proofs;
DROP POLICY IF EXISTS "Owners can manage payments via obligation" ON public.payments;
DROP POLICY IF EXISTS "Owners can manage rent dues via property" ON public.rent_dues;
DROP POLICY IF EXISTS "Owners can manage payments via rent due" ON public.rent_payments;
DROP POLICY IF EXISTS "Owners can manage tenancy links" ON public.tenancy_links;
DROP POLICY IF EXISTS "Owners can manage guarantors via tenant" ON public.guarantors;
DROP POLICY IF EXISTS "PropertyOwners: manage via property" ON public.property_owners;
DROP POLICY IF EXISTS "Owners can manage valuations via property" ON public.property_valuations;
DROP POLICY IF EXISTS "Owners can manage documents via property" ON public.property_documents;
DROP POLICY IF EXISTS "Owners can manage stakes via property" ON public.ownership_stakes;
DROP POLICY IF EXISTS "Owners can manage maintenance via property" ON public.maintenance_issues;
DROP POLICY IF EXISTS "Owners can manage taxes via property" ON public.tax_obligations;
DROP POLICY IF EXISTS "Owners can manage utilities via property" ON public.utility_obligations;
DROP POLICY IF EXISTS "Owners can manage proofs via utility" ON public.utility_proofs;
DROP POLICY IF EXISTS "Documents: property scope via property ownership" ON public.documents;

-- Storage policies
DROP POLICY IF EXISTS "proof_files_select_owner" ON storage.objects;
DROP POLICY IF EXISTS "proof_files_delete_owner" ON storage.objects;
DROP POLICY IF EXISTS "contract_docs_insert_owner" ON storage.objects;
DROP POLICY IF EXISTS "contract_docs_select_owner" ON storage.objects;
DROP POLICY IF EXISTS "contract_docs_delete_owner" ON storage.objects;

-- ============================================================
-- 6. Add project_id columns (nullable first)
-- ============================================================
ALTER TABLE public.properties ADD COLUMN project_id uuid REFERENCES public.projects(id);
ALTER TABLE public.tenants ADD COLUMN project_id uuid REFERENCES public.projects(id);
ALTER TABLE public.owners ADD COLUMN project_id uuid REFERENCES public.projects(id);
ALTER TABLE public.clause_templates ADD COLUMN project_id uuid REFERENCES public.projects(id);
ALTER TABLE public.alerts ADD COLUMN project_id uuid REFERENCES public.projects(id);
ALTER TABLE public.contracts ADD COLUMN project_id uuid REFERENCES public.projects(id);
ALTER TABLE public.contract_clauses ADD COLUMN project_id uuid REFERENCES public.projects(id);
ALTER TABLE public.contract_services ADD COLUMN project_id uuid REFERENCES public.projects(id);
ALTER TABLE public.contract_documents ADD COLUMN project_id uuid REFERENCES public.projects(id);
ALTER TABLE public.contract_guarantors ADD COLUMN project_id uuid REFERENCES public.projects(id);
ALTER TABLE public.contract_adjustments ADD COLUMN project_id uuid REFERENCES public.projects(id);
ALTER TABLE public.contract_adjustment_events ADD COLUMN project_id uuid REFERENCES public.projects(id);
ALTER TABLE public.obligations ADD COLUMN project_id uuid REFERENCES public.projects(id);
ALTER TABLE public.payment_proofs ADD COLUMN project_id uuid REFERENCES public.projects(id);
ALTER TABLE public.payments ADD COLUMN project_id uuid REFERENCES public.projects(id);
ALTER TABLE public.rent_dues ADD COLUMN project_id uuid REFERENCES public.projects(id);
ALTER TABLE public.rent_payments ADD COLUMN project_id uuid REFERENCES public.projects(id);
ALTER TABLE public.tenancy_links ADD COLUMN project_id uuid REFERENCES public.projects(id);
ALTER TABLE public.guarantors ADD COLUMN project_id uuid REFERENCES public.projects(id);
ALTER TABLE public.property_owners ADD COLUMN project_id uuid REFERENCES public.projects(id);
ALTER TABLE public.property_valuations ADD COLUMN project_id uuid REFERENCES public.projects(id);
ALTER TABLE public.property_documents ADD COLUMN project_id uuid REFERENCES public.projects(id);
ALTER TABLE public.ownership_stakes ADD COLUMN project_id uuid REFERENCES public.projects(id);
ALTER TABLE public.maintenance_issues ADD COLUMN project_id uuid REFERENCES public.projects(id);
ALTER TABLE public.tax_obligations ADD COLUMN project_id uuid REFERENCES public.projects(id);
ALTER TABLE public.utility_obligations ADD COLUMN project_id uuid REFERENCES public.projects(id);
ALTER TABLE public.utility_proofs ADD COLUMN project_id uuid REFERENCES public.projects(id);
ALTER TABLE public.documents ADD COLUMN project_id uuid REFERENCES public.projects(id);

-- ============================================================
-- 7. Backfill: create project per unique owner_user_id
-- ============================================================
INSERT INTO public.projects (id, name, created_by)
SELECT gen_random_uuid(), 'Mi Proyecto', uid FROM (
  SELECT DISTINCT owner_user_id AS uid FROM public.properties
  UNION SELECT DISTINCT owner_user_id FROM public.tenants
  UNION SELECT DISTINCT owner_user_id FROM public.owners
  UNION SELECT DISTINCT owner_user_id FROM public.clause_templates
  UNION SELECT DISTINCT owner_user_id FROM public.alerts
) t;

INSERT INTO public.project_members (project_id, user_id, role, status)
SELECT p.id, p.created_by, 'owner', 'active' FROM public.projects p;

-- Backfill project_id on tables with owner_user_id
UPDATE public.properties SET project_id = (SELECT p.id FROM projects p WHERE p.created_by=properties.owner_user_id LIMIT 1);
UPDATE public.tenants SET project_id = (SELECT p.id FROM projects p WHERE p.created_by=tenants.owner_user_id LIMIT 1);
UPDATE public.owners SET project_id = (SELECT p.id FROM projects p WHERE p.created_by=owners.owner_user_id LIMIT 1);
UPDATE public.clause_templates SET project_id = (SELECT p.id FROM projects p WHERE p.created_by=clause_templates.owner_user_id LIMIT 1);
UPDATE public.alerts SET project_id = (SELECT p.id FROM projects p WHERE p.created_by=alerts.owner_user_id LIMIT 1);

-- Backfill via joins
UPDATE public.contracts SET project_id = (SELECT pr.project_id FROM properties pr WHERE pr.id=contracts.property_id LIMIT 1);
UPDATE public.contract_clauses SET project_id = (SELECT c.project_id FROM contracts c WHERE c.id=contract_clauses.contract_id LIMIT 1);
UPDATE public.contract_services SET project_id = (SELECT c.project_id FROM contracts c WHERE c.id=contract_services.contract_id LIMIT 1);
UPDATE public.contract_documents SET project_id = (SELECT c.project_id FROM contracts c WHERE c.id=contract_documents.contract_id LIMIT 1);
UPDATE public.contract_guarantors SET project_id = (SELECT c.project_id FROM contracts c WHERE c.id=contract_guarantors.contract_id LIMIT 1);
UPDATE public.contract_adjustments SET project_id = (SELECT c.project_id FROM contracts c WHERE c.id=contract_adjustments.contract_id LIMIT 1);
UPDATE public.contract_adjustment_events SET project_id = (SELECT c.project_id FROM contracts c WHERE c.id=contract_adjustment_events.contract_id LIMIT 1);
UPDATE public.obligations SET project_id = (SELECT pr.project_id FROM properties pr WHERE pr.id=obligations.property_id LIMIT 1);
UPDATE public.payment_proofs SET project_id = (SELECT c.project_id FROM contracts c WHERE c.id=payment_proofs.contract_id LIMIT 1);
UPDATE public.payments SET project_id = (SELECT o.project_id FROM obligations o WHERE o.id=payments.obligation_id LIMIT 1);
UPDATE public.rent_dues SET project_id = (SELECT pr.project_id FROM properties pr WHERE pr.id=rent_dues.property_id LIMIT 1);
UPDATE public.rent_payments SET project_id = (SELECT rd.project_id FROM rent_dues rd WHERE rd.id=rent_payments.rent_due_id LIMIT 1);
UPDATE public.tenancy_links SET project_id = (SELECT pr.project_id FROM properties pr WHERE pr.id=tenancy_links.property_id LIMIT 1);
UPDATE public.guarantors SET project_id = (SELECT t.project_id FROM tenants t WHERE t.id=guarantors.tenant_id LIMIT 1);
UPDATE public.property_owners SET project_id = (SELECT pr.project_id FROM properties pr WHERE pr.id=property_owners.property_id LIMIT 1);
UPDATE public.property_valuations SET project_id = (SELECT pr.project_id FROM properties pr WHERE pr.id=property_valuations.property_id LIMIT 1);
UPDATE public.property_documents SET project_id = (SELECT pr.project_id FROM properties pr WHERE pr.id=property_documents.property_id LIMIT 1);
UPDATE public.ownership_stakes SET project_id = (SELECT pr.project_id FROM properties pr WHERE pr.id=ownership_stakes.property_id LIMIT 1);
UPDATE public.maintenance_issues SET project_id = (SELECT pr.project_id FROM properties pr WHERE pr.id=maintenance_issues.property_id LIMIT 1);
UPDATE public.tax_obligations SET project_id = (SELECT pr.project_id FROM properties pr WHERE pr.id=tax_obligations.property_id LIMIT 1);
UPDATE public.utility_obligations SET project_id = (SELECT pr.project_id FROM properties pr WHERE pr.id=utility_obligations.property_id LIMIT 1);
UPDATE public.utility_proofs SET project_id = (SELECT uo.project_id FROM utility_obligations uo WHERE uo.id=utility_proofs.utility_obligation_id LIMIT 1);
UPDATE public.documents SET project_id = CASE
  WHEN property_id IS NOT NULL THEN (SELECT pr.project_id FROM properties pr WHERE pr.id=documents.property_id LIMIT 1)
  WHEN contract_id IS NOT NULL THEN (SELECT c.project_id FROM contracts c WHERE c.id=documents.contract_id LIMIT 1)
  ELSE NULL END;

-- ============================================================
-- 8. Make NOT NULL + indexes
-- ============================================================
ALTER TABLE public.properties ALTER COLUMN project_id SET NOT NULL;
ALTER TABLE public.tenants ALTER COLUMN project_id SET NOT NULL;
ALTER TABLE public.owners ALTER COLUMN project_id SET NOT NULL;
ALTER TABLE public.clause_templates ALTER COLUMN project_id SET NOT NULL;
ALTER TABLE public.alerts ALTER COLUMN project_id SET NOT NULL;
ALTER TABLE public.contracts ALTER COLUMN project_id SET NOT NULL;
ALTER TABLE public.contract_clauses ALTER COLUMN project_id SET NOT NULL;
ALTER TABLE public.contract_services ALTER COLUMN project_id SET NOT NULL;
ALTER TABLE public.contract_documents ALTER COLUMN project_id SET NOT NULL;
ALTER TABLE public.contract_guarantors ALTER COLUMN project_id SET NOT NULL;
ALTER TABLE public.contract_adjustments ALTER COLUMN project_id SET NOT NULL;
ALTER TABLE public.contract_adjustment_events ALTER COLUMN project_id SET NOT NULL;
ALTER TABLE public.obligations ALTER COLUMN project_id SET NOT NULL;
ALTER TABLE public.payment_proofs ALTER COLUMN project_id SET NOT NULL;
ALTER TABLE public.payments ALTER COLUMN project_id SET NOT NULL;
ALTER TABLE public.rent_dues ALTER COLUMN project_id SET NOT NULL;
ALTER TABLE public.rent_payments ALTER COLUMN project_id SET NOT NULL;
ALTER TABLE public.tenancy_links ALTER COLUMN project_id SET NOT NULL;
ALTER TABLE public.guarantors ALTER COLUMN project_id SET NOT NULL;
ALTER TABLE public.property_owners ALTER COLUMN project_id SET NOT NULL;
ALTER TABLE public.property_valuations ALTER COLUMN project_id SET NOT NULL;
ALTER TABLE public.property_documents ALTER COLUMN project_id SET NOT NULL;
ALTER TABLE public.ownership_stakes ALTER COLUMN project_id SET NOT NULL;
ALTER TABLE public.maintenance_issues ALTER COLUMN project_id SET NOT NULL;
ALTER TABLE public.tax_obligations ALTER COLUMN project_id SET NOT NULL;
ALTER TABLE public.utility_obligations ALTER COLUMN project_id SET NOT NULL;
ALTER TABLE public.utility_proofs ALTER COLUMN project_id SET NOT NULL;
ALTER TABLE public.documents ALTER COLUMN project_id SET NOT NULL;

CREATE INDEX idx_prop_proj ON public.properties(project_id);
CREATE INDEX idx_ten_proj ON public.tenants(project_id);
CREATE INDEX idx_own_proj ON public.owners(project_id);
CREATE INDEX idx_con_proj ON public.contracts(project_id);
CREATE INDEX idx_obl_proj ON public.obligations(project_id);
CREATE INDEX idx_pp_proj ON public.payment_proofs(project_id);
CREATE INDEX idx_rd_proj ON public.rent_dues(project_id);
CREATE INDEX idx_doc_proj ON public.documents(project_id);
CREATE INDEX idx_alt_proj ON public.alerts(project_id);
CREATE INDEX idx_ct_proj ON public.clause_templates(project_id);
CREATE INDEX idx_mi_proj ON public.maintenance_issues(project_id);
CREATE INDEX idx_to_proj ON public.tax_obligations(project_id);
CREATE INDEX idx_uo_proj ON public.utility_obligations(project_id);

-- ============================================================
-- 9. Drop owner_user_id
-- ============================================================
ALTER TABLE public.properties DROP COLUMN owner_user_id;
ALTER TABLE public.tenants DROP COLUMN owner_user_id;
ALTER TABLE public.owners DROP COLUMN owner_user_id;
ALTER TABLE public.clause_templates DROP COLUMN owner_user_id;
ALTER TABLE public.alerts DROP COLUMN owner_user_id;

-- ============================================================
-- 10. Create new RLS policies on all business tables
-- ============================================================
CREATE POLICY "m_sel" ON public.properties FOR SELECT USING (is_project_member(auth.uid(), project_id));
CREATE POLICY "m_ins" ON public.properties FOR INSERT WITH CHECK (has_write_role(auth.uid(), project_id));
CREATE POLICY "m_upd" ON public.properties FOR UPDATE USING (has_write_role(auth.uid(), project_id));
CREATE POLICY "m_del" ON public.properties FOR DELETE USING (has_admin_role(auth.uid(), project_id));

CREATE POLICY "m_sel" ON public.tenants FOR SELECT USING (is_project_member(auth.uid(), project_id));
CREATE POLICY "m_ins" ON public.tenants FOR INSERT WITH CHECK (has_write_role(auth.uid(), project_id));
CREATE POLICY "m_upd" ON public.tenants FOR UPDATE USING (has_write_role(auth.uid(), project_id));
CREATE POLICY "m_del" ON public.tenants FOR DELETE USING (has_admin_role(auth.uid(), project_id));

CREATE POLICY "m_sel" ON public.owners FOR SELECT USING (is_project_member(auth.uid(), project_id));
CREATE POLICY "m_ins" ON public.owners FOR INSERT WITH CHECK (has_write_role(auth.uid(), project_id));
CREATE POLICY "m_upd" ON public.owners FOR UPDATE USING (has_write_role(auth.uid(), project_id));
CREATE POLICY "m_del" ON public.owners FOR DELETE USING (has_admin_role(auth.uid(), project_id));

CREATE POLICY "m_sel" ON public.alerts FOR SELECT USING (is_project_member(auth.uid(), project_id));
CREATE POLICY "m_ins" ON public.alerts FOR INSERT WITH CHECK (has_write_role(auth.uid(), project_id));
CREATE POLICY "m_upd" ON public.alerts FOR UPDATE USING (has_write_role(auth.uid(), project_id));
CREATE POLICY "m_del" ON public.alerts FOR DELETE USING (has_admin_role(auth.uid(), project_id));

CREATE POLICY "m_sel" ON public.clause_templates FOR SELECT USING (is_project_member(auth.uid(), project_id));
CREATE POLICY "m_ins" ON public.clause_templates FOR INSERT WITH CHECK (has_write_role(auth.uid(), project_id));
CREATE POLICY "m_upd" ON public.clause_templates FOR UPDATE USING (has_write_role(auth.uid(), project_id));
CREATE POLICY "m_del" ON public.clause_templates FOR DELETE USING (has_admin_role(auth.uid(), project_id));

CREATE POLICY "m_sel" ON public.contracts FOR SELECT USING (is_project_member(auth.uid(), project_id));
CREATE POLICY "m_ins" ON public.contracts FOR INSERT WITH CHECK (has_write_role(auth.uid(), project_id));
CREATE POLICY "m_upd" ON public.contracts FOR UPDATE USING (has_write_role(auth.uid(), project_id));
CREATE POLICY "m_del" ON public.contracts FOR DELETE USING (has_admin_role(auth.uid(), project_id));

CREATE POLICY "m_sel" ON public.contract_clauses FOR SELECT USING (is_project_member(auth.uid(), project_id));
CREATE POLICY "m_ins" ON public.contract_clauses FOR INSERT WITH CHECK (has_write_role(auth.uid(), project_id));
CREATE POLICY "m_upd" ON public.contract_clauses FOR UPDATE USING (has_write_role(auth.uid(), project_id));
CREATE POLICY "m_del" ON public.contract_clauses FOR DELETE USING (has_admin_role(auth.uid(), project_id));

CREATE POLICY "m_sel" ON public.contract_services FOR SELECT USING (is_project_member(auth.uid(), project_id));
CREATE POLICY "m_ins" ON public.contract_services FOR INSERT WITH CHECK (has_write_role(auth.uid(), project_id));
CREATE POLICY "m_upd" ON public.contract_services FOR UPDATE USING (has_write_role(auth.uid(), project_id));
CREATE POLICY "m_del" ON public.contract_services FOR DELETE USING (has_admin_role(auth.uid(), project_id));

CREATE POLICY "m_sel" ON public.contract_documents FOR SELECT USING (is_project_member(auth.uid(), project_id));
CREATE POLICY "m_ins" ON public.contract_documents FOR INSERT WITH CHECK (has_write_role(auth.uid(), project_id));
CREATE POLICY "m_upd" ON public.contract_documents FOR UPDATE USING (has_write_role(auth.uid(), project_id));
CREATE POLICY "m_del" ON public.contract_documents FOR DELETE USING (has_admin_role(auth.uid(), project_id));

CREATE POLICY "m_sel" ON public.contract_guarantors FOR SELECT USING (is_project_member(auth.uid(), project_id));
CREATE POLICY "m_ins" ON public.contract_guarantors FOR INSERT WITH CHECK (has_write_role(auth.uid(), project_id));
CREATE POLICY "m_upd" ON public.contract_guarantors FOR UPDATE USING (has_write_role(auth.uid(), project_id));
CREATE POLICY "m_del" ON public.contract_guarantors FOR DELETE USING (has_admin_role(auth.uid(), project_id));

CREATE POLICY "m_sel" ON public.contract_adjustments FOR SELECT USING (is_project_member(auth.uid(), project_id));
CREATE POLICY "m_ins" ON public.contract_adjustments FOR INSERT WITH CHECK (has_write_role(auth.uid(), project_id));
CREATE POLICY "m_upd" ON public.contract_adjustments FOR UPDATE USING (has_write_role(auth.uid(), project_id));
CREATE POLICY "m_del" ON public.contract_adjustments FOR DELETE USING (has_admin_role(auth.uid(), project_id));

CREATE POLICY "m_sel" ON public.contract_adjustment_events FOR SELECT USING (is_project_member(auth.uid(), project_id));
CREATE POLICY "m_ins" ON public.contract_adjustment_events FOR INSERT WITH CHECK (has_write_role(auth.uid(), project_id));
CREATE POLICY "m_upd" ON public.contract_adjustment_events FOR UPDATE USING (has_write_role(auth.uid(), project_id));
CREATE POLICY "m_del" ON public.contract_adjustment_events FOR DELETE USING (has_admin_role(auth.uid(), project_id));

CREATE POLICY "m_sel" ON public.obligations FOR SELECT USING (is_project_member(auth.uid(), project_id));
CREATE POLICY "m_ins" ON public.obligations FOR INSERT WITH CHECK (has_write_role(auth.uid(), project_id));
CREATE POLICY "m_upd" ON public.obligations FOR UPDATE USING (has_write_role(auth.uid(), project_id));
CREATE POLICY "m_del" ON public.obligations FOR DELETE USING (has_admin_role(auth.uid(), project_id));

CREATE POLICY "m_sel" ON public.payment_proofs FOR SELECT USING (is_project_member(auth.uid(), project_id));
CREATE POLICY "m_ins" ON public.payment_proofs FOR INSERT WITH CHECK (has_write_role(auth.uid(), project_id));
CREATE POLICY "m_upd" ON public.payment_proofs FOR UPDATE USING (has_write_role(auth.uid(), project_id));
CREATE POLICY "m_del" ON public.payment_proofs FOR DELETE USING (has_admin_role(auth.uid(), project_id));

CREATE POLICY "m_sel" ON public.payments FOR SELECT USING (is_project_member(auth.uid(), project_id));
CREATE POLICY "m_ins" ON public.payments FOR INSERT WITH CHECK (has_write_role(auth.uid(), project_id));
CREATE POLICY "m_upd" ON public.payments FOR UPDATE USING (has_write_role(auth.uid(), project_id));
CREATE POLICY "m_del" ON public.payments FOR DELETE USING (has_admin_role(auth.uid(), project_id));

CREATE POLICY "m_sel" ON public.rent_dues FOR SELECT USING (is_project_member(auth.uid(), project_id));
CREATE POLICY "m_ins" ON public.rent_dues FOR INSERT WITH CHECK (has_write_role(auth.uid(), project_id));
CREATE POLICY "m_upd" ON public.rent_dues FOR UPDATE USING (has_write_role(auth.uid(), project_id));
CREATE POLICY "m_del" ON public.rent_dues FOR DELETE USING (has_admin_role(auth.uid(), project_id));

CREATE POLICY "m_sel" ON public.rent_payments FOR SELECT USING (is_project_member(auth.uid(), project_id));
CREATE POLICY "m_ins" ON public.rent_payments FOR INSERT WITH CHECK (has_write_role(auth.uid(), project_id));
CREATE POLICY "m_upd" ON public.rent_payments FOR UPDATE USING (has_write_role(auth.uid(), project_id));
CREATE POLICY "m_del" ON public.rent_payments FOR DELETE USING (has_admin_role(auth.uid(), project_id));

CREATE POLICY "m_sel" ON public.tenancy_links FOR SELECT USING (is_project_member(auth.uid(), project_id));
CREATE POLICY "m_ins" ON public.tenancy_links FOR INSERT WITH CHECK (has_write_role(auth.uid(), project_id));
CREATE POLICY "m_upd" ON public.tenancy_links FOR UPDATE USING (has_write_role(auth.uid(), project_id));
CREATE POLICY "m_del" ON public.tenancy_links FOR DELETE USING (has_admin_role(auth.uid(), project_id));

CREATE POLICY "m_sel" ON public.guarantors FOR SELECT USING (is_project_member(auth.uid(), project_id));
CREATE POLICY "m_ins" ON public.guarantors FOR INSERT WITH CHECK (has_write_role(auth.uid(), project_id));
CREATE POLICY "m_upd" ON public.guarantors FOR UPDATE USING (has_write_role(auth.uid(), project_id));
CREATE POLICY "m_del" ON public.guarantors FOR DELETE USING (has_admin_role(auth.uid(), project_id));

CREATE POLICY "m_sel" ON public.property_owners FOR SELECT USING (is_project_member(auth.uid(), project_id));
CREATE POLICY "m_ins" ON public.property_owners FOR INSERT WITH CHECK (has_write_role(auth.uid(), project_id));
CREATE POLICY "m_upd" ON public.property_owners FOR UPDATE USING (has_write_role(auth.uid(), project_id));
CREATE POLICY "m_del" ON public.property_owners FOR DELETE USING (has_admin_role(auth.uid(), project_id));

CREATE POLICY "m_sel" ON public.property_valuations FOR SELECT USING (is_project_member(auth.uid(), project_id));
CREATE POLICY "m_ins" ON public.property_valuations FOR INSERT WITH CHECK (has_write_role(auth.uid(), project_id));
CREATE POLICY "m_upd" ON public.property_valuations FOR UPDATE USING (has_write_role(auth.uid(), project_id));
CREATE POLICY "m_del" ON public.property_valuations FOR DELETE USING (has_admin_role(auth.uid(), project_id));

CREATE POLICY "m_sel" ON public.property_documents FOR SELECT USING (is_project_member(auth.uid(), project_id));
CREATE POLICY "m_ins" ON public.property_documents FOR INSERT WITH CHECK (has_write_role(auth.uid(), project_id));
CREATE POLICY "m_upd" ON public.property_documents FOR UPDATE USING (has_write_role(auth.uid(), project_id));
CREATE POLICY "m_del" ON public.property_documents FOR DELETE USING (has_admin_role(auth.uid(), project_id));

CREATE POLICY "m_sel" ON public.ownership_stakes FOR SELECT USING (is_project_member(auth.uid(), project_id));
CREATE POLICY "m_ins" ON public.ownership_stakes FOR INSERT WITH CHECK (has_write_role(auth.uid(), project_id));
CREATE POLICY "m_upd" ON public.ownership_stakes FOR UPDATE USING (has_write_role(auth.uid(), project_id));
CREATE POLICY "m_del" ON public.ownership_stakes FOR DELETE USING (has_admin_role(auth.uid(), project_id));

CREATE POLICY "m_sel" ON public.maintenance_issues FOR SELECT USING (is_project_member(auth.uid(), project_id));
CREATE POLICY "m_ins" ON public.maintenance_issues FOR INSERT WITH CHECK (has_write_role(auth.uid(), project_id));
CREATE POLICY "m_upd" ON public.maintenance_issues FOR UPDATE USING (has_write_role(auth.uid(), project_id));
CREATE POLICY "m_del" ON public.maintenance_issues FOR DELETE USING (has_admin_role(auth.uid(), project_id));

CREATE POLICY "m_sel" ON public.tax_obligations FOR SELECT USING (is_project_member(auth.uid(), project_id));
CREATE POLICY "m_ins" ON public.tax_obligations FOR INSERT WITH CHECK (has_write_role(auth.uid(), project_id));
CREATE POLICY "m_upd" ON public.tax_obligations FOR UPDATE USING (has_write_role(auth.uid(), project_id));
CREATE POLICY "m_del" ON public.tax_obligations FOR DELETE USING (has_admin_role(auth.uid(), project_id));

CREATE POLICY "m_sel" ON public.utility_obligations FOR SELECT USING (is_project_member(auth.uid(), project_id));
CREATE POLICY "m_ins" ON public.utility_obligations FOR INSERT WITH CHECK (has_write_role(auth.uid(), project_id));
CREATE POLICY "m_upd" ON public.utility_obligations FOR UPDATE USING (has_write_role(auth.uid(), project_id));
CREATE POLICY "m_del" ON public.utility_obligations FOR DELETE USING (has_admin_role(auth.uid(), project_id));

CREATE POLICY "m_sel" ON public.utility_proofs FOR SELECT USING (is_project_member(auth.uid(), project_id));
CREATE POLICY "m_ins" ON public.utility_proofs FOR INSERT WITH CHECK (has_write_role(auth.uid(), project_id));
CREATE POLICY "m_upd" ON public.utility_proofs FOR UPDATE USING (has_write_role(auth.uid(), project_id));
CREATE POLICY "m_del" ON public.utility_proofs FOR DELETE USING (has_admin_role(auth.uid(), project_id));

CREATE POLICY "m_sel" ON public.documents FOR SELECT USING (is_project_member(auth.uid(), project_id));
CREATE POLICY "m_ins" ON public.documents FOR INSERT WITH CHECK (has_write_role(auth.uid(), project_id));
CREATE POLICY "m_upd" ON public.documents FOR UPDATE USING (has_write_role(auth.uid(), project_id));
CREATE POLICY "m_del" ON public.documents FOR DELETE USING (has_admin_role(auth.uid(), project_id));

-- ============================================================
-- 11. Storage policies using project membership
-- ============================================================
CREATE POLICY "pf_sel" ON storage.objects FOR SELECT USING (
  bucket_id='proof-files' AND EXISTS (
    SELECT 1 FROM contracts c WHERE c.id::text=(storage.foldername(name))[1] AND is_project_member(auth.uid(), c.project_id)
  )
);
CREATE POLICY "pf_del" ON storage.objects FOR DELETE USING (
  bucket_id='proof-files' AND EXISTS (
    SELECT 1 FROM contracts c WHERE c.id::text=(storage.foldername(name))[1] AND has_admin_role(auth.uid(), c.project_id)
  )
);
CREATE POLICY "cd_ins" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id='contract-documents' AND EXISTS (
    SELECT 1 FROM contracts c WHERE c.id::text=(storage.foldername(name))[1] AND has_write_role(auth.uid(), c.project_id)
  )
);
CREATE POLICY "cd_sel" ON storage.objects FOR SELECT USING (
  bucket_id='contract-documents' AND EXISTS (
    SELECT 1 FROM contracts c WHERE c.id::text=(storage.foldername(name))[1] AND is_project_member(auth.uid(), c.project_id)
  )
);
CREATE POLICY "cd_del" ON storage.objects FOR DELETE USING (
  bucket_id='contract-documents' AND EXISTS (
    SELECT 1 FROM contracts c WHERE c.id::text=(storage.foldername(name))[1] AND has_admin_role(auth.uid(), c.project_id)
  )
);
