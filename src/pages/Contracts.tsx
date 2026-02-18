import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, FileText, Calendar, DollarSign } from "lucide-react";
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
import { useToast } from "@/hooks/use-toast";
import { ContractActionMenu } from "@/components/contracts/ContractActionMenu";
import { EditContractModal } from "@/components/contracts/EditContractModal";

interface Contract {
  id: string; start_date: string; end_date: string; current_rent: number; initial_rent: number;
  deposit: number | null; is_active: boolean; adjustment_type: string; adjustment_frequency: number | null;
  clauses_text: string | null; next_adjustment_date: string | null; property_id: string; tenant_id: string;
  signed_contract_file_url: string | null;
  public_submission_token: string | null; token_status: string;
  properties: { internal_identifier: string; full_address: string };
  tenants: { full_name: string };
}

export default function Contracts() {
  const { t } = useTranslation();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [selectedContractHasRentDues, setSelectedContractHasRentDues] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => { if (user) fetchContracts(); }, [user]);

  const fetchContracts = async () => {
    try {
      const { data, error } = await supabase.from("contracts")
        .select(`*, properties(internal_identifier, full_address), tenants(full_name)`)
        .order("start_date", { ascending: false });
      if (error) throw error;
      // Sort by property name asc, then start_date desc
      const sorted = (data || []).sort((a: any, b: any) => {
        const propCmp = (a.properties?.internal_identifier || "").localeCompare(b.properties?.internal_identifier || "");
        if (propCmp !== 0) return propCmp;
        return new Date(b.start_date).getTime() - new Date(a.start_date).getTime();
      });
      setContracts(sorted);
      if (error) throw error;
    } catch (error) {
      console.error("Error fetching contracts:", error);
      toast({ title: t("common.error"), description: t("common.errorGeneric"), variant: "destructive" });
    } finally { setLoading(false); }
  };

  const handleEdit = async (contract: Contract) => {
    const { data } = await supabase.from("rent_dues").select("id").eq("contract_id", contract.id).limit(1);
    setSelectedContractHasRentDues((data?.length || 0) > 0);
    setSelectedContract(contract);
    setEditModalOpen(true);
  };

  const filteredContracts = contracts.filter((contract) => {
    const matchesSearch =
      contract.properties.internal_identifier.toLowerCase().includes(search.toLowerCase()) ||
      contract.tenants.full_name.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" ||
      (statusFilter === "active" && contract.is_active) ||
      (statusFilter === "inactive" && !contract.is_active);
    return matchesSearch && matchesStatus;
  });

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);

  const adjustmentLabels: Record<string, string> = {
    ipc: t("contracts.ipc"), icl: t("contracts.icl"), fixed: t("contracts.fixed"), manual: t("contracts.manual"),
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title={t("contracts.title")} description={t("contracts.description")}>
        <Button onClick={() => navigate("/contracts/new")}><Plus className="w-4 h-4 mr-2" />{t("contracts.addContract")}</Button>
      </PageHeader>

      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <SearchBar value={search} onChange={setSearch} placeholder={t("contracts.searchPlaceholder")} className="flex-1 max-w-md" />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder={t("common.status")} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("common.all")}</SelectItem>
            <SelectItem value="active">{t("common.active")}</SelectItem>
            <SelectItem value="inactive">{t("contracts.ended")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filteredContracts.length === 0 ? (
        <EmptyState icon={FileText} title={t("contracts.noContracts")} description={t("contracts.noContractsDesc")}
          action={{ label: t("contracts.addContract"), onClick: () => navigate("/contracts/new") }} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredContracts.map((contract) => (
            <Card key={contract.id} className={`group hover:shadow-medium transition-shadow cursor-pointer ${!contract.is_active ? "opacity-60" : ""}`}
              onClick={() => navigate(`/contracts/${contract.id}`)}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 text-primary"><FileText className="w-5 h-5" /></div>
                    <div>
                      <p className="font-semibold">{contract.properties.internal_identifier}</p>
                      <p className="text-sm text-muted-foreground">{contract.tenants.full_name}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge variant={contract.is_active ? "active" : "ended"} />
                    <ContractActionMenu contract={contract} onEdit={() => handleEdit(contract)} onRefresh={fetchContracts} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="w-4 h-4" />
                    <span>{new Date(contract.start_date).toLocaleDateString()} - {new Date(contract.end_date).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-success" />
                    <span className="font-semibold">{formatCurrency(contract.current_rent)}{t("contracts.perMonth")}</span>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t">
                  <span className="text-xs text-muted-foreground">
                    {t("contracts.adjustmentType")}: {adjustmentLabels[contract.adjustment_type] || contract.adjustment_type}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <EditContractModal contract={selectedContract} open={editModalOpen} onOpenChange={setEditModalOpen}
        onSuccess={fetchContracts} hasRentDues={selectedContractHasRentDues} />
    </div>
  );
}
