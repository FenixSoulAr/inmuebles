import { ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { format, startOfMonth, endOfMonth, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import type { DashboardViewMode } from "./DashboardViewSelector";

interface DashboardKPIsProps {
  rentCollectedThisMonth: number;
  rentPendingThisMonth: number;
  rentOverdueAccumulated: number;
  missingProofsCount: number;
  taxesDueSoon: number;
  viewMode: DashboardViewMode;
  selectedMonth: string; // "yyyy-MM"
}

interface KpiCardProps {
  label: string;
  microcopy: string;
  value: string | number;
  variant: "success" | "warning" | "destructive" | "default";
  onClick: () => void;
}

const variantConfig = {
  success: {
    card: "border-success/20 hover:border-success/40 hover:bg-success/5",
    value: "text-success",
  },
  warning: {
    card: "border-warning/20 hover:border-warning/40 hover:bg-warning/5",
    value: "text-warning",
  },
  destructive: {
    card: "border-destructive/20 hover:border-destructive/40 hover:bg-destructive/5",
    value: "text-destructive",
  },
  default: {
    card: "border-border hover:border-primary/30 hover:bg-primary/5",
    value: "text-foreground",
  },
};

function KpiCard({ label, microcopy, value, variant, onClick }: KpiCardProps) {
  const cfg = variantConfig[variant];
  return (
    <button
      onClick={onClick}
      className={cn(
        "group relative flex flex-col gap-2 rounded-xl border bg-card p-5 text-left transition-all duration-200 hover:shadow-md cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        cfg.card
      )}
    >
      <div className="flex items-start justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground leading-tight pr-4">
          {label}
        </p>
        <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 -mt-0.5" />
      </div>
      <div className={cn("text-2xl font-bold tracking-tight", cfg.value)}>
        {value}
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">{microcopy}</p>
    </button>
  );
}

function getMonthLabel(yearMonth: string): string {
  const [y, m] = yearMonth.split("-").map(Number);
  const d = new Date(y, m - 1, 1);
  const label = format(d, "MMMM yyyy", { locale: es });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function DashboardKPIs({
  rentCollectedThisMonth,
  rentPendingThisMonth,
  rentOverdueAccumulated,
  missingProofsCount,
  taxesDueSoon,
  viewMode,
  selectedMonth,
}: DashboardKPIsProps) {
  const navigate = useNavigate();
  const monthLabel = getMonthLabel(selectedMonth);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);

  // Build navigation URLs based on view mode
  const buildUrl = (base: string) => {
    if (viewMode === "cumulative") {
      return `${base}&viewMode=cumulative`;
    }
    return `${base}&viewMode=monthly&month=${selectedMonth}`;
  };

  const kpis: (KpiCardProps & { key: string })[] = [
    {
      key: "collected",
      label: "Cobrado",
      microcopy:
        viewMode === "monthly"
          ? `Pagos registrados en ${monthLabel}`
          : "Total cobrado (histórico)",
      value: formatCurrency(rentCollectedThisMonth),
      variant: rentCollectedThisMonth > 0 ? "success" : "default",
      onClick: () =>
        navigate(
          buildUrl(
            viewMode === "monthly"
              ? `/payment-proofs?kindTab=rent&statusTab=confirmed&period=${selectedMonth}`
              : `/payment-proofs?kindTab=rent&statusTab=confirmed`
          )
        ),
    },
    {
      key: "pending",
      label: "Pendiente",
      microcopy:
        viewMode === "monthly"
          ? `Vence en ${monthLabel} (no cobrado)`
          : "Pendiente total (sin filtro temporal)",
      value: formatCurrency(rentPendingThisMonth),
      variant: rentPendingThisMonth > 0 ? "warning" : "default",
      onClick: () =>
        navigate(
          buildUrl(
            viewMode === "monthly"
              ? `/payment-proofs?kindTab=rent&statusTab=action&dueScope=current_month`
              : `/payment-proofs?kindTab=rent&statusTab=action`
          )
        ),
    },
    {
      key: "overdue",
      label: "Mora acumulada",
      microcopy:
        viewMode === "monthly"
          ? `Vencidos antes de ${monthLabel}`
          : "Mora total histórica (due_date < hoy)",
      value: formatCurrency(rentOverdueAccumulated),
      variant: rentOverdueAccumulated > 0 ? "destructive" : "default",
      onClick: () =>
        navigate(
          buildUrl(`/payment-proofs?kindTab=rent&statusTab=action&dueScope=overdue`)
        ),
    },
    {
      key: "missing",
      label: "Comprobantes faltantes",
      microcopy:
        viewMode === "monthly"
          ? `Confirmados en ${monthLabel} sin adjunto`
          : "Confirmados sin comprobante (histórico)",
      value: missingProofsCount,
      variant: missingProofsCount > 0 ? "warning" : "default",
      onClick: () =>
        navigate(
          buildUrl(
            `/payment-proofs?kindTab=rent&statusTab=confirmed&missingProof=true`
          )
        ),
    },
    {
      key: "taxes",
      label: "Impuestos próximos",
      microcopy: "Vencen en 30 días",
      value: taxesDueSoon,
      variant: taxesDueSoon > 0 ? "warning" : "default",
      onClick: () => navigate("/taxes?filter=upcoming"),
    },
  ];

  return (
    <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 mb-8">
      {kpis.map((kpi) => (
        <KpiCard
          key={kpi.key}
          label={kpi.label}
          microcopy={kpi.microcopy}
          value={kpi.value}
          variant={kpi.variant}
          onClick={kpi.onClick}
        />
      ))}
    </div>
  );
}
