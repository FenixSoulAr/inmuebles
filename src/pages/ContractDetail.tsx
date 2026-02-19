import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Building2, DollarSign, FileText, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ContractSheet } from "@/components/contracts/ContractSheet";
import { ContractPublicLink } from "@/components/contracts/ContractPublicLink";
import { EditContractModal } from "@/components/contracts/EditContractModal";
import { CorrectCurrencyModal } from "@/components/contracts/CorrectCurrencyModal";
import { ContractActionMenu } from "@/components/contracts/ContractActionMenu";
import { ContractDocuments } from "@/components/contracts/ContractDocuments";
import { ContractTextPanel, type OwnerForContract, type GuarantorForContract } from "@/components/contracts/ContractTextPanel";
import { ContractDraftPanel } from "@/components/contracts/ContractDraftPanel";
import { DocumentsPanel } from "@/components/documents/DocumentsPanel";
import { ContractAdjustments } from "@/components/contracts/ContractAdjustments";
import { ContractServices } from "@/components/contracts/ContractServices";

interface Contract {
  id: string;
  property_id: string;
  tenant_id: string;
  start_date: string;
  end_date: string;
  initial_rent: number;
  current_rent: number;
  deposit: number | null;
  is_active: boolean;
  adjustment_type: string;
  adjustment_frequency: number | null;
  adjustment_base_date: string | null;
  clauses_text: string | null;
  next_adjustment_date: string | null;
  public_submission_token: string | null;
  token_status: string;
  submission_language?: string;
  rent_due_day: number;
  currency: string | null;
  currency_deposit: string | null;
  tipo_contrato: string | null;
  price_mode: string | null;
  has_price_update: boolean;
  usa_seguro: boolean | null;
  seguro_tipo: string | null;
  seguro_obligatorio: boolean | null;
  expensas_ordinarias: boolean | null;
  expensas_extraordinarias: boolean | null;
  impuestos_a_cargo_locatario: boolean | null;
  permite_subalquiler: boolean | null;
  permite_mascotas: boolean | null;
  basic_terms: string | null;
  tenant_insurance_notes: string | null;
  draft_text: string | null;
  draft_last_generated_at: string | null;
  draft_status: string | null;
  booking_channel: string | null;
  deposit_mode: string | null;
  properties: { internal_identifier: string; full_address: string };
  tenants: { full_name: string; email: string | null; phone: string | null; doc_id: string | null };
}

