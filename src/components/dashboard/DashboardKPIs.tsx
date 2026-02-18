import { ChevronRight, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
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
  // Month-over-month comparison (only in monthly view)
  prevMonthCobrado: number | null;
  prevMonthFacturado: number | null;
  prevMonthMora: number | null;
  currentMonthFacturado: number | null;
  currentMonthMora: number | null;
}

type ComparisonSentiment = "cobrado" | "facturado" | "mora";

interface ComparisonData {
  current: number;
  prev: number | null;
  sentiment: ComparisonSentiment;
}

interface KpiCardProps {
  label: string;
  microcopy: string;
  value: string | number;
  variant: "success" | "warning" | "destructive" | "default";
  onClick: () => void;
  comparison?: ComparisonData;
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

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);

function ComparisonBadge({ comparison }: { comparison: ComparisonData }) {
  const { current, prev, sentiment } = comparison;

  if (prev === null) return null;

  // No hay datos del mes anterior
  if (prev === 0) {
    return (
      <p className="text-xs text-muted-foreground mt-0.5">Sin referencia histórica</p>
    );
  }

  const diff = current - prev;
  const pct = ((diff) / prev) * 100;
  const isPositive = diff > 0;
  const isNeutral = diff === 0;

  // Determine color based on sentiment
  let colorClass: string;
  if (isNeutral) {
    colorClass = "text-muted-foreground";
  } else if (sentiment === "cobrado") {
    colorClass = isPositive ? "text-success" : "text-destructive";
  } else if (sentiment === "facturado") {
    colorClass = "text-muted-foreground";
  } else {
    // mora: red if up, green if down
    colorClass = isPositive ? "text-destructive" : "text-success";
  }

  const Icon = isNeutral ? Minus : isPositive ? TrendingUp : TrendingDown;
  const sign = isPositive ? "+" : "";
  const pctStr = `${sign}${pct.toFixed(1)}%`;
  const absStr = `${sign}${formatCurrency(diff)}`;

  return (
    <p className={cn("text-xs mt-0.5 flex items-center gap-0.5 font-medium", colorClass)}>
      <Icon className="w-3 h-3 shrink-0" />
      <span>{pctStr}</span>
      <span className="text-muted-foreground font-normal">({absStr}) vs mes ant.</span>
    </p>
  );
}

function KpiCard({ label, microcopy, value, variant, onClick, comparison }: KpiCardProps) {
  const cfg = variantConfig[variant];
  return (
    <button
      onClick={onClick}
      className={cn(
        "group relative flex flex-col gap-1.5 rounded-xl border bg-card p-5 text-left transition-all duration-200 hover:shadow-md cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
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
      {comparison && <ComparisonBadge comparison={comparison} />}
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
  prevMonthCobrado,
  prevMonthFacturado,
  prevMonthMora,
  currentMonthFacturado,
  currentMonthMora,
}: DashboardKPIsProps) {
  const navigate = useNavigate();
  const monthLabel = getMonthLabel(selectedMonth);

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
      comparison: viewMode === "monthly" ? {
        current: rentCollectedThisMonth,
        prev: prevMonthCobrado,
        sentiment: "cobrado",
      } : undefined,
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
      // Facturado comparison on the Pendiente card
      comparison: viewMode === "monthly" ? {
        current: currentMonthFacturado ?? 0,
        prev: prevMonthFacturado,
        sentiment: "facturado",
      } : undefined,
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
      // Mora del mes comparison
      comparison: viewMode === "monthly" ? {
        current: currentMonthMora ?? 0,
        prev: prevMonthMora,
        sentiment: "mora",
      } : undefined,
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
          comparison={kpi.comparison}
        />
      ))}
    </div>
  );
}
