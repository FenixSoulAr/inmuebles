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
import { DashboardViewSelector, type DashboardViewMode } from "@/components/dashboard/DashboardViewSelector";
import { PortfolioHealth } from "@/components/dashboard/PortfolioHealth";
import { RentTrendChart } from "@/components/dashboard/RentTrendChart";
import {
  ActionCenter,
  OverdueRentItem,
  DueSoonItem,
  MissingProofItem,
  TaxDueItem,
  MaintenanceItem,
  UpcomingAdjustmentItem,
} from "@/components/dashboard/ActionCenter";
import { format, startOfMonth, endOfMonth, parseISO, subMonths, addMonths } from "date-fns";

interface DashboardStats {
  rentCollectedThisMonth: number;
  rentPendingThisMonth: number;
  rentOverdueAccumulated: number;
  missingProofsCount: number;
  taxesDueSoon: number;
  adjustmentsDueSoon: number;
  // Month-over-month comparison (only used in monthly view)
  prevMonthCobrado: number | null;
  prevMonthFacturado: number | null;
  prevMonthMora: number | null;
  currentMonthFacturado: number | null;
  currentMonthMora: number | null;
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    rentCollectedThisMonth: 0,
    rentPendingThisMonth: 0,
    rentOverdueAccumulated: 0,
    missingProofsCount: 0,
    taxesDueSoon: 0,
    adjustmentsDueSoon: 0,
    prevMonthCobrado: null,
    prevMonthFacturado: null,
    prevMonthMora: null,
    currentMonthFacturado: null,
    currentMonthMora: null,
  });
  const [overdueRent, setOverdueRent] = useState<OverdueRentItem[]>([]);
  const [dueSoon, setDueSoon] = useState<DueSoonItem[]>([]);
  const [missingProofs, setMissingProofs] = useState<MissingProofItem[]>([]);
  const [taxesDue, setTaxesDue] = useState<TaxDueItem[]>([]);
  const [openMaintenance, setOpenMaintenance] = useState<MaintenanceItem[]>([]);
  const [upcomingAdjustments, setUpcomingAdjustments] = useState<UpcomingAdjustmentItem[]>([]);
  const [loading, setLoading] = useState(true);

  // View mode state
  const [viewMode, setViewMode] = useState<DashboardViewMode>("monthly");
  const [selectedMonth, setSelectedMonth] = useState<string>(
    format(new Date(), "yyyy-MM")
  );

  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useTranslation();

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user]);

  // Recalculate KPIs when view mode or selected month changes (without refetching)
  useEffect(() => {
    if (!loading) {
      computeKPIs();
    }
  }, [viewMode, selectedMonth]);

  // Store raw data for recalculation
  const [rawEnriched, setRawEnriched] = useState<any[]>([]);
  const [rawAllPayments, setRawAllPayments] = useState<any[]>([]);
  const [rawTaxItems, setRawTaxItems] = useState<TaxDueItem[]>([]);
  const [rawMaintenanceItems, setRawMaintenanceItems] = useState<MaintenanceItem[]>([]);
  const [rawAdjustmentsCount, setRawAdjustmentsCount] = useState<number>(0);

  const computeKPIs = () => {
    const enriched = rawEnriched;
    const allPayments = rawAllPayments;
    if (enriched.length === 0 && allPayments.length === 0) return;

    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];

    if (viewMode === "monthly") {
      // Parse the selected month to get bounds
      const [y, m] = selectedMonth.split("-").map(Number);
      const monthDate = new Date(y, m - 1, 1);
      const monthStartStr = format(startOfMonth(monthDate), "yyyy-MM-dd");
      const monthEndStr = format(endOfMonth(monthDate), "yyyy-MM-dd");

      // Compute previous month bounds
      const prevMonthDate = subMonths(monthDate, 1);
      const prevMonthStartStr = format(startOfMonth(prevMonthDate), "yyyy-MM-dd");
      const prevMonthEndStr = format(endOfMonth(prevMonthDate), "yyyy-MM-dd");

      // KPI 1: Cobrado — confirmed obligations with payments paid_at in selected month
      const paymentsInMonth = allPayments.filter(
        (p: any) => p.paid_at >= monthStartStr && p.paid_at <= monthEndStr
      );
      const confirmedOblIds = new Set(
        enriched.filter((o: any) => o.balanceDue <= 0).map((o: any) => o.id)
      );
      const rentCollected = paymentsInMonth
        .filter((p: any) => confirmedOblIds.has(p.obligation_id))
        .reduce((s: number, p: any) => s + Number(p.amount), 0);

      // KPI 2: Pendiente — not confirmed, due_date in selected month
      const pendingThisMonth = enriched.filter(
        (o: any) =>
          o.balanceDue > 0 &&
          o.due_date >= monthStartStr &&
          o.due_date <= monthEndStr
      );
      const rentPending = pendingThisMonth.reduce((s: number, o: any) => s + o.balanceDue, 0);

      // KPI 3: Mora — not confirmed, due_date < first day of selected month
      const overdueObls = enriched.filter(
        (o: any) => o.balanceDue > 0 && o.due_date < monthStartStr
      );
      const rentOverdue = overdueObls.reduce((s: number, o: any) => s + o.balanceDue, 0);

      // KPI 4: Missing proofs — confirmed in selected month + proof_status = required
      const confirmedInMonth = enriched.filter((o: any) => {
        if (o.balanceDue > 0) return false;
        const sortedPays = [...(o.payments || [])].sort(
          (a: any, b: any) => new Date(b.paid_at).getTime() - new Date(a.paid_at).getTime()
        );
        const lastPaidAt = sortedPays[0]?.paid_at;
        return lastPaidAt && lastPaidAt >= monthStartStr && lastPaidAt <= monthEndStr;
      });
      const missingProofsCount = confirmedInMonth.filter((o: any) => {
        const ps = o.payment_proofs?.proof_status;
        return ps !== "waived" && ps !== "uploaded";
      }).length;

      // --- Month-over-month comparison ---
      // Facturado M: SUM(expected_amount where due_date in M)
      const currentMonthFacturado = enriched
        .filter((o: any) => o.due_date >= monthStartStr && o.due_date <= monthEndStr)
        .reduce((s: number, o: any) => s + Number(o.expected_amount ?? 0), 0);

      // Mora M: SUM(expected_amount where due_date in M AND not confirmed)
      const currentMonthMora = enriched
        .filter((o: any) =>
          o.due_date >= monthStartStr && o.due_date <= monthEndStr && o.balanceDue > 0
        )
        .reduce((s: number, o: any) => s + Number(o.expected_amount ?? 0), 0);

      // Cobrado M-1: payments paid_at in prev month for confirmed obligations
      const prevMonthCobrado = allPayments
        .filter((p: any) =>
          p.paid_at >= prevMonthStartStr &&
          p.paid_at <= prevMonthEndStr &&
          confirmedOblIds.has(p.obligation_id)
        )
        .reduce((s: number, p: any) => s + Number(p.amount), 0);

      // Facturado M-1: SUM(expected_amount where due_date in M-1)
      const prevMonthFacturado = enriched
        .filter((o: any) => o.due_date >= prevMonthStartStr && o.due_date <= prevMonthEndStr)
        .reduce((s: number, o: any) => s + Number(o.expected_amount ?? 0), 0);

      // Mora M-1: SUM(expected_amount where due_date in M-1 AND not confirmed)
      const prevMonthMora = enriched
        .filter((o: any) =>
          o.due_date >= prevMonthStartStr && o.due_date <= prevMonthEndStr && o.balanceDue > 0
        )
        .reduce((s: number, o: any) => s + Number(o.expected_amount ?? 0), 0);

      // Action center items
      const overdueItems: OverdueRentItem[] = overdueObls.map((o: any) => ({
        id: o.id,
        property: o.properties?.internal_identifier || "—",
        tenant: o.tenants?.full_name || "—",
        dueDate: o.due_date,
        balanceDue: o.balanceDue,
        status: "overdue",
      }));

      const in7DaysStr = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      const dueSoonItems: DueSoonItem[] = enriched
        .filter(
          (o: any) =>
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

      const confirmedRentObls = enriched.filter((o: any) => o.balanceDue <= 0);
      const missingProofItems: MissingProofItem[] = confirmedRentObls
        .filter((o: any) => {
          const ps = o.payment_proofs?.proof_status;
          return ps !== "waived" && ps !== "uploaded";
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

      setStats({
        rentCollectedThisMonth: rentCollected,
        rentPendingThisMonth: rentPending,
        rentOverdueAccumulated: rentOverdue,
        missingProofsCount,
        taxesDueSoon: rawTaxItems.length,
        adjustmentsDueSoon: rawAdjustmentsCount,
        prevMonthCobrado,
        prevMonthFacturado,
        prevMonthMora,
        currentMonthFacturado,
        currentMonthMora,
      });
      setOverdueRent(overdueItems);
      setDueSoon(dueSoonItems);
      setMissingProofs(missingProofItems);
    } else {
      // CUMULATIVE VIEW — no month-over-month comparison
      const rentCollected = allPayments
        .filter((p: any) => {
          const obl = enriched.find((o: any) => o.id === p.obligation_id);
          return obl && obl.balanceDue <= 0;
        })
        .reduce((s: number, p: any) => s + Number(p.amount), 0);

      const rentPending = enriched
        .filter((o: any) => o.balanceDue > 0)
        .reduce((s: number, o: any) => s + o.balanceDue, 0);

      const overdueObls = enriched.filter(
        (o: any) => o.balanceDue > 0 && o.due_date < todayStr
      );
      const rentOverdue = overdueObls.reduce((s: number, o: any) => s + o.balanceDue, 0);

      const confirmedRentObls = enriched.filter((o: any) => o.balanceDue <= 0);
      const missingProofsCount = confirmedRentObls.filter((o: any) => {
        const ps = o.payment_proofs?.proof_status;
        return ps !== "waived" && ps !== "uploaded";
      }).length;

      const overdueItems: OverdueRentItem[] = overdueObls.map((o: any) => ({
        id: o.id,
        property: o.properties?.internal_identifier || "—",
        tenant: o.tenants?.full_name || "—",
        dueDate: o.due_date,
        balanceDue: o.balanceDue,
        status: "overdue",
      }));

      const in7DaysStr = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      const dueSoonItems: DueSoonItem[] = enriched
        .filter(
          (o: any) =>
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

      const missingProofItems: MissingProofItem[] = confirmedRentObls
        .filter((o: any) => {
          const ps = o.payment_proofs?.proof_status;
          return ps !== "waived" && ps !== "uploaded";
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

      setStats({
        rentCollectedThisMonth: rentCollected,
        rentPendingThisMonth: rentPending,
        rentOverdueAccumulated: rentOverdue,
        missingProofsCount,
        taxesDueSoon: rawTaxItems.length,
        adjustmentsDueSoon: rawAdjustmentsCount,
        prevMonthCobrado: null,
        prevMonthFacturado: null,
        prevMonthMora: null,
        currentMonthFacturado: null,
        currentMonthMora: null,
      });
      setOverdueRent(overdueItems);
      setDueSoon(dueSoonItems);
      setMissingProofs(missingProofItems);
    }
  };


  const fetchDashboardData = async () => {
    try {
      const now = new Date();
      const todayStr = now.toISOString().split("T")[0];
      const in30DaysStr = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      const in90DaysStr = format(addMonths(now, 3), "yyyy-MM-dd");

      const [oblRes, allPaymentsRes, taxesRes, maintenanceRes, contractsRes, confirmedAdjRes] = await Promise.all([
        supabase
          .from("obligations")
          .select(`
            id, period, due_date, expected_amount, status, kind, payment_proof_id, currency,
            properties(internal_identifier),
            tenants(full_name),
            payment_proofs!obligations_payment_proof_id_fkey(id, files, amount, status, proof_status)
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
        supabase
          .from("contracts")
          .select(`id, start_date, adjustment_frequency, current_rent, currency, properties(internal_identifier), tenants(full_name)`)
          .eq("is_active", true),
        supabase
          .from("contract_adjustments")
          .select("contract_id, adjustment_date")
          .eq("status", "confirmed")
          .order("adjustment_date", { ascending: false }),
      ]);

      const rawObls = (oblRes.data || []) as any[];
      const allPayments = (allPaymentsRes.data || []) as any[];

      const paymentsByObl = new Map<string, any[]>();
      for (const p of allPayments) {
        const list = paymentsByObl.get(p.obligation_id) || [];
        list.push(p);
        paymentsByObl.set(p.obligation_id, list);
      }

      const enriched = rawObls.map((o) => {
        const payments = paymentsByObl.get(o.id) || [];
        const totalPaid = payments.reduce((s: number, p: any) => s + Number(p.amount), 0);
        const expected = Number(o.expected_amount ?? 0);
        const balanceDue = Math.max(expected - totalPaid, 0);
        return { ...o, payments, totalPaid, balanceDue };
      });

      const taxes = taxesRes.data || [];
      const taxItems: TaxDueItem[] = taxes.map((t: any) => ({
        id: t.id,
        property: t.properties?.internal_identifier || "—",
        taxType: formatTaxType(t.type),
        dueDate: t.due_date,
        status: t.status,
      }));

      const maintenance = maintenanceRes.data || [];
      const maintenanceItems: MaintenanceItem[] = maintenance.map((m: any) => ({
        id: m.id,
        property: m.properties?.internal_identifier || "—",
        issue: m.description,
        status: m.status,
      }));

      // Compute upcoming adjustments count (within 90 days)
      const lastConfirmedMap: Record<string, string> = {};
      for (const adj of confirmedAdjRes.data || []) {
        if (!lastConfirmedMap[adj.contract_id]) {
          lastConfirmedMap[adj.contract_id] = adj.adjustment_date;
        }
      }

      let adjCount = 0;
      const adjItems: UpcomingAdjustmentItem[] = [];
      for (const c of (contractsRes.data || []) as any[]) {
        const freq = c.adjustment_frequency ?? 12;
        if (freq <= 0) continue;
        const base = lastConfirmedMap[c.id]
          ? parseISO(lastConfirmedMap[c.id])
          : parseISO(c.start_date);
        const nextDate = format(addMonths(base, freq), "yyyy-MM-dd");
        if (nextDate >= todayStr && nextDate <= in90DaysStr) {
          adjCount++;
          adjItems.push({
            contractId: c.id,
            property: c.properties?.internal_identifier || "—",
            tenant: c.tenants?.full_name || "—",
            nextAdjustmentDate: nextDate,
            currentRent: Number(c.current_rent),
            currencyRent: c.currency ?? "ARS",
            adjustmentFrequency: freq,
          });
        }
      }
      adjItems.sort((a, b) => a.nextAdjustmentDate.localeCompare(b.nextAdjustmentDate));

      // Store raw data for recalculation on view mode / month changes
      setRawEnriched(enriched);
      setRawAllPayments(allPayments);
      setRawTaxItems(taxItems);
      setRawMaintenanceItems(maintenanceItems);
      setRawAdjustmentsCount(adjCount);
      setTaxesDue(taxItems);
      setOpenMaintenance(maintenanceItems);
      setUpcomingAdjustments(adjItems);
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

  // Trigger initial KPI computation after raw data is loaded
  useEffect(() => {
    if (!loading && rawEnriched.length >= 0) {
      computeKPIs();
    }
  }, [rawEnriched, rawAllPayments]);

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

      {/* View mode selector — aligned to the right */}
      <div className="flex justify-end mb-5">
        <DashboardViewSelector
          mode={viewMode}
          onModeChange={(m) => setViewMode(m)}
          selectedMonth={selectedMonth}
          onMonthChange={(month) => setSelectedMonth(month)}
        />
      </div>

      {/* Portfolio Health indicator */}
      <PortfolioHealth
        enrichedObligations={rawEnriched}
        viewMode={viewMode}
        selectedMonth={selectedMonth}
      />

      {/* KPI Cards */}
      <DashboardKPIs
        rentCollectedThisMonth={stats.rentCollectedThisMonth}
        rentPendingThisMonth={stats.rentPendingThisMonth}
        rentOverdueAccumulated={stats.rentOverdueAccumulated}
        missingProofsCount={stats.missingProofsCount}
        taxesDueSoon={stats.taxesDueSoon}
        adjustmentsDueSoon={stats.adjustmentsDueSoon}
        viewMode={viewMode}
        selectedMonth={selectedMonth}
        prevMonthCobrado={stats.prevMonthCobrado}
        prevMonthFacturado={stats.prevMonthFacturado}
        prevMonthMora={stats.prevMonthMora}
        currentMonthFacturado={stats.currentMonthFacturado}
        currentMonthMora={stats.currentMonthMora}
      />

      {/* Rent trend chart — last 6 months */}
      <RentTrendChart
        enrichedObligations={rawEnriched}
        allPayments={rawAllPayments}
      />

      {/* Action Center */}
      <ActionCenter
        overdueRent={overdueRent}
        dueSoon={dueSoon}
        missingProofs={missingProofs}
        taxesDueSoon={taxesDue}
        openMaintenance={openMaintenance}
        upcomingAdjustments={upcomingAdjustments}
        onRecordPayment={(_id) => navigate(`/payment-proofs?kindTab=rent&statusTab=action`)}
        onUploadProof={() => navigate("/payment-proofs?kindTab=rent&statusTab=confirmed&missingProof=true")}
        onUploadTaxReceipt={() => navigate("/taxes?filter=upcoming")}
      />
    </div>
  );
}
