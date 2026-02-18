import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft, FileText, DollarSign, RefreshCw, Loader2, Building2, User, Wrench } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ContractPublicLink } from "@/components/contracts/ContractPublicLink";
import { ContractServices } from "@/components/contracts/ContractServices";
import { ContractAdjustments } from "@/components/contracts/ContractAdjustments";
import { CorrectCurrencyModal } from "@/components/contracts/CorrectCurrencyModal";
import { ContractSheet } from "@/components/contracts/ContractSheet";
import { ContractDocuments } from "@/components/contracts/ContractDocuments";
import { ContractTextPanel, type OwnerForContract, type GuarantorForContract } from "@/components/contracts/ContractTextPanel";
import { DocumentsPanel } from "@/components/documents/DocumentsPanel";


interface Contract {
  id: string;
  start_date: string;
  end_date: string;
  current_rent: number;
  initial_rent: number;
  deposit: number | null;
  is_active: boolean;
  adjustment_type: string;
  adjustment_frequency: number | null;
  adjustment_base_date: string | null;
  clauses_text: string | null;
  basic_terms: string | null;
  public_submission_token: string | null;
  token_status: string;
  rent_due_day: number;
  currency: string | null;
  currency_deposit: string | null;
  // New condition fields
  tipo_contrato: string | null;
  usa_seguro: boolean | null;
  seguro_tipo: string | null;
  seguro_obligatorio: boolean | null;
  expensas_ordinarias: boolean | null;
  expensas_extraordinarias: boolean | null;
  impuestos_a_cargo_locatario: boolean | null;
  permite_subalquiler: boolean | null;
  permite_mascotas: boolean | null;
  texto_contrato: string | null;
  index_notes: string | null;
  tenant_insurance_notes: string | null;
  properties: {
    internal_identifier: string;
    full_address: string;
  };
  tenants: {
    full_name: string;
    email: string | null;
    phone: string | null;
    doc_id: string | null;
  };
}

