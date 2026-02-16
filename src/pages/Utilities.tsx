import { useEffect, useState } from "react";
import { Zap, AlertCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/hooks/use-toast";
import { UtilitiesTable, UtilityProofRow } from "@/components/utilities/UtilitiesTable";
import { UtilitiesFilter, type UtilityFilterStatus } from "@/components/utilities/UtilitiesFilter";
import { UploadProofModal } from "@/components/utilities/UploadProofModal";
import { AddUtilityModal } from "@/components/utilities/AddUtilityModal";

interface UtilityProofData {
  id: string;
  period_month: string;
  status: string;
  file_url: string | null;
  utility_obligations: {
    type: string;
    payer: string;
    due_day_of_month: number | null;
    properties: {
      id: string;
      internal_identifier: string;
    };
  };
}

export default function Utilities() {
  const { t } = useTranslation();

  const utilityTypeLabels: Record<string, string> = {
    electricity: t("utilities.electricity"),
    gas: t("utilities.gas"),
    water: t("utilities.water"),
    hoa: t("utilities.hoa"),
    insurance: t("utilities.insuranceUtility"),
  };

  const [proofs, setProofs] = useState<UtilityProofRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<UtilityFilterStatus>("action_needed");
  const [counts, setCounts] = useState({
    all: 0,
    pending: 0,
    overdue: 0,
    not_submitted: 0,
    paid_with_proof: 0,
  });

  // Upload modal state
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [selectedProofId, setSelectedProofId] = useState<string | null>(null);
  const [selectedProofDetails, setSelectedProofDetails] = useState<{
    property: string;
    utilityType: string;
    period: string;
  } | null>(null);

  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (user) fetchData();
  }, [user]);

  const fetchData = async () => {
    try {
      const { data, error } = await supabase
        .from("utility_proofs")
        .select(
          `
          id,
          period_month,
          status,
          file_url,
          utility_obligations (
            type,
            payer,
            due_day_of_month,
            properties (
              id,
              internal_identifier
            )
          )
        `
        )
        .order("period_month", { ascending: false });

      if (error) throw error;

      const now = new Date();
      const processedProofs: UtilityProofRow[] = (data || []).map((proof: UtilityProofData) => {
        // Derive due date from period and due_day_of_month
        const [year, month] = proof.period_month.split("-").map(Number);
        const dueDay = proof.utility_obligations.due_day_of_month || 10;
        const dueDate = new Date(year, month - 1, dueDay);

        // Derive status automatically
        let derivedStatus: "paid_with_proof" | "not_submitted" | "overdue";
        if (proof.file_url) {
          derivedStatus = "paid_with_proof";
        } else if (dueDate < now) {
          derivedStatus = "overdue";
        } else {
          derivedStatus = "not_submitted";
        }

        // Format period for display
        const periodDate = new Date(year, month - 1);
        const periodDisplay = periodDate.toLocaleDateString("en-US", {
          month: "short",
          year: "numeric",
        });

        return {
          id: proof.id,
          property: proof.utility_obligations.properties.internal_identifier,
          propertyId: proof.utility_obligations.properties.id,
          utilityType: proof.utility_obligations.type,
          period: periodDisplay,
          periodMonth: proof.period_month,
          responsible: proof.utility_obligations.payer,
          dueDate: dueDate.toISOString().split("T")[0],
          status: derivedStatus,
          fileUrl: proof.file_url,
        };
      });

      // Calculate counts
      const overdueCount = processedProofs.filter((p) => p.status === "overdue").length;
      const notSubmittedCount = processedProofs.filter((p) => p.status === "not_submitted").length;
      const newCounts = {
        all: processedProofs.length,
        pending: overdueCount + notSubmittedCount,
        overdue: overdueCount,
        not_submitted: notSubmittedCount,
        paid_with_proof: processedProofs.filter((p) => p.status === "paid_with_proof").length,
      };

      setProofs(processedProofs);
      setCounts(newCounts);
    } catch (error) {
      console.error("Error fetching utilities:", error);
      toast({
        title: t("common.error"),
        description: t("common.errorGeneric"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredProofs = proofs.filter((proof) => {
    if (filter === "all") return true;
    // "action_needed" is the default view showing overdue + not_submitted
    if (filter === "action_needed") return proof.status === "overdue" || proof.status === "not_submitted";
    return proof.status === filter;
  });

  const handleUploadProof = (proofId: string) => {
    const proof = proofs.find((p) => p.id === proofId);
    if (!proof) return;

    setSelectedProofId(proofId);
    setSelectedProofDetails({
      property: proof.property,
      utilityType: utilityTypeLabels[proof.utilityType] || proof.utilityType,
      period: proof.period,
    });
    setUploadModalOpen(true);
  };

  const handleViewProof = (fileUrl: string) => {
    window.open(fileUrl, "_blank");
  };

  const handleUploadSuccess = () => {
    fetchData();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("utilities.title")}
        description={t("utilities.description")}
      >
        <AddUtilityModal onSuccess={fetchData} />
      </PageHeader>

      {/* Helper text alert */}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          {t("utilities.helperText")}
        </AlertDescription>
      </Alert>

      {/* Summary stats */}
      {(counts.overdue > 0 || counts.not_submitted > 0) && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className={counts.overdue > 0 ? "border-destructive/50" : ""}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t("utilities.overdue")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${counts.overdue > 0 ? "text-destructive" : ""}`}>
                {counts.overdue}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t("utilities.notSubmitted")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{counts.not_submitted}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t("utilities.paidWithProof")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">{counts.paid_with_proof}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t("utilities.total")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{counts.all}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main content card */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5" />
              {t("utilities.utilityProofs")}
            </CardTitle>
            <UtilitiesFilter
              activeFilter={filter}
              onFilterChange={setFilter}
              counts={counts}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <UtilitiesTable
            proofs={filteredProofs}
            onUploadProof={handleUploadProof}
            onViewProof={handleViewProof}
          />
        </CardContent>
      </Card>

      {/* Upload proof modal */}
      <UploadProofModal
        open={uploadModalOpen}
        onOpenChange={setUploadModalOpen}
        proofId={selectedProofId}
        proofDetails={selectedProofDetails}
        onSuccess={handleUploadSuccess}
      />
    </div>
  );
}
