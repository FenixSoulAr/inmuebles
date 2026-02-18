import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, FileText, Calendar, DollarSign, AlertCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/ui/page-header";
import { SearchBar } from "@/components/ui/search-bar";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { ContractActionMenu } from "@/components/contracts/ContractActionMenu";
import { EditContractModal } from "@/components/contracts/EditContractModal";

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
  next_adjustment_date: string | null;
  property_id: string;
  tenant_id: string;
  signed_contract_file_url: string | null;
  public_submission_token: string | null;
  token_status: string;
  currency: string | null;
  properties: { internal_identifier: string; full_address: string } | null;
  tenants: { full_name: string } | null;
}

export default function Contracts() {
  const { t } = useTranslation();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [selectedContractHasRentDues, setSelectedContractHasRentDues] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (user) fetchContracts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const fetchContracts = async () => {
    setFetchError(null);
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("contracts")
        .select(`*, properties(internal_identifier, full_address), tenants(full_name)`)
        .order("start_date", { ascending: false });

      if (error) throw error;

      const sorted = (data || []).sort((a: Contract, b: Contract) => {
        const propCmp = (a.properties?.internal_identifier || "").localeCompare(
          b.properties?.internal_identifier || ""
        );
        if (propCmp !== 0) return propCmp;
        return new Date(b.start_date).getTime() - new Date(a.start_date).getTime();
      });

      setContracts(sorted);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "No se pudieron cargar los contratos.";
      console.error("Error fetching contracts:", error);
      setFetchError(msg);
      toast({ title: "Error al cargar contratos", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = async (contract: Contract) => {
    try {
      const { data } = await supabase
        .from("rent_dues")
        .select("id")
        .eq("contract_id", contract.id)
        .limit(1);
      setSelectedContractHasRentDues((data?.length || 0) > 0);
    } catch {
      setSelectedContractHasRentDues(false);
    }
    setSelectedContract(contract);
    setEditModalOpen(true);
  };

  const filteredContracts = contracts.filter((contract) => {
    const propName = contract.properties?.internal_identifier?.toLowerCase() ?? "";
    const tenantName = contract.tenants?.full_name?.toLowerCase() ?? "";
    const q = search.toLowerCase();
    const matchesSearch = !q || propName.includes(q) || tenantName.includes(q);
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && contract.is_active) ||
      (statusFilter === "inactive" && !contract.is_active);
    return matchesSearch && matchesStatus;
  });

  const formatCurrency = (amount: number | null | undefined, currency?: string | null) => {
    if (amount == null) return "—";
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: currency || "ARS",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const adjustmentLabels: Record<string, string> = {
    ipc: t("contracts.ipc"),
    icl: t("contracts.icl"),
    fixed: t("contracts.fixed"),
    manual: t("contracts.manual"),
  };

  if (loading) {
    return (
      <div>
        <PageHeader title={t("contracts.title")} description={t("contracts.description")}>
          <Button onClick={() => navigate("/contracts/new")} disabled>
            <Plus className="w-4 h-4 mr-2" />
            {t("contracts.addContract")}
          </Button>
        </PageHeader>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-5 h-36 bg-muted/30 rounded-lg" />
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title={t("contracts.title")} description={t("contracts.description")}>
        <Button onClick={() => navigate("/contracts/new")}>
          <Plus className="w-4 h-4 mr-2" />
          {t("contracts.addContract")}
        </Button>
      </PageHeader>

      {/* Visible error box — never silently crash */}
      {fetchError && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {fetchError}{" "}
            <button
              className="underline ml-1 font-medium"
              onClick={fetchContracts}
            >
              Reintentar
            </button>
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder={t("contracts.searchPlaceholder")}
          className="flex-1 max-w-md"
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder={t("common.status")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("common.all")}</SelectItem>
            <SelectItem value="active">{t("common.active")}</SelectItem>
            <SelectItem value="inactive">{t("contracts.ended")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filteredContracts.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={t("contracts.noContracts")}
          description={t("contracts.noContractsDesc")}
          action={{ label: t("contracts.addContract"), onClick: () => navigate("/contracts/new") }}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredContracts.map((contract) => (
            <Card
              key={contract.id}
              className={`group hover:shadow-medium transition-shadow cursor-pointer ${
                !contract.is_active ? "opacity-60" : ""
              }`}
              onClick={() => navigate(`/contracts/${contract.id}`)}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 text-primary">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-semibold">
                        {contract.properties?.internal_identifier ?? "—"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {contract.tenants?.full_name ?? "—"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <StatusBadge variant={contract.is_active ? "active" : "ended"} />
                    <ContractActionMenu
                      contract={contract as any}
                      onEdit={() => handleEdit(contract)}
                      onRefresh={fetchContracts}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-2 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="w-4 h-4 shrink-0" />
                    <span>
                      {contract.start_date
                        ? new Date(contract.start_date + "T00:00:00").toLocaleDateString("es-AR")
                        : "—"}{" "}
                      →{" "}
                      {contract.end_date
                        ? new Date(contract.end_date + "T00:00:00").toLocaleDateString("es-AR")
                        : "—"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-success" />
                    <span className="font-semibold">
                      {formatCurrency(contract.current_rent, contract.currency)}
                      {t("contracts.perMonth")}
                    </span>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t">
                  <span className="text-xs text-muted-foreground">
                    {t("contracts.adjustmentType")}:{" "}
                    {adjustmentLabels[contract.adjustment_type] ?? contract.adjustment_type ?? "—"}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <EditContractModal
        contract={selectedContract as any}
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        onSuccess={fetchContracts}
        hasRentDues={selectedContractHasRentDues}
      />
    </div>
  );
}
