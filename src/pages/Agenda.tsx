import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Calendar,
  FileText,
  TrendingUp,
  ArrowRight,
  RefreshCw,
  Clock,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { addMonths, format, parseISO, differenceInDays } from "date-fns";
import { es } from "date-fns/locale";

// ─── Types ────────────────────────────────────────────────────────────────────

type EventType = "contract_end" | "rent_adjustment";
type EventStatus = "overdue" | "red" | "amber" | "green";
type FilterType = "all" | "contract_end" | "rent_adjustment";
type FilterStatus = "all" | "overdue" | "critical" | "upcoming" | "plannable";
type FilterRange = 30 | 60 | 90;

interface AgendaEvent {
  id: string;
  type: EventType;
  date: string; // yyyy-MM-dd
  title: string;
  property: string;
  tenant: string;
  daysTo: number; // negative = overdue
  status: EventStatus;
  contractId: string;
  currentRent?: number;
  currency?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const todayStr = () => format(new Date(), "yyyy-MM-dd");

function computeStatus(daysTo: number, type: EventType): EventStatus {
  if (daysTo < 0) return "overdue";
  if (type === "contract_end") {
    if (daysTo <= 30) return "red";
    if (daysTo <= 60) return "amber";
    return "green";
  } else {
    if (daysTo <= 15) return "red";
    if (daysTo <= 45) return "amber";
    return "green";
  }
}

function daysLabel(days: number): string {
  if (days === 0) return "Hoy";
  if (days < 0) return `Vencido hace ${Math.abs(days)} día${Math.abs(days) !== 1 ? "s" : ""}`;
  return `En ${days} día${days !== 1 ? "s" : ""}`;
}

function formatDateHeader(dateStr: string): string {
  const d = parseISO(dateStr);
  return format(d, "EEEE d 'de' MMMM yyyy", { locale: es });
}

// ─── Badge components ─────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<EventStatus, { label: string; className: string; dot: string }> = {
  overdue: {
    label: "Vencido",
    className: "bg-destructive/10 text-destructive border border-destructive/20",
    dot: "bg-destructive",
  },
  red: {
    label: "Crítico",
    className: "bg-destructive/10 text-destructive border border-destructive/20",
    dot: "bg-destructive",
  },
  amber: {
    label: "Próximo",
    className: "bg-warning/10 text-warning border border-warning/20",
    dot: "bg-warning",
  },
  green: {
    label: "Planificable",
    className: "bg-success/10 text-success border border-success/20",
    dot: "bg-success",
  },
};

const TYPE_CONFIG: Record<EventType, { label: string; icon: React.ElementType; className: string }> = {
  contract_end: {
    label: "Vencimiento",
    icon: FileText,
    className: "bg-primary/10 text-primary border border-primary/20",
  },
  rent_adjustment: {
    label: "Ajuste de alquiler",
    icon: TrendingUp,
    className: "bg-accent/10 text-accent border border-accent/20",
  },
};

function StatusDot({ status }: { status: EventStatus }) {
  return (
    <span
      className={cn(
        "inline-block w-2.5 h-2.5 rounded-full shrink-0 mt-1",
        STATUS_CONFIG[status].dot
      )}
    />
  );
}

function TypeBadge({ type }: { type: EventType }) {
  const cfg = TYPE_CONFIG[type];
  const Icon = cfg.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium", cfg.className)}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
}

