import { cn } from "@/lib/utils";
import type { DashboardViewMode } from "./DashboardViewSelector";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { es } from "date-fns/locale";

interface PortfolioHealthProps {
  enrichedObligations: any[]; // raw enriched obligations
  viewMode: DashboardViewMode;
  selectedMonth: string; // "yyyy-MM"
}

interface HealthLevel {
  label: string;
  description: string;
  colorClass: string;       // text color token
  bgClass: string;          // bg token for bar fill
  borderClass: string;      // border token for card
  dotClass: string;         // dot indicator
}

function getHealthLevel(moraPct: number): HealthLevel {
  if (moraPct === 0) {
    return {
      label: "Excelente",
      description: "No hay mora registrada en el período.",
      colorClass: "text-success",
      bgClass: "bg-success",
      borderClass: "border-success/20",
      dotClass: "bg-success",
    };
  }
  if (moraPct <= 10) {
    return {
      label: "Buena",
      description: "Mora baja. La cartera está bajo control.",
      colorClass: "text-success",
      bgClass: "bg-success",
      borderClass: "border-success/20",
      dotClass: "bg-success",
    };
  }
  if (moraPct <= 25) {
    return {
      label: "Regular",
      description: "Mora moderada. Se recomienda seguimiento activo.",
      colorClass: "text-warning",
      bgClass: "bg-warning",
      borderClass: "border-warning/20",
      dotClass: "bg-warning",
    };
  }
  if (moraPct <= 50) {
    return {
      label: "Crítica",
      description: "Mora elevada. Requiere gestión inmediata.",
      colorClass: "text-destructive",
      bgClass: "bg-destructive",
      borderClass: "border-destructive/20",
      dotClass: "bg-destructive",
    };
  }
  return {
    label: "Grave",
    description: "Mora muy alta. Revisar cartera con urgencia.",
    colorClass: "text-destructive",
    bgClass: "bg-destructive",
    borderClass: "border-destructive/20",
    dotClass: "bg-destructive",
  };
}

function getMonthLabel(yearMonth: string): string {
  const [y, m] = yearMonth.split("-").map(Number);
  const d = new Date(y, m - 1, 1);
  const label = format(d, "MMMM yyyy", { locale: es });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function PortfolioHealth({
  enrichedObligations,
  viewMode,
  selectedMonth,
}: PortfolioHealthProps) {
  // ── Calculate mora % ────────────────────────────────────────────────────────
  let totalFacturado = 0;
  let totalMora = 0;

  if (viewMode === "monthly") {
    const [y, m] = selectedMonth.split("-").map(Number);
    const monthStart = format(startOfMonth(new Date(y, m - 1, 1)), "yyyy-MM-dd");
    const monthEnd = format(endOfMonth(new Date(y, m - 1, 1)), "yyyy-MM-dd");

    const inMonth = enrichedObligations.filter(
      (o) => o.due_date >= monthStart && o.due_date <= monthEnd
    );

    for (const o of inMonth) {
      const expected = Number(o.expected_amount ?? 0);
      totalFacturado += expected;
      if (o.balanceDue > 0) {
        totalMora += expected;
      }
    }
  } else {
    // Cumulative
    for (const o of enrichedObligations) {
      const expected = Number(o.expected_amount ?? 0);
      totalFacturado += expected;
      if (o.balanceDue > 0) {
        totalMora += expected;
      }
    }
  }

  const moraPct = totalFacturado > 0 ? (totalMora / totalFacturado) * 100 : 0;
  const cobradoPct = 100 - moraPct;
  const health = getHealthLevel(moraPct);

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(n);

  const scopeLabel =
    viewMode === "monthly"
      ? getMonthLabel(selectedMonth)
      : "Histórico acumulado";

  // Bar width capped at 100
  const barWidth = Math.min(moraPct, 100);

  return (
    <div
      className={cn(
        "rounded-xl border bg-card px-5 py-4 mb-6 flex flex-col sm:flex-row sm:items-center gap-4",
        health.borderClass
      )}
    >
      {/* Left: label + dot */}
      <div className="flex items-center gap-3 sm:w-48 shrink-0">
        <span
          className={cn(
            "inline-block w-2.5 h-2.5 rounded-full shrink-0",
            health.dotClass
          )}
        />
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground leading-none mb-0.5">
            Estado de la cartera
          </p>
          <p className={cn("text-base font-bold leading-tight", health.colorClass)}>
            {health.label}
          </p>
        </div>
      </div>

      {/* Center: bar + pct */}
      <div className="flex-1 min-w-0">
        {/* Progress bar */}
        <div className="relative h-2 w-full rounded-full bg-muted overflow-hidden mb-2">
          {/* cobrado (green always) */}
          <div
            className="absolute left-0 top-0 h-full bg-success/40 rounded-full transition-all duration-500"
            style={{ width: `${cobradoPct}%` }}
          />
          {/* mora overlay at right */}
          {barWidth > 0 && (
            <div
              className={cn(
                "absolute right-0 top-0 h-full rounded-full transition-all duration-500",
                health.bgClass
              )}
              style={{ width: `${barWidth}%`, opacity: 0.85 }}
            />
          )}
        </div>

        {/* Stats row */}
        <div className="flex items-center justify-between gap-4 text-xs text-muted-foreground flex-wrap">
          <span>
            <span className="font-semibold text-foreground">
              {moraPct.toFixed(1)}% mora
            </span>
            {" "}· {scopeLabel}
          </span>
          <span className="hidden sm:inline">
            Facturado: <span className="font-medium text-foreground">{formatCurrency(totalFacturado)}</span>
            {" "}·{" "}
            En mora: <span className={cn("font-medium", moraPct > 0 ? health.colorClass : "text-foreground")}>
              {formatCurrency(totalMora)}
            </span>
          </span>
        </div>
      </div>

      {/* Right: description */}
      <p className="text-xs text-muted-foreground sm:text-right sm:max-w-[200px] shrink-0 hidden md:block">
        {health.description}
      </p>
    </div>
  );
}
