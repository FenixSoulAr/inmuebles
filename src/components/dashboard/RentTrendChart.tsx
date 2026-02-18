import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  TooltipProps,
} from "recharts";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { es } from "date-fns/locale";
import { TrendingUp } from "lucide-react";

interface RentTrendChartProps {
  enrichedObligations: any[]; // obligations with balanceDue, payments[]
  allPayments: any[];         // flat payments with paid_at + amount
}

interface MonthData {
  monthKey: string;   // "yyyy-MM"
  label: string;      // "Feb 2026"
  facturado: number;
  cobrado: number;
  mora: number;
}

function buildLast6Months(
  enrichedObligations: any[],
  allPayments: any[]
): MonthData[] {
  const now = new Date();
  const months: MonthData[] = [];

  for (let i = 5; i >= 0; i--) {
    const refDate = subMonths(now, i);
    const monthKey = format(refDate, "yyyy-MM");
    const monthStart = format(startOfMonth(refDate), "yyyy-MM-dd");
    const monthEnd = format(endOfMonth(refDate), "yyyy-MM-dd");

    // Label: short month + year
    const labelRaw = format(refDate, "MMM yyyy", { locale: es });
    const label = labelRaw.charAt(0).toUpperCase() + labelRaw.slice(1);

    // Facturado: expected_amount where due_date in month (rent only)
    const oblsInMonth = enrichedObligations.filter(
      (o) => o.due_date >= monthStart && o.due_date <= monthEnd && o.kind === "rent"
    );
    const facturado = oblsInMonth.reduce(
      (s: number, o: any) => s + Number(o.expected_amount ?? 0),
      0
    );

    // Mora: expected_amount where due_date in month AND balance > 0
    const mora = oblsInMonth
      .filter((o) => o.balanceDue > 0)
      .reduce((s: number, o: any) => s + Number(o.expected_amount ?? 0), 0);

    // Cobrado: sum of payments paid_at in this month, for rent obligations only
    const rentOblIds = new Set(enrichedObligations.filter((o) => o.kind === "rent").map((o) => o.id));
    const cobrado = allPayments
      .filter(
        (p: any) =>
          p.paid_at >= monthStart &&
          p.paid_at <= monthEnd &&
          rentOblIds.has(p.obligation_id)
      )
      .reduce((s: number, p: any) => s + Number(p.amount), 0);

    months.push({ monthKey, label, facturado, cobrado, mora });
  }

  return months;
}

const formatCurrencyShort = (value: number) => {
  if (value >= 1_000_000)
    return `$${(value / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (value >= 1_000)
    return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
};

const formatCurrencyFull = (value: number) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);

// ─── Custom Tooltip ───────────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload || payload.length === 0) return null;

  const facturado = (payload.find((p) => p.dataKey === "facturado")?.value as number) ?? 0;
  const cobrado   = (payload.find((p) => p.dataKey === "cobrado")?.value as number) ?? 0;
  const mora      = (payload.find((p) => p.dataKey === "mora")?.value as number) ?? 0;
  const moraPct   = facturado > 0 ? ((mora / facturado) * 100).toFixed(1) : "0.0";

  return (
    <div className="rounded-lg border border-border bg-card shadow-md px-4 py-3 text-sm min-w-[200px]">
      <p className="font-semibold text-foreground mb-2">{label}</p>
      <div className="space-y-1">
        <div className="flex justify-between gap-6">
          <span className="text-muted-foreground">Facturado</span>
          <span className="font-medium text-foreground">{formatCurrencyFull(facturado)}</span>
        </div>
        <div className="flex justify-between gap-6">
          <span className="text-muted-foreground">Cobrado</span>
          <span className="font-medium text-success">{formatCurrencyFull(cobrado)}</span>
        </div>
        <div className="flex justify-between gap-6">
          <span className="text-muted-foreground">Mora</span>
          <span className="font-medium text-destructive">{formatCurrencyFull(mora)}</span>
        </div>
        <div className="border-t border-border pt-1 mt-1 flex justify-between gap-6">
          <span className="text-muted-foreground">% Mora</span>
          <span className={`font-semibold ${Number(moraPct) > 25 ? "text-destructive" : Number(moraPct) > 10 ? "text-warning" : "text-success"}`}>
            {moraPct}%
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export function RentTrendChart({ enrichedObligations, allPayments }: RentTrendChartProps) {
  const data = buildLast6Months(enrichedObligations, allPayments);

  const hasData = data.some((d) => d.facturado > 0 || d.cobrado > 0);

  return (
    <div className="rounded-xl border border-border bg-card px-5 pt-5 pb-4 mb-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">Tendencia últimos 6 meses</h3>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">Facturación vs Cobranza · Solo alquileres</p>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-2 rounded-sm bg-muted-foreground/30" />
            Facturado
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-2 rounded-sm bg-success/70" />
            Cobrado
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-2 rounded-sm bg-destructive/60" />
            Mora
          </span>
        </div>
      </div>

      {/* Chart or empty state */}
      {!hasData ? (
        <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
          No hay suficiente historial para mostrar tendencia.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart
            data={data}
            margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
            barCategoryGap="28%"
            barGap={3}
          >
            <CartesianGrid
              vertical={false}
              strokeDasharray="3 3"
              stroke="rgba(148,163,184,0.3)"
            />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: "#94a3b8" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tickFormatter={formatCurrencyShort}
              tick={{ fontSize: 11, fill: "#94a3b8" }}
              axisLine={false}
              tickLine={false}
              width={56}
            />
            <Tooltip
              content={<CustomTooltip />}
              cursor={{ fill: "rgba(148,163,184,0.15)", radius: 4 }}
            />
            <Bar
              dataKey="facturado"
              name="Facturado"
              fill="rgba(148,163,184,0.35)"
              radius={[3, 3, 0, 0]}
            />
            <Bar
              dataKey="cobrado"
              name="Cobrado"
              fill="rgba(34,197,94,0.7)"
              radius={[3, 3, 0, 0]}
            />
            <Bar
              dataKey="mora"
              name="Mora"
              fill="rgba(239,68,68,0.6)"
              radius={[3, 3, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