function StatusBadgeLocal({ status }: { status: EventStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium", cfg.className)}>
      <span className={cn("w-1.5 h-1.5 rounded-full", cfg.dot)} />
      {cfg.label}
    </span>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function Agenda() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [events, setEvents] = useState<AgendaEvent[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [typeFilter, setTypeFilter] = useState<FilterType>("all");
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("all");
  const [range, setRange] = useState<FilterRange>(90);

  useEffect(() => {
    if (user) fetchEvents();
  }, [user]);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const [contractsRes, confirmedAdjRes] = await Promise.all([
        supabase
          .from("contracts")
          .select(`
            id, start_date, end_date, current_rent, currency, adjustment_frequency,
            properties(internal_identifier),
            tenants(full_name)
          `)
          .eq("is_active", true),
        supabase
          .from("contract_adjustments")
          .select("contract_id, adjustment_date")
          .eq("status", "confirmed")
          .order("adjustment_date", { ascending: false }),
      ]);

      const contracts = (contractsRes.data || []) as any[];

      // Build last-confirmed map
      const lastConfirmedMap: Record<string, string> = {};
      for (const adj of confirmedAdjRes.data || []) {
        if (!lastConfirmedMap[adj.contract_id]) {
          lastConfirmedMap[adj.contract_id] = adj.adjustment_date;
        }
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const computed: AgendaEvent[] = [];

      for (const c of contracts) {
        const property = c.properties?.internal_identifier || "—";
        const tenant = c.tenants?.full_name || "—";

        // ── Event 1: Contract end ────────────────────────────────────────────
        if (c.end_date) {
          const endDate = parseISO(c.end_date);
          const daysTo = differenceInDays(endDate, today);
          const status = computeStatus(daysTo, "contract_end");

          computed.push({
            id: `ce-${c.id}`,
            type: "contract_end",
            date: c.end_date,
            title: "Vence contrato",
            property,
            tenant,
            daysTo,
            status,
            contractId: c.id,
          });
        }

        // ── Event 2: Rent adjustment ─────────────────────────────────────────
        const freq = c.adjustment_frequency ?? 12;
        if (freq > 0 && c.start_date) {
          const base = lastConfirmedMap[c.id]
            ? parseISO(lastConfirmedMap[c.id])
            : parseISO(c.start_date);
          const nextAdj = addMonths(base, freq);
          const nextAdjStr = format(nextAdj, "yyyy-MM-dd");
          const daysTo = differenceInDays(nextAdj, today);
          const status = computeStatus(daysTo, "rent_adjustment");

          computed.push({
            id: `ra-${c.id}`,
            type: "rent_adjustment",
            date: nextAdjStr,
            title: "Ajustar alquiler",
            property,
            tenant,
            daysTo,
            status,
            contractId: c.id,
            currentRent: Number(c.current_rent),
            currency: c.currency ?? "ARS",
          });
        }
      }

      // Sort by date, then overdue last
      computed.sort((a, b) => {
        if (a.daysTo < 0 && b.daysTo >= 0) return 1;
        if (a.daysTo >= 0 && b.daysTo < 0) return -1;
        return a.date.localeCompare(b.date);
      });

      setEvents(computed);
    } catch (err) {
      console.error("Error fetching agenda events:", err);
    } finally {
      setLoading(false);
    }
  };

  // ─── Filtering ─────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return events.filter((ev) => {
      // Type filter
      if (typeFilter !== "all" && ev.type !== typeFilter) return false;

      // Range filter: include overdue always OR within range
      const inRange = ev.daysTo < 0 || ev.daysTo <= range;
      if (!inRange) return false;

      // Status filter
      if (statusFilter === "overdue" && ev.status !== "overdue") return false;
      if (statusFilter === "critical" && ev.status !== "red") return false;
      if (statusFilter === "upcoming" && ev.status !== "amber") return false;
      if (statusFilter === "plannable" && ev.status !== "green") return false;

      return true;
    });
  }, [events, typeFilter, statusFilter, range]);

  // Group by date — overdue items go into a special group
  const grouped = useMemo(() => {
    const overdueItems = filtered.filter((ev) => ev.daysTo < 0);
    const futureItems = filtered.filter((ev) => ev.daysTo >= 0);

    const groups: { label: string; dateKey: string; items: AgendaEvent[] }[] = [];

    if (overdueItems.length > 0) {
      groups.push({ label: "Vencidos", dateKey: "__overdue", items: overdueItems });
    }

    const byDate = new Map<string, AgendaEvent[]>();
    for (const ev of futureItems) {
      if (!byDate.has(ev.date)) byDate.set(ev.date, []);
      byDate.get(ev.date)!.push(ev);
    }
    for (const [dateKey, items] of byDate) {
      groups.push({
        label: formatDateHeader(dateKey),
        dateKey,
        items,
      });
    }

    return groups;
  }, [filtered]);

  // Summary counts
  const counts = useMemo(() => {
    const inWindow = events.filter((ev) => ev.daysTo >= 0 && ev.daysTo <= 90);
    return {
      overdue: events.filter((e) => e.status === "overdue").length,
      red: inWindow.filter((e) => e.status === "red").length,
      amber: inWindow.filter((e) => e.status === "amber").length,
      green: inWindow.filter((e) => e.status === "green").length,
    };
  }, [events]);

  const formatCurrency = (amount: number, currency: string) =>
    new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: currency === "USD" ? "USD" : "ARS",
      minimumFractionDigits: 0,
    }).format(amount);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Agenda operativa"
        description="Vencimientos de contratos y ajustes de alquiler programados."
      >
        <Button variant="outline" size="sm" onClick={fetchEvents} className="gap-1">
          <RefreshCw className="w-4 h-4" />
          Actualizar
        </Button>
      </PageHeader>

      {/* Summary strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          {
            label: "Vencidos",
            count: counts.overdue,
            className: "border-destructive/20 bg-destructive/5",
            dotClass: "bg-destructive",
            textClass: "text-destructive",
          },
          {
            label: "Críticos",
            count: counts.red,
            className: "border-destructive/20 bg-destructive/5",
            dotClass: "bg-destructive",
            textClass: "text-destructive",
          },
          {
            label: "Próximos",
            count: counts.amber,
            className: "border-warning/20 bg-warning/5",
            dotClass: "bg-warning",
            textClass: "text-warning",
          },
          {
            label: "Planificables",
            count: counts.green,
            className: "border-success/20 bg-success/5",
            dotClass: "bg-success",
            textClass: "text-success",
          },
        ].map(({ label, count, className, dotClass, textClass }) => (
          <div
            key={label}
            className={cn(
              "flex items-center gap-3 rounded-xl border p-4",
              className
            )}
          >
            <span className={cn("w-3 h-3 rounded-full shrink-0", dotClass)} />
            <div>
              <p className={cn("text-2xl font-bold leading-none", textClass)}>{count}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        {/* Type filter */}
        <Tabs value={typeFilter} onValueChange={(v) => setTypeFilter(v as FilterType)}>
          <TabsList className="h-8">
            <TabsTrigger value="all" className="text-xs h-7 px-3">Todos</TabsTrigger>
            <TabsTrigger value="contract_end" className="text-xs h-7 px-3 gap-1">
              <FileText className="w-3 h-3" />Vencimientos
            </TabsTrigger>
            <TabsTrigger value="rent_adjustment" className="text-xs h-7 px-3 gap-1">
              <TrendingUp className="w-3 h-3" />Ajustes
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Status filter */}
        <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as FilterStatus)}>
          <TabsList className="h-8">
            <TabsTrigger value="all" className="text-xs h-7 px-3">Todos</TabsTrigger>
            <TabsTrigger value="overdue" className="text-xs h-7 px-3 text-destructive data-[state=active]:text-destructive">Vencidos</TabsTrigger>
            <TabsTrigger value="critical" className="text-xs h-7 px-3">Críticos</TabsTrigger>
            <TabsTrigger value="upcoming" className="text-xs h-7 px-3">Próximos</TabsTrigger>
            <TabsTrigger value="plannable" className="text-xs h-7 px-3">Planificables</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Range filter */}
        <Tabs value={String(range)} onValueChange={(v) => setRange(Number(v) as FilterRange)}>
          <TabsList className="h-8">
            <TabsTrigger value="30" className="text-xs h-7 px-3">30 días</TabsTrigger>
            <TabsTrigger value="60" className="text-xs h-7 px-3">60 días</TabsTrigger>
            <TabsTrigger value="90" className="text-xs h-7 px-3">90 días</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Event list */}
      {grouped.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="Sin eventos en este período"
          description="No hay vencimientos ni ajustes en el rango seleccionado."
        />
      ) : (
        <div className="space-y-6">
          {grouped.map((group) => (
            <div key={group.dateKey}>
              {/* Group header */}
              <div className="flex items-center gap-3 mb-3">
                {group.dateKey === "__overdue" ? (
                  <>
                    <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
                    <h3 className="text-sm font-semibold text-destructive uppercase tracking-wider">
                      {group.label}
                    </h3>
                  </>
                ) : (
                  <>
                    <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
                    <h3 className="text-sm font-semibold text-foreground capitalize">
                      {group.label}
                    </h3>
                  </>
                )}
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-muted-foreground">{group.items.length} evento{group.items.length !== 1 ? "s" : ""}</span>
              </div>

              {/* Events */}
              <div className="space-y-2">
                {group.items.map((ev) => (
                  <EventCard
                    key={ev.id}
                    event={ev}
                    onNavigate={() =>
                      ev.type === "rent_adjustment"
                        ? navigate(`/contracts/${ev.contractId}?openAdjustment=true`)
                        : navigate(`/contracts/${ev.contractId}`)
                    }
                    formatCurrency={formatCurrency}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Event Card ───────────────────────────────────────────────────────────────

function EventCard({
  event: ev,
  onNavigate,
  formatCurrency,
}: {
  event: AgendaEvent;
  onNavigate: () => void;
  formatCurrency: (amount: number, currency: string) => string;
}) {
  const isOverdue = ev.daysTo < 0;
  const statusCfg = STATUS_CONFIG[ev.status];

  return (
    <Card
      className={cn(
        "transition-all duration-200 hover:shadow-md",
        isOverdue && "border-destructive/30 bg-destructive/5",
        ev.status === "red" && !isOverdue && "border-destructive/20 hover:border-destructive/40",
        ev.status === "amber" && "border-warning/20 hover:border-warning/40",
        ev.status === "green" && "border-border hover:border-success/30"
      )}
    >
      <CardContent className="py-4 px-5">
        <div className="flex items-start gap-4">
          {/* Dot + icon column */}
          <div className="flex flex-col items-center gap-2 pt-0.5">
            <StatusDot status={ev.status} />
          </div>

          {/* Main content */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <TypeBadge type={ev.type} />
              <StatusBadgeLocal status={ev.status} />
            </div>

            <p className="font-semibold text-foreground text-sm">{ev.title}</p>
            <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-0.5">
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{ev.property}</span>
                {" · "}
                {ev.tenant}
              </p>
              {ev.type === "rent_adjustment" && ev.currentRent !== undefined && ev.currency && (
                <p className="text-xs text-muted-foreground">
                  Alquiler actual:{" "}
                  <span className="font-medium text-foreground">
                    {formatCurrency(ev.currentRent, ev.currency)}{" "}
                    <span className="text-muted-foreground">{ev.currency}</span>
                  </span>
                </p>
              )}
            </div>

            {/* Days label */}
            <div className="flex items-center gap-1.5 mt-2">
              <Clock className="w-3 h-3 text-muted-foreground" />
              <span
                className={cn(
                  "text-xs font-medium",
                  isOverdue ? "text-destructive" : ev.status === "red" ? "text-destructive" : ev.status === "amber" ? "text-warning" : "text-success"
                )}
              >
                {daysLabel(ev.daysTo)}
              </span>
              <span className="text-xs text-muted-foreground">
                · {format(parseISO(ev.date), "dd MMM yyyy", { locale: es })}
              </span>
            </div>
          </div>

          {/* CTA */}
          <Button
            size="sm"
            variant={ev.status === "overdue" || ev.status === "red" ? "default" : "outline"}
            onClick={onNavigate}
            className="shrink-0 gap-1 self-center"
          >
            {ev.type === "rent_adjustment" ? "Registrar ajuste" : "Ver contrato"}
            <ArrowRight className="w-3 h-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
