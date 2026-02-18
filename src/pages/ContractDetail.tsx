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
  public_submission_token: string | null;
  token_status: string;
  rent_due_day: number;
  currency: string | null;
  currency_deposit: string | null;
  properties: {
    internal_identifier: string;
    full_address: string;
  };
  tenants: {
    full_name: string;
    email: string | null;
    phone: string | null;
  };
}

export default function ContractDetail() {
  const { id } = useParams<{ id: string }>();
  const [contract, setContract] = useState<Contract | null>(null);
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
      const { data, error } = await supabase
        .from("contracts")
        .select(`
          *,
          properties(internal_identifier, full_address),
          tenants(full_name, email, phone)
        ` as any)
        .eq("id", id)
        .maybeSingle();

      if (error) throw error;
      
      if (!data) {
        toast({ title: t("contracts.notFound"), description: t("contracts.contractNotFound"), variant: "destructive" });
        navigate("/contracts");
        return;
      }
      
      setContract(data as unknown as Contract);
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
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  {t("contracts.contractOverview")}
                </CardTitle>
                <StatusBadge variant={contract.is_active ? "active" : "ended"} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 sm:grid-cols-2">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">{t("contracts.startDate")}</p>
                  <p className="font-medium">{formatDate(contract.start_date)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">{t("contracts.endDate")}</p>
                  <p className="font-medium">{formatDate(contract.end_date)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">{t("contracts.initialRent")}</p>
                  <div className="flex items-center gap-1">
                    <p className="font-medium">{formatCurrencyWith(contract.initial_rent, contract.currency || "ARS")}</p>
                    {currencyBadge(contract.currency || "ARS")}
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">{t("contracts.currentRent")}</p>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="font-semibold text-lg text-primary">
                      {formatCurrencyWith(contract.current_rent, contract.currency || "ARS")}
                    </p>
                    {currencyBadge(contract.currency || "ARS")}
                    <span className="text-sm font-normal text-muted-foreground">{t("contracts.perMonth")}</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">{t("contracts.deposit")}</p>
                  {contract.deposit ? (
                    <div className="flex items-center gap-1">
                      <p className="font-medium">{formatCurrencyWith(contract.deposit, contract.currency_deposit || "ARS")}</p>
                      {currencyBadge(contract.currency_deposit || "ARS")}
                    </div>
                  ) : (
                    <p className="font-medium text-muted-foreground">—</p>
                  )}
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">{t("contracts.rentDueDay")}</p>
                  <p className="font-medium">{contract.rent_due_day || 5}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">{t("contracts.adjustmentSettings")}</p>
                  <p className="font-medium">
                    {adjustmentLabels[contract.adjustment_type] || contract.adjustment_type}
                  </p>
                  {contract.adjustment_frequency && (
                    <p className="text-sm text-muted-foreground">{t("contracts.everyMonths", { count: contract.adjustment_frequency })}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {contract.clauses_text && (
            <Card>
              <CardHeader><CardTitle>{t("contracts.additionalClauses")}</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{contract.clauses_text}</p>
              </CardContent>
            </Card>
          )}

          {/* Contract Services */}
          {contract.is_active && (
            <ContractServices contractId={contract.id} rentDueDay={contract.rent_due_day || 5} />
          )}

          {/* Adjustment history — shown regardless of active status */}
          <ContractAdjustments
            contractId={contract.id}
            currentRent={contract.current_rent}
            currency={contract.currency || "ARS"}
            adjustmentType={contract.adjustment_type}
            adjustmentFrequency={contract.adjustment_frequency}
            adjustmentBaseDate={contract.adjustment_base_date}
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
                {t("contracts.viewDocuments")}
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