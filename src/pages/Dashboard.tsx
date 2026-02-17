import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { DollarSign } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { DashboardKPIs } from "@/components/dashboard/DashboardKPIs";
import {
  ActionCenter,
  OverdueRentItem,
  DueSoonItem,
  MissingProofItem,
  TaxDueItem,
  MaintenanceItem,
} from "@/components/dashboard/ActionCenter";

interface DashboardStats {
  rentCollectedThisMonth: number;    // obligations kind=rent, status=confirmed, payment paid_at in current month
  rentPendingThisMonth: number;       // obligations kind=rent, not confirmed, due_date in current month → SUM expected_amount - total_paid
  rentOverdueAccumulated: number;     // obligations kind=rent, not confirmed, due_date < first day of current month → SUM balance
  missingProofsCount: number;         // obligations kind=rent, status=confirmed, balance<=0, no payment attachment
  taxesDueSoon: number;               // tax_obligations status=pending, due_date within 30 days
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    rentCollectedThisMonth: 0,
    rentPendingThisMonth: 0,
    rentOverdueAccumulated: 0,
    missingProofsCount: 0,
    taxesDueSoon: 0,
  });
  const [overdueRent, setOverdueRent] = useState<OverdueRentItem[]>([]);
  const [dueSoon, setDueSoon] = useState<DueSoonItem[]>([]);
  const [missingProofs, setMissingProofs] = useState<MissingProofItem[]>([]);
  const [taxesDue, setTaxesDue] = useState<TaxDueItem[]>([]);
  const [openMaintenance, setOpenMaintenance] = useState<MaintenanceItem[]>([]);
  const [loading, setLoading] = useState(true);

  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useTranslation();

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user]);

  const fetchDashboardData = async () => {
    try {
      const now = new Date();
      // Current month boundaries
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      const monthStartStr = monthStart.toISOString().split("T")[0];
      const monthEndStr = monthEnd.toISOString().split("T")[0];
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      const in30DaysStr = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      const in7DaysStr = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      const todayStr = now.toISOString().split("T")[0];

      // Fetch all rent obligations + their payments
      const [oblRes, allPaymentsRes, taxesRes, maintenanceRes] = await Promise.all([
        supabase
          .from("obligations")
          .select(`
            id, period, due_date, expected_amount, status, kind, payment_proof_id, currency,
            properties(internal_identifier),
            tenants(full_name),
            payment_proofs!obligations_payment_proof_id_fkey(id, files, amount, status)
          `)
          .eq("kind", "rent")
          .order("period", { ascending: true }),
        supabase
          .from("payments")
          .select("obligation_id, amount, paid_at, attachment_url"),
        supabase
          .from("tax_obligations")
          .select("*, properties(internal_identifier)")
          .eq("status", "pending")
          .lte("due_date", in30DaysStr)
          .gte("due_date", todayStr),
        supabase
          .from("maintenance_issues")
          .select("*, properties(internal_identifier)")
          .neq("status", "resolved"),
      ]);

      const rawObls = (oblRes.data || []) as any[];
      const allPayments = (allPaymentsRes.data || []) as any[];

      // Build payments map
      const paymentsByObl = new Map<string, { amount: number; paid_at: string; attachment_url: string | null }[]>();
      for (const p of allPayments) {
        const list = paymentsByObl.get(p.obligation_id) || [];
        list.push(p);
        paymentsByObl.set(p.obligation_id, list);
      }

      // Enrich obligations
      const enriched = rawObls.map((o) => {
        const payments = paymentsByObl.get(o.id) || [];
        const totalPaid = payments.reduce((s: number, p: any) => s + Number(p.amount), 0);
        const expected = Number(o.expected_amount ?? 0);
        const balanceDue = Math.max(expected - totalPaid, 0);
        return { ...o, payments, totalPaid, balanceDue };
      });

      // --- KPI 1: Cobrado (mes) ---
      // Obligations (kind=rent) that have payments with paid_at in current month
      const paymentsThisMonth = allPayments.filter(
        (p: any) => p.paid_at >= monthStartStr && p.paid_at <= monthEndStr
      );
      // Group payments by obligation, find obligations that are confirmed
      const confirmedOblIds = new Set(
        enriched.filter((o) => o.balanceDue <= 0).map((o) => o.id)
      );
      const rentCollected = paymentsThisMonth
        .filter((p: any) => confirmedOblIds.has(p.obligation_id))
        .reduce((s: number, p: any) => s + Number(p.amount), 0);

      // --- KPI 2: Pendiente (mes) ---
      // Obligations kind=rent, not confirmed, due_date in current month
      const pendingThisMonth = enriched.filter(
        (o) =>
          o.balanceDue > 0 &&
          o.due_date >= monthStartStr &&
          o.due_date <= monthEndStr
      );
      const rentPending = pendingThisMonth.reduce((s: number, o: any) => s + o.balanceDue, 0);

      // --- KPI 3: Mora acumulada ---
      // Obligations kind=rent, not confirmed, due_date < first day of current month
      const overdueObls = enriched.filter(
        (o) => o.balanceDue > 0 && o.due_date < monthStartStr
      );
      const rentOverdue = overdueObls.reduce((s: number, o: any) => s + o.balanceDue, 0);

      // --- KPI 4: Comprobantes faltantes ---
      // Confirmed rent obligations (balance <= 0) with NO payment that has an attachment
      const confirmedRentObls = enriched.filter((o) => o.balanceDue <= 0);
      const missingProofsCount = confirmedRentObls.filter((o) => {
        const oblPayments = o.payments || [];
        const hasAttachment = oblPayments.some((p: any) => p.attachment_url);
        const hasProofFile = o.payment_proofs?.files?.length > 0;
        return !hasAttachment && !hasProofFile;
      }).length;

      // --- Action Center: Overdue items ---
      const overdueItems: OverdueRentItem[] = overdueObls.map((o: any) => ({
        id: o.id,
        property: o.properties?.internal_identifier || "—",
        tenant: o.tenants?.full_name || "—",
        dueDate: o.due_date,
        balanceDue: o.balanceDue,
        status: "overdue",
      }));

      // --- Action Center: Due soon (next 7 days) ---
      const dueSoonItems: DueSoonItem[] = enriched
        .filter(
          (o) =>
            o.balanceDue > 0 &&
            o.due_date >= todayStr &&
            o.due_date <= in7DaysStr
        )
        .map((o: any) => ({
          id: o.id,
          property: o.properties?.internal_identifier || "—",
          tenant: o.tenants?.full_name || "—",
          dueDate: o.due_date,
          expectedAmount: Number(o.expected_amount ?? 0),
        }));

      // --- Action Center: Missing proofs (for display) ---
      const missingProofItems: MissingProofItem[] = confirmedRentObls
        .filter((o) => {
          const oblPayments = o.payments || [];
          const hasAttachment = oblPayments.some((p: any) => p.attachment_url);
          const hasProofFile = o.payment_proofs?.files?.length > 0;
          return !hasAttachment && !hasProofFile;
        })
        .slice(0, 8)
        .map((o: any) => ({
          id: o.id,
          property: o.properties?.internal_identifier || "—",
          utilityType: "Alquiler",
          period: formatPeriod(o.period),
          status: "not_submitted",
          dueDate: o.due_date,
        }));

      // --- Taxes due soon ---
      const taxes = taxesRes.data || [];
      const taxItems: TaxDueItem[] = taxes.map((t: any) => ({
        id: t.id,
        property: t.properties?.internal_identifier || "—",
        taxType: formatTaxType(t.type),
        dueDate: t.due_date,
        status: t.status,
      }));

      // --- Open maintenance ---
      const maintenance = maintenanceRes.data || [];
      const maintenanceItems: MaintenanceItem[] = maintenance.map((m: any) => ({
        id: m.id,
        property: m.properties?.internal_identifier || "—",
        issue: m.description,
        status: m.status,
      }));

      setStats({
        rentCollectedThisMonth: rentCollected,
        rentPendingThisMonth: rentPending,
        rentOverdueAccumulated: rentOverdue,
        missingProofsCount,
        taxesDueSoon: taxItems.length,
      });
      setOverdueRent(overdueItems);
      setDueSoon(dueSoonItems);
      setMissingProofs(missingProofItems);
      setTaxesDue(taxItems);
      setOpenMaintenance(maintenanceItems);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      toast({
        title: "Error",
        description: "Algo salió mal. Por favor recargá la página.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatPeriod = (period: string) => {
    const [year, month] = period.split("-");
    return new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString("es-AR", {
      month: "short",
      year: "numeric",
    });
  };

  const formatTaxType = (type: string) => {
    const labels: Record<string, string> = {
      municipal: "Municipal",
      property: "Inmobiliario",
      income: "Ganancias",
    };
    return labels[type] || type;
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
      <PageHeader title={t("dashboard.title")} description={t("dashboard.subtitle")}>
        <Button variant="outline" onClick={() => navigate("/payment-proofs?kindTab=rent&statusTab=action")}>
          <DollarSign className="w-4 h-4 mr-2" />
          {t("dashboard.recordPayment")}
        </Button>
      </PageHeader>

      {/* KPI Cards */}
      <DashboardKPIs
        rentCollectedThisMonth={stats.rentCollectedThisMonth}
        rentPendingThisMonth={stats.rentPendingThisMonth}
        rentOverdueAccumulated={stats.rentOverdueAccumulated}
        missingProofsCount={stats.missingProofsCount}
        taxesDueSoon={stats.taxesDueSoon}
      />

      {/* Action Center */}
      <ActionCenter
        overdueRent={overdueRent}
        dueSoon={dueSoon}
        missingProofs={missingProofs}
        taxesDueSoon={taxesDue}
        openMaintenance={openMaintenance}
        onRecordPayment={(id) => navigate(`/payment-proofs?kindTab=rent&statusTab=action`)}
        onUploadProof={() => navigate("/payment-proofs?kindTab=rent&statusTab=confirmed&missingProof=true")}
        onUploadTaxReceipt={() => navigate("/taxes?filter=upcoming")}
      />
    </div>
  );
}
