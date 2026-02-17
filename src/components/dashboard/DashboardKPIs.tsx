import { DollarSign, AlertTriangle, Clock, FileWarning, Receipt, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

interface DashboardKPIsProps {
  rentCollectedThisMonth: number;
  rentPendingThisMonth: number;
  rentOverdueAccumulated: number;
  missingProofsCount: number;
  taxesDueSoon: number;
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
    icon: "bg-success/10 text-success",
    value: "text-success",
  },
  warning: {
    card: "border-warning/20 hover:border-warning/40 hover:bg-warning/5",
    icon: "bg-warning/10 text-warning",
    value: "text-warning",
  },
  destructive: {
    card: "border-destructive/20 hover:border-destructive/40 hover:bg-destructive/5",
    icon: "bg-destructive/10 text-destructive",
    value: "text-destructive",
  },
  default: {
    card: "border-border hover:border-primary/30 hover:bg-primary/5",
    icon: "bg-secondary text-secondary-foreground",
    value: "text-foreground",
  },
};

const kpiIcons = {
  collected: DollarSign,
  pending: Clock,
  overdue: AlertTriangle,
  missing: FileWarning,
  taxes: Receipt,
};

function KpiCard({ label, microcopy, value, variant, onClick }: KpiCardProps) {
  const cfg = variantConfig[variant];
  return (
    <button
      onClick={onClick}
      className={cn(
        "group relative flex flex-col gap-3 rounded-xl border bg-card p-5 text-left transition-all duration-200 hover:shadow-md cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        cfg.card
      )}
    >
      <div className="flex items-start justify-between">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
        <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity -mt-0.5" />
      </div>
      <div className={cn("text-2xl font-bold tracking-tight", cfg.value)}>
        {value}
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">{microcopy}</p>
    </button>
  );
}

export function DashboardKPIs({
  rentCollectedThisMonth,
  rentPendingThisMonth,
  rentOverdueAccumulated,
  missingProofsCount,
  taxesDueSoon,
}: DashboardKPIsProps) {
  const { t, i18n } = useTranslation();
  const isEs = i18n.language?.startsWith("es");
  const navigate = useNavigate();

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat(isEs ? "es-AR" : "en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const kpis: (KpiCardProps & { key: string })[] = [
    {
      key: "collected",
      label: isEs ? "Cobrado (mes)" : "Collected (month)",
      microcopy: isEs ? "Fecha de pago en el mes" : "Payment date in current month",
      value: formatCurrency(rentCollectedThisMonth),
      variant: rentCollectedThisMonth > 0 ? "success" : "default",
      onClick: () =>
        navigate(
          `/payment-proofs?kindTab=rent&statusTab=confirmed&period=${currentMonth}`
        ),
    },
    {
      key: "pending",
      label: isEs ? "Pendiente (mes)" : "Pending (month)",
      microcopy: isEs ? "Vencen este mes" : "Due this month",
      value: formatCurrency(rentPendingThisMonth),
      variant: rentPendingThisMonth > 0 ? "warning" : "default",
      onClick: () =>
        navigate(
          `/payment-proofs?kindTab=rent&statusTab=action&dueScope=current_month`
        ),
    },
    {
      key: "overdue",
      label: isEs ? "Mora acumulada" : "Accumulated overdue",
      microcopy: isEs ? "Vencidos de meses anteriores" : "Past due from previous months",
      value: formatCurrency(rentOverdueAccumulated),
      variant: rentOverdueAccumulated > 0 ? "destructive" : "default",
      onClick: () =>
        navigate(`/payment-proofs?kindTab=rent&statusTab=action&dueScope=overdue`),
    },
    {
      key: "missing",
      label: isEs ? "Comprobantes faltantes" : "Missing proofs",
      microcopy: isEs ? "Pagados sin adjunto" : "Confirmed without attachment",
      value: missingProofsCount,
      variant: missingProofsCount > 0 ? "warning" : "default",
      onClick: () =>
        navigate(
          `/payment-proofs?kindTab=rent&statusTab=confirmed&missingProof=true`
        ),
    },
    {
      key: "taxes",
      label: isEs ? "Impuestos próximos" : "Upcoming taxes",
      microcopy: isEs ? "Vencen en 30 días" : "Due in next 30 days",
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