export default function ContractDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();

  const [contract, setContract] = useState<Contract | null>(null);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [correctCurrencyOpen, setCorrectCurrencyOpen] = useState(false);
  const [hasRentDues, setHasRentDues] = useState(false);
  const [owners, setOwners] = useState<OwnerForContract[]>([]);
  const [guarantors, setGuarantors] = useState<GuarantorForContract[]>([]);

  const fetchContract = async () => {
    if (!user || !id) return;
    try {
      const [contractRes, rentDuesRes] = await Promise.all([
        supabase
          .from("contracts")
          .select(`*, properties(internal_identifier, full_address), tenants(full_name, email, phone, doc_id)`)
          .eq("id", id)
          .single(),
        supabase.from("rent_dues").select("id").eq("contract_id", id).limit(1),
      ]);

      if (contractRes.error) throw contractRes.error;
      setContract(contractRes.data as any);
      setHasRentDues((rentDuesRes.data?.length ?? 0) > 0);

      const { data: ownerLinks } = await supabase
        .from("property_owners" as any)
        .select("ownership_percent, role, owners(full_name, dni_cuit, address, email, phone)")
        .eq("property_id", (contractRes.data as any).property_id)
        .order("created_at");

      setOwners(
        ((ownerLinks as any[]) || []).map((link: any) => ({
          full_name: link.owners?.full_name || "",
          dni_cuit: link.owners?.dni_cuit || null,
          address: link.owners?.address || null,
          email: link.owners?.email || null,
          phone: link.owners?.phone || null,
          ownership_percent: link.ownership_percent,
          role: link.role,
        }))
      );

      const { data: gData } = await supabase
        .from("contract_guarantors" as any)
        .select("guarantee_type, full_name, company_name, document_or_cuit, address, phone, email, insurance_policy_number, coverage_amount, insurance_valid_from, insurance_valid_to, notes, details")
        .eq("contract_id", id)
        .order("sort_order");

      setGuarantors((gData as any[]) || []);
    } catch (err) {
      console.error("Error loading contract:", err);
      toast({ title: "Error", description: "No se pudo cargar el contrato.", variant: "destructive" });
      navigate("/contracts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchContract(); }, [user, id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!contract) {
    return <div className="p-8 text-center text-muted-foreground">Contrato no encontrado.</div>;
  }

  const isExpired = !contract.is_active || new Date(contract.end_date) < new Date();
  const tipoLabel =
    contract.tipo_contrato === "temporario" ? "Temporario"
    : contract.tipo_contrato === "comercial" ? "Comercial"
    : "Permanente";

  const ADJUSTMENT_TYPE_LABELS: Record<string, string> = {
    ipc: t("contracts.ipc", "IPC"),
    icl: t("contracts.icl", "ICL"),
    fixed: t("contracts.fixed", "Porcentaje fijo"),
    manual: t("contracts.manual", "Manual"),
  };

  return (
    <div>
      <Button variant="ghost" size="sm" className="mb-4" onClick={() => navigate("/contracts")}>
        <ArrowLeft className="w-4 h-4 mr-2" />
        Volver a contratos
      </Button>

      <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
        <PageHeader
          title={`${contract.properties?.internal_identifier} — ${contract.tenants?.full_name}`}
          description={contract.properties?.full_address}
        />
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant={contract.is_active ? "default" : "secondary"}>
            {contract.is_active ? "Activo" : "Inactivo"}
          </Badge>
          <Badge variant="outline">{tipoLabel}</Badge>
          <ContractActionMenu
            contract={contract as any}
            onEdit={() => setEditOpen(true)}
            onRefresh={fetchContract}
          />
        </div>
      </div>

      {isExpired && (
        <Alert className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Este contrato está vencido o inactivo.</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="ficha" className="space-y-4">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="ficha"><FileText className="w-3.5 h-3.5 mr-1.5" />Ficha</TabsTrigger>
          <TabsTrigger value="document"><FileText className="w-3.5 h-3.5 mr-1.5" />Documento</TabsTrigger>
          <TabsTrigger value="payments"><DollarSign className="w-3.5 h-3.5 mr-1.5" />Pagos</TabsTrigger>
          <TabsTrigger value="services"><Building2 className="w-3.5 h-3.5 mr-1.5" />Servicios</TabsTrigger>
          <TabsTrigger value="docs"><FileText className="w-3.5 h-3.5 mr-1.5" />Archivos</TabsTrigger>
        </TabsList>

        {/* TAB: Ficha */}
        <TabsContent value="ficha" className="space-y-4 pt-2">
          <ContractPublicLink
            contractId={contract.id}
            token={contract.public_submission_token}
            tokenStatus={contract.token_status}
            propertyName={contract.properties?.internal_identifier}
            tenantName={contract.tenants?.full_name}
            onUpdate={fetchContract}
          />
          <ContractSheet contract={contract as any} onUpdate={fetchContract} />
          <ContractTextPanel contract={contract as any} onSaved={fetchContract} />
        </TabsContent>

        {/* TAB: Documento */}
        <TabsContent value="document" className="pt-2">
          <div className="rounded-xl border border-border bg-card p-6">
            <ContractDraftPanel
              contract={{
                id: contract.id,
                tipo_contrato: contract.tipo_contrato,
                start_date: contract.start_date,
                end_date: contract.end_date,
                current_rent: contract.current_rent,
                currency: contract.currency,
                price_mode: contract.price_mode,
                deposit: contract.deposit,
                draft_text: contract.draft_text,
                draft_last_generated_at: contract.draft_last_generated_at,
                draft_status: contract.draft_status,
                has_price_update: contract.has_price_update,
                adjustment_type: contract.adjustment_type,
                adjustment_frequency: contract.adjustment_frequency,
                booking_channel: contract.booking_channel,
                deposit_mode: contract.deposit_mode,
                properties: contract.properties,
                tenants: { full_name: contract.tenants?.full_name },
                owners: owners.map((o) => ({ full_name: o.full_name })),
              }}
              onSaved={fetchContract}
            />
          </div>
        </TabsContent>

        {/* TAB: Pagos */}
        <TabsContent value="payments" className="space-y-6 pt-2">
          <ContractAdjustments
            contractId={contract.id}
            currentRent={contract.current_rent}
            currency={contract.currency || "ARS"}
            adjustmentType={contract.adjustment_type}
            adjustmentFrequency={contract.adjustment_frequency}
            adjustmentBaseDate={(contract as any).adjustment_base_date ?? null}
            startDate={contract.start_date}
            isActive={contract.is_active}
            onRentUpdated={fetchContract}
          />
          <CorrectCurrencyModal
            open={correctCurrencyOpen}
            onOpenChange={setCorrectCurrencyOpen}
            contractId={contract.id}
            currentCurrencyRent={contract.currency || "ARS"}
            currentCurrencyDeposit={contract.currency_deposit || "ARS"}
            currentRent={contract.current_rent}
            currentDeposit={contract.deposit}
            onSuccess={fetchContract}
          />
        </TabsContent>

        {/* TAB: Servicios */}
        <TabsContent value="services" className="pt-2">
          <ContractServices contractId={contract.id} rentDueDay={contract.rent_due_day || 5} />
        </TabsContent>

        {/* TAB: Archivos */}
        <TabsContent value="docs" className="pt-2">
          <div className="space-y-4">
            <ContractDocuments contractId={contract.id} />
            <DocumentsPanel contractId={contract.id} scope="contract" />
          </div>
        </TabsContent>
      </Tabs>

      <EditContractModal
        contract={contract as any}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSuccess={fetchContract}
        hasRentDues={hasRentDues}
      />
    </div>
  );
}
