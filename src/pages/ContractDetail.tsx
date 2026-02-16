import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft, FileText, Calendar, DollarSign, RefreshCw, Loader2, Building2, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ContractPublicLink } from "@/components/contracts/ContractPublicLink";

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
  clauses_text: string | null;
  public_submission_token: string | null;
  token_status: string;
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
        toast({
          title: "Not found",
          description: "Contract not found.",
          variant: "destructive",
        });
        navigate("/contracts");
        return;
      }
      
      setContract(data as unknown as Contract);
    } catch (error) {
      console.error("Error fetching contract:", error);
      toast({
        title: "Error",
        description: "Something went wrong. Please refresh.",
        variant: "destructive",
      });
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

      if (response.error) {
        throw response.error;
      }

      const result = response.data;
      toast({
        title: "Rent schedule updated",
        description: result.generated > 0 
          ? `Generated ${result.generated} rent due records.`
          : "Rent schedule is up to date.",
      });
    } catch (error) {
      console.error("Error regenerating rent schedule:", error);
      toast({
        title: "Error",
        description: "Failed to regenerate rent schedule. Please try again.",
        variant: "destructive",
      });
    } finally {
      setRegenerating(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      weekday: "short",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  const adjustmentLabels: Record<string, string> = {
    ipc: "IPC (Consumer Price Index)",
    icl: "ICL (Construction Index)",
    fixed: "Fixed Percentage",
    manual: "Manual Adjustment",
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!contract) {
    return null;
  }

  return (
    <div>
      <Button
        variant="ghost"
        size="sm"
        className="mb-4"
        onClick={() => navigate("/contracts")}
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Contracts
      </Button>

      <PageHeader
        title="Contract Details"
        description={`${contract.properties.internal_identifier} - ${contract.tenants.full_name}`}
      >
        {contract.is_active && (
          <Button onClick={handleRegenerateRentSchedule} disabled={regenerating}>
            {regenerating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Regenerating...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                Regenerate rent schedule
              </>
            )}
          </Button>
        )}
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Contract Status Card */}
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Contract Overview
                </CardTitle>
                <StatusBadge variant={contract.is_active ? "active" : "ended"} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 sm:grid-cols-2">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Start Date</p>
                  <p className="font-medium">{formatDate(contract.start_date)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">End Date</p>
                  <p className="font-medium">{formatDate(contract.end_date)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Initial Rent</p>
                  <p className="font-medium">{formatCurrency(contract.initial_rent)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Current Rent</p>
                  <p className="font-semibold text-lg text-primary">
                    {formatCurrency(contract.current_rent)}
                    <span className="text-sm font-normal text-muted-foreground">/month</span>
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Deposit</p>
                  <p className="font-medium">
                    {contract.deposit ? formatCurrency(contract.deposit) : "—"}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Adjustment Settings</p>
                  <p className="font-medium">
                    {adjustmentLabels[contract.adjustment_type] || contract.adjustment_type}
                  </p>
                  {contract.adjustment_frequency && (
                    <p className="text-sm text-muted-foreground">
                      Every {contract.adjustment_frequency} months
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Additional Clauses */}
          {contract.clauses_text && (
            <Card>
              <CardHeader>
                <CardTitle>Additional Clauses</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{contract.clauses_text}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Property Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Building2 className="w-4 h-4" />
                Property
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-semibold">{contract.properties.internal_identifier}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {contract.properties.full_address}
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3 w-full"
                onClick={() => navigate(`/properties/${id}`)}
              >
                View Property
              </Button>
            </CardContent>
          </Card>

          {/* Tenant Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <User className="w-4 h-4" />
                Tenant
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-semibold">{contract.tenants.full_name}</p>
              {contract.tenants.email && (
                <p className="text-sm text-muted-foreground mt-1">
                  {contract.tenants.email}
                </p>
              )}
              {contract.tenants.phone && (
                <p className="text-sm text-muted-foreground">
                  {contract.tenants.phone}
                </p>
              )}
            </CardContent>
          </Card>

        {/* Public Link */}
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

          {/* Quick Actions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{t("contracts.quickActions")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start"
                onClick={() => navigate("/rent")}
              >
                <DollarSign className="w-4 h-4 mr-2" />
                {t("contracts.viewRentDues")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start"
                onClick={() => navigate("/documents")}
              >
                <FileText className="w-4 h-4 mr-2" />
                {t("contracts.viewDocuments")}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