export default function ContractDetail() {
  const { id } = useParams<{ id: string }>();
  const [contract, setContract] = useState<Contract | null>(null);
  const [owners, setOwners] = useState<OwnerForContract[]>([]);
  const [contractGuarantors, setContractGuarantors] = useState<GuarantorForContract[]>([]);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [currencyModalOpen, setCurrencyModalOpen] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t, i18n } = useTranslation();
  const isEs = i18n.language?.startsWith("es");

  useEffect(() => {
    if (user && id) fetchContract();
  }, [user, id]);

  const fetchContract = async () => {
    try {
      const [contractRes, guarantorsRes] = await Promise.all([
        supabase
          .from("contracts")
          .select(`
            *,
            properties(internal_identifier, full_address),
            tenants(full_name, email, phone, doc_id)
          ` as any)
          .eq("id", id)
          .maybeSingle(),
        supabase
          .from("contract_guarantors" as any)
          .select("guarantee_type, full_name, company_name, document_or_cuit, address, phone, email, insurance_policy_number, coverage_amount, insurance_valid_from, insurance_valid_to, notes, details")
          .eq("contract_id", id)
          .order("sort_order"),
      ]);

      if (contractRes.error) throw contractRes.error;
      
      if (!contractRes.data) {
        toast({ title: t("contracts.notFound"), description: t("contracts.contractNotFound"), variant: "destructive" });
        navigate("/contracts");
        return;
      }

      const contractData = contractRes.data as unknown as Contract;
      setContract(contractData);

      // Fetch property owners
      if (contractData.properties) {
        const { data: ownerLinks } = await supabase
          .from("property_owners" as any)
          .select("ownership_percent, role, owners(full_name, dni_cuit, address, email, phone)")
          .eq("property_id", (contractRes.data as any).property_id)
          .order("created_at");
        const mapped: OwnerForContract[] = ((ownerLinks as any[]) || []).map((l: any) => ({
          full_name: l.owners?.full_name ?? "",
          dni_cuit: l.owners?.dni_cuit ?? null,
          address: l.owners?.address ?? null,
          email: l.owners?.email ?? null,
          phone: l.owners?.phone ?? null,
          role: l.role ?? null,
          ownership_percent: l.ownership_percent ?? null,
        }));
        setOwners(mapped);
      }

      setContractGuarantors((guarantorsRes.data as any[]) || []);
    } catch (error) {
      console.error("Error fetching contract:", error);
      toast({ title: t("common.error"), description: t("common.errorGeneric"), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerateRentSchedule = async () => {
    if (!contract) return;
    setRegenerating(true);
    try {
      const response = await supabase.functions.invoke("generate-rent-dues", {
        body: { contract_id: contract.id },
      });
      if (response.error) throw response.error;
      const result = response.data;
      toast({
        title: t("contracts.rentScheduleUpdated"),
        description: result.generated > 0 
          ? t("contracts.generatedRecords", { count: result.generated })
          : t("contracts.rentUpToDate"),
      });
    } catch (error) {
      console.error("Error regenerating rent schedule:", error);
      toast({ title: t("common.error"), description: t("common.errorGeneric"), variant: "destructive" });
    } finally {
      setRegenerating(false);
    }
  };

  // Currency formatting — respects per-field currency
  const formatCurrencyWith = (amount: number, currency: string) => {
    const curr = currency || "ARS";
    return new Intl.NumberFormat(isEs ? "es-AR" : "en-US", {
      style: "currency",
      currency: curr,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatCurrency = (amount: number) => formatCurrencyWith(amount, contract?.currency || "ARS");

  const currencyBadge = (currency: string) => (
    <Badge variant="outline" className="text-xs font-mono ml-1">
      {currency || "ARS"}
    </Badge>
  );

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString(isEs ? "es-AR" : "en-US", { weekday: "short", month: "long", day: "numeric", year: "numeric" });

  const adjustmentLabels: Record<string, string> = {
    ipc: t("contracts.ipc"),
    icl: t("contracts.icl"),
    fixed: t("contracts.fixed"),
    manual: t("contracts.manual"),
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!contract) return null;

  return (
    <div>
      <Button variant="ghost" size="sm" className="mb-4" onClick={() => navigate("/contracts")}>
        <ArrowLeft className="w-4 h-4 mr-2" />
        {t("contracts.backToContracts")}
      </Button>

      <PageHeader
        title={t("contracts.contractDetails")}
        description={`${contract.properties.internal_identifier} - ${contract.tenants.full_name}`}
      >
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrencyModalOpen(true)}
            title="Corrección administrativa de moneda"
          >
            <Wrench className="w-4 h-4 mr-2" />
            Corregir moneda
          </Button>
          {contract.is_active && (
            <Button onClick={handleRegenerateRentSchedule} disabled={regenerating}>
              {regenerating ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{t("contracts.regenerating")}</>
              ) : (
                <><RefreshCw className="w-4 h-4 mr-2" />{t("contracts.regenerateRent")}</>
              )}
            </Button>
          )}
        </div>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Status overview strip */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  {t("contracts.contractOverview")}
                </CardTitle>
                <StatusBadge variant={contract.is_active ? "active" : "ended"} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-3 text-sm">
                <div className="space-y-0.5">
                  <p className="text-muted-foreground">Inicio</p>
                  <p className="font-medium">{formatDate(contract.start_date)}</p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-muted-foreground">Vencimiento</p>
                  <p className="font-medium">{formatDate(contract.end_date)}</p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-muted-foreground">Alquiler actual</p>
                  <div className="flex items-center gap-1 flex-wrap">
                    <p className="font-semibold text-primary">
                      {formatCurrencyWith(contract.current_rent, contract.currency || "ARS")}
                    </p>
                    {currencyBadge(contract.currency || "ARS")}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Ficha estructurada del contrato */}
          <ContractSheet contract={contract} onUpdate={fetchContract} />

          {/* Generador de texto legal */}
          <ContractTextPanel
            contract={{ ...contract, owners, contractGuarantors }}
            onSaved={fetchContract}
          />

          {/* Documentación del contrato */}
          <ContractDocuments contractId={contract.id} />

          {/* Nuevos documentos del contrato (sistema unificado) */}
          <div className="rounded-xl border border-border bg-card">
            <div className="px-6 py-4 border-b border-border">
              <h3 className="font-semibold text-base flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" />
                Documentos del contrato
              </h3>
              <p className="text-sm text-muted-foreground mt-0.5">
                Contrato firmado, pólizas, DNI, inventarios y actas.
              </p>
            </div>
            <div className="p-6">
              <DocumentsPanel scope="contract" contractId={contract.id} />
            </div>
          </div>

          {/* Contract Services */}
          {contract.is_active && (
            <ContractServices contractId={contract.id} rentDueDay={contract.rent_due_day || 5} />
          )}

          {/* Adjustment history */}
          <ContractAdjustments
            contractId={contract.id}
            currentRent={contract.current_rent}
            currency={contract.currency || "ARS"}
            adjustmentType={contract.adjustment_type}
            adjustmentFrequency={contract.adjustment_frequency}
            adjustmentBaseDate={contract.adjustment_base_date}
            startDate={contract.start_date}
            isActive={contract.is_active}
            onRentUpdated={fetchContract}
          />
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Building2 className="w-4 h-4" />
                {t("contracts.property")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-semibold">{contract.properties.internal_identifier}</p>
              <p className="text-sm text-muted-foreground mt-1">{contract.properties.full_address}</p>
              <Button variant="outline" size="sm" className="mt-3 w-full" onClick={() => navigate(`/properties/${id}`)}>
                {t("contracts.viewProperty")}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <User className="w-4 h-4" />
                {t("contracts.tenant")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-semibold">{contract.tenants.full_name}</p>
              {contract.tenants.email && <p className="text-sm text-muted-foreground mt-1">{contract.tenants.email}</p>}
              {contract.tenants.phone && <p className="text-sm text-muted-foreground">{contract.tenants.phone}</p>}
            </CardContent>
          </Card>

          {contract.is_active && (
            <ContractPublicLink
              contractId={contract.id}
              token={contract.public_submission_token}
              tokenStatus={contract.token_status}
              propertyName={contract.properties.internal_identifier}
              tenantName={contract.tenants.full_name}
              onUpdate={fetchContract}
            />
          )}

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{t("contracts.quickActions")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => navigate("/rent")}>
                <DollarSign className="w-4 h-4 mr-2" />
                {t("contracts.viewRentDues")}
              </Button>
              <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => navigate("/payment-proofs")}>
                <FileText className="w-4 h-4 mr-2" />
                {t("contracts.viewProofs")}
              </Button>
              <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => navigate("/documents")}>
                <FileText className="w-4 h-4 mr-2" />
                Documentos de la propiedad
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Currency correction modal */}
      <CorrectCurrencyModal
        open={currencyModalOpen}
        onOpenChange={setCurrencyModalOpen}
        contractId={contract.id}
        currentCurrencyRent={contract.currency || "ARS"}
        currentCurrencyDeposit={contract.currency_deposit || "ARS"}
        currentRent={contract.current_rent}
        currentDeposit={contract.deposit}
        onSuccess={fetchContract}
      />
    </div>
  );
}