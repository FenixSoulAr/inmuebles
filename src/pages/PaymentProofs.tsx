import { useEffect, useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import {
  FileCheck, Eye, CheckCircle, XCircle, Building2, Loader2, RefreshCw,
  DollarSign, Upload, X, FileText, Plus, List, Trash2, Calendar,
  ChevronDown, Ban,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/ui/page-header";
import { SearchBar } from "@/components/ui/search-bar";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarUI } from "@/components/ui/calendar";
import { useToast } from "@/hooks/use-toast";
import { format, startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear } from "date-fns";
import { es } from "date-fns/locale";

interface Payment {
  id: string;
  obligation_id: string;
  amount: number;
  paid_at: string;
  method: string;
  notes: string | null;
  attachment_url: string | null;
  created_at: string;
}

interface Obligation {
  id: string;
  contract_id: string;
  period: string;
  kind: string;
  service_type: string | null;
  due_date: string;
  expected_amount: number | null;
  status: string;
  payment_proof_id: string | null;
  currency: string | null;
  properties: { internal_identifier: string };
  tenants: { full_name: string };
  payment_proofs: {
    id: string;
    amount: number;
    paid_at: string;
    files: string[];
    status: string;
    rejection_reason: string | null;
    comment: string | null;
    proof_status: string | null;
    approved_at: string | null;
    approved_by: string | null;
  } | null;
  total_paid: number;
  balance_due: number;
  payments: Payment[];
  display_status: string;
}

// ─── Period filter types ──────────────────────────────────────────────────────
type PeriodPreset = "current_month" | "previous_month" | "last_3_months" | "current_year" | "custom" | "none";

interface PeriodFilter {
  preset: PeriodPreset;
  dateFrom?: Date;
  dateTo?: Date;
}

function getPeriodBounds(pf: PeriodFilter): { from: string; to: string } | null {
  const now = new Date();
  if (pf.preset === "none") return null;
  if (pf.preset === "current_month") {
    return {
      from: format(startOfMonth(now), "yyyy-MM-dd"),
      to: format(endOfMonth(now), "yyyy-MM-dd"),
    };
  }
  if (pf.preset === "previous_month") {
    const prev = subMonths(now, 1);
    return { from: format(startOfMonth(prev), "yyyy-MM-dd"), to: format(endOfMonth(prev), "yyyy-MM-dd") };
  }
  if (pf.preset === "last_3_months") {
    const start = subMonths(now, 3);
    return { from: format(startOfMonth(start), "yyyy-MM-dd"), to: format(endOfMonth(now), "yyyy-MM-dd") };
  }
  if (pf.preset === "current_year") {
    return { from: format(startOfYear(now), "yyyy-MM-dd"), to: format(endOfYear(now), "yyyy-MM-dd") };
  }
  if (pf.preset === "custom" && pf.dateFrom && pf.dateTo) {
    return { from: format(pf.dateFrom, "yyyy-MM-dd"), to: format(pf.dateTo, "yyyy-MM-dd") };
  }
  return null;
}

const PERIOD_PRESET_LABELS: Record<PeriodPreset, string> = {
  current_month: "Mes actual",
  previous_month: "Mes anterior",
  last_3_months: "Últimos 3 meses",
  current_year: "Año actual",
  custom: "Personalizado",
  none: "Sin filtro",
};

const SERVICE_TYPE_LABELS: Record<string, { es: string; en: string }> = {
  expensas: { es: "Expensas", en: "Building Fees" },
  abl: { es: "ABL", en: "ABL" },
  luz: { es: "Luz", en: "Electricity" },
  agua: { es: "Agua", en: "Water" },
  gas: { es: "Gas", en: "Gas" },
  internet: { es: "Internet", en: "Internet" },
  seguro: { es: "Seguro", en: "Insurance" },
  otro: { es: "Otro", en: "Other" },
};

type KindTab = "rent" | "services";
type StatusTab = "action" | "confirmed" | "all";

function deriveRentStatus(totalPaid: number, balanceDue: number, dueDate: string): string {
  if (balanceDue <= 0) return "confirmed";
  if (totalPaid > 0 && balanceDue > 0) return "partial";
  const today = new Date().toISOString().split("T")[0];
  if (today > dueDate) return "pending_send";
  return "upcoming";
}

function deriveServiceStatus(proof: Obligation["payment_proofs"], dueDate: string): string {
  if (proof) {
    if (proof.status === "pending") return "awaiting_review";
    if (proof.status === "approved") return "confirmed";
    if (proof.status === "rejected") return "rejected";
  }
  const today = new Date().toISOString().split("T")[0];
  if (today > dueDate) return "pending_send";
  return "upcoming";
}

// ─── Period Filter Dropdown ────────────────────────────────────────────────────
function PeriodFilterDropdown({
  value,
  onChange,
}: {
  value: PeriodFilter;
  onChange: (v: PeriodFilter) => void;
}) {
  const [open, setOpen] = useState(false);
  const [customFrom, setCustomFrom] = useState<Date | undefined>(value.dateFrom);
  const [customTo, setCustomTo] = useState<Date | undefined>(value.dateTo);
  const [customStep, setCustomStep] = useState<"from" | "to">("from");

  const label =
    value.preset === "custom" && value.dateFrom && value.dateTo
      ? `${format(value.dateFrom, "dd/MM/yyyy")} – ${format(value.dateTo, "dd/MM/yyyy")}`
      : PERIOD_PRESET_LABELS[value.preset];

  const presets: PeriodPreset[] = [
    "current_month", "previous_month", "last_3_months", "current_year", "none",
  ];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="flex items-center gap-2 h-9 text-sm font-normal min-w-[170px] justify-between"
        >
          <span className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
            {label}
          </span>
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="p-2 space-y-0.5">
          {presets.map((p) => (
            <button
              key={p}
              onClick={() => {
                onChange({ preset: p });
                setOpen(false);
              }}
              className={`w-full text-left text-sm px-3 py-2 rounded-md transition-colors ${
                value.preset === p && value.preset !== "custom"
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted"
              }`}
            >
              {PERIOD_PRESET_LABELS[p]}
            </button>
          ))}
          <button
            onClick={() => {
              setCustomStep("from");
              setCustomFrom(undefined);
              setCustomTo(undefined);
              onChange({ preset: "custom" });
            }}
            className={`w-full text-left text-sm px-3 py-2 rounded-md transition-colors ${
              value.preset === "custom"
                ? "bg-primary text-primary-foreground"
                : "hover:bg-muted"
            }`}
          >
            {PERIOD_PRESET_LABELS["custom"]}
          </button>
        </div>
        {value.preset === "custom" && (
          <div className="border-t p-3 space-y-2">
            <p className="text-xs text-muted-foreground font-medium">
              {customStep === "from" ? "Seleccioná la fecha de inicio" : "Seleccioná la fecha de fin"}
            </p>
            <CalendarUI
              mode="single"
              selected={customStep === "from" ? customFrom : customTo}
              onSelect={(d) => {
                if (!d) return;
                if (customStep === "from") {
                  setCustomFrom(d);
                  setCustomStep("to");
                } else {
                  setCustomTo(d);
                  onChange({ preset: "custom", dateFrom: customFrom, dateTo: d });
                  setOpen(false);
                }
              }}
              locale={es}
              className="pointer-events-auto"
            />
            {customFrom && (
              <p className="text-xs text-muted-foreground">
                Desde: {format(customFrom, "dd/MM/yyyy")}
              </p>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

// ─── Contextual Empty State ────────────────────────────────────────────────────
function EmptyStateContextual({
  kindTab, statusTab, dueScope, periodFilter, missingProofFilter,
  onRegisterPayment, onClearFilters, onSwitchToOverdue,
}: {
  kindTab: KindTab;
  statusTab: StatusTab;
  dueScope: string;
  periodFilter: PeriodFilter;
  missingProofFilter: boolean;
  onRegisterPayment: () => void;
  onClearFilters: () => void;
  onSwitchToOverdue: () => void;
}) {
  if (kindTab === "rent" && statusTab === "confirmed" && periodFilter.preset !== "none") {
    return (
      <EmptyState icon={DollarSign} title="Sin ingresos registrados"
        description="Los pagos confirmados en el período seleccionado aparecerán aquí."
        action={{ label: "Registrar pago", onClick: onRegisterPayment, variant: "outline" }}
        compact className="py-14" />
    );
  }
  if (kindTab === "rent" && statusTab === "confirmed" && missingProofFilter) {
    return (
      <EmptyState icon={FileCheck} title="Documentación completa"
        description="Todos los pagos confirmados tienen comprobante adjunto o fueron aprobados sin comprobante."
        compact className="py-14" />
    );
  }
  if (kindTab === "rent" && statusTab === "action" && dueScope === "current_month") {
    return (
      <EmptyState icon={DollarSign} title="Todo al día este mes"
        description="No hay alquileres con vencimiento pendiente en el mes actual."
        secondaryAction={{ label: "Ver mora acumulada", onClick: onSwitchToOverdue }}
        compact className="py-14" />
    );
  }
  if (kindTab === "rent" && statusTab === "action" && dueScope === "overdue") {
    return (
      <EmptyState icon={DollarSign} title="Sin deuda histórica"
        description="No hay alquileres vencidos de meses anteriores."
        compact className="py-14" />
    );
  }
  if (kindTab === "rent" && statusTab === "action") {
    return (
      <EmptyState icon={DollarSign} title="Sin obligaciones pendientes"
        description="No hay alquileres que requieran acción en este momento."
        compact className="py-14" />
    );
  }
  if (kindTab === "services" && statusTab === "action") {
    return (
      <EmptyState icon={FileCheck} title="Sin comprobantes por gestionar"
        description="Todos los servicios del período están al día o confirmados."
        compact className="py-14" />
    );
  }
  if (kindTab === "services" && statusTab === "confirmed") {
    return (
      <EmptyState icon={FileCheck} title="Sin servicios confirmados"
        description="Los comprobantes de servicios aprobados aparecerán aquí."
        compact className="py-14" />
    );
  }
  return (
    <EmptyState
      icon={kindTab === "rent" ? DollarSign : FileCheck}
      title="Sin registros"
      description="No hay obligaciones que coincidan con los filtros aplicados."
      action={dueScope || periodFilter.preset !== "none" || missingProofFilter
        ? { label: "Limpiar filtros", onClick: onClearFilters, variant: "ghost" }
        : undefined}
      compact className="py-14"
    />
  );
}

export default function PaymentProofs() {
  const { t, i18n } = useTranslation();
  const isEs = i18n.language?.startsWith("es");
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  // Read initial state from URL query params (from dashboard navigation)
  const initialKindTab = (searchParams.get("kindTab") as KindTab) || "rent";
  const initialStatusTab = (searchParams.get("statusTab") as StatusTab) || "action";
  const initialDueScope = searchParams.get("dueScope") || "";
  const initialPeriod = searchParams.get("period") || "";
  const initialMissingProof = searchParams.get("missingProof") === "true";
  const initialViewMode = searchParams.get("viewMode") || "monthly"; // "monthly" | "cumulative"
  const initialMonth = searchParams.get("month") || format(new Date(), "yyyy-MM");

  // Derive initial period filter from URL params
  const deriveInitialPeriodFilter = (): PeriodFilter => {
    if (initialViewMode === "cumulative") return { preset: "none" }; // no date filter for cumulative
    if (initialDueScope === "current_month" || initialPeriod === format(new Date(), "yyyy-MM")) {
      return { preset: "current_month" };
    }
    if (initialDueScope === "overdue") return { preset: "none" }; // overdue is handled by dueScope
    if (initialPeriod) {
      const [y, m] = initialPeriod.split("-").map(Number);
      const d = new Date(y, m - 1, 1);
      return { preset: "custom", dateFrom: startOfMonth(d), dateTo: endOfMonth(d) };
    }
    if (initialMonth && initialMonth !== format(new Date(), "yyyy-MM")) {
      const [y, m] = initialMonth.split("-").map(Number);
      const d = new Date(y, m - 1, 1);
      return { preset: "custom", dateFrom: startOfMonth(d), dateTo: endOfMonth(d) };
    }
    return { preset: "current_month" }; // sensible default
  };

  const [obligations, setObligations] = useState<Obligation[]>([]);
  const [loading, setLoading] = useState(true);
  const [ensuring, setEnsuring] = useState(false);
  const [search, setSearch] = useState("");
  const [kindTab, setKindTab] = useState<KindTab>(initialKindTab);
  const [statusTab, setStatusTab] = useState<StatusTab>(initialStatusTab);
  const [dueScope, setDueScope] = useState(initialDueScope);
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>(deriveInitialPeriodFilter);
  const [missingProofFilter, setMissingProofFilter] = useState(initialMissingProof);

  // Confirm modal
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmObl, setConfirmObl] = useState<Obligation | null>(null);
  const [confirmDate, setConfirmDate] = useState("");
  const [confirmAmount, setConfirmAmount] = useState("");
  const [confirmMethod, setConfirmMethod] = useState("transfer");
  const [confirmNotes, setConfirmNotes] = useState("");
  const [confirmFile, setConfirmFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const confirmFileRef = useRef<HTMLInputElement>(null);

  // Approve without proof modal
  const [approveNoProofOpen, setApproveNoProofOpen] = useState(false);
  const [approveNoProofObl, setApproveNoProofObl] = useState<Obligation | null>(null);

  // Register payment modal
  const [payOpen, setPayOpen] = useState(false);
  const [payObl, setPayObl] = useState<Obligation | null>(null);
  const [payDate, setPayDate] = useState("");
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("transfer");
  const [payNotes, setPayNotes] = useState("");
  const [payFile, setPayFile] = useState<File | null>(null);
  const payFileRef = useRef<HTMLInputElement>(null);

  // View payments modal
  const [viewPayOpen, setViewPayOpen] = useState(false);
  const [viewPayObl, setViewPayObl] = useState<Obligation | null>(null);

  // Delete payment confirmation
  const [deletePayId, setDeletePayId] = useState<string | null>(null);
  const [deletePayOblId, setDeletePayOblId] = useState<string | null>(null);

  // Reject modal
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectObl, setRejectObl] = useState<Obligation | null>(null);

  // Files dialog
  const [filesOpen, setFilesOpen] = useState(false);
  const [viewFiles, setViewFiles] = useState<string[]>([]);
  const [signedUrls, setSignedUrls] = useState<string[]>([]);

  useEffect(() => {
    if (user) ensureAndFetch();
  }, [user]);

  const ensureAndFetch = async () => {
    setEnsuring(true);
    try {
      await supabase.functions.invoke("ensure-obligations");
      await supabase.functions.invoke("reconcile-proofs");
    } catch (err) {
      console.error("Error ensuring/reconciling:", err);
    } finally {
      setEnsuring(false);
    }
    await fetchObligations();
  };

  const fetchObligations = async () => {
    try {
      const { data, error } = await supabase
        .from("obligations")
        .select(`
          *,
          properties(internal_identifier),
          tenants(full_name),
          payment_proofs!obligations_payment_proof_id_fkey(id, amount, paid_at, files, status, rejection_reason, comment, proof_status, approved_at, approved_by)
        `)
        .order("period", { ascending: true });

      if (error) throw error;

      const rawObls = (data as unknown as any[]) || [];

      const oblIds = rawObls.map((o) => o.id);
      const { data: allPayments } = await supabase
        .from("payments")
        .select("*")
        .in("obligation_id", oblIds.length > 0 ? oblIds : ["__none__"]);

      const paymentsByObl = new Map<string, Payment[]>();
      for (const p of (allPayments || []) as Payment[]) {
        const list = paymentsByObl.get(p.obligation_id) || [];
        list.push(p);
        paymentsByObl.set(p.obligation_id, list);
      }

      const obls: Obligation[] = rawObls.map((o) => {
        const payments = paymentsByObl.get(o.id) || [];
        const totalPaid = payments.reduce((s, p) => s + Number(p.amount), 0);
        const expected = o.expected_amount ?? 0;
        const balanceDue = Math.max(expected - totalPaid, 0);

        let displayStatus: string;
        if (o.kind === "rent") {
          displayStatus = deriveRentStatus(totalPaid, balanceDue, o.due_date);
        } else {
          displayStatus = deriveServiceStatus(o.payment_proofs, o.due_date);
        }

        return { ...o, total_paid: totalPaid, balance_due: balanceDue, payments, display_status: displayStatus };
      });

      obls.sort((a, b) => {
        const periodCmp = a.period.localeCompare(b.period);
        if (periodCmp !== 0) return periodCmp;
        return (a.properties?.internal_identifier || "").localeCompare(b.properties?.internal_identifier || "");
      });
      setObligations(obls);
    } catch (err) {
      console.error("Error fetching obligations:", err);
    } finally {
      setLoading(false);
    }
  };

  // ─── Filtering Logic ────────────────────────────────────────────────────────
  const now = new Date();
  const currentMonthStr = format(now, "yyyy-MM");
  const monthStartStr = format(startOfMonth(now), "yyyy-MM-dd");
  const monthEndStr = format(endOfMonth(now), "yyyy-MM-dd");

  const periodBounds = getPeriodBounds(periodFilter);

  // Criterion text shown under the total
  const criterionText = (() => {
    if (statusTab === "confirmed") return "Criterio: fecha de pago";
    if (statusTab === "action") return "Criterio: fecha de vencimiento";
    return null;
  })();

  // Helper: is an obligation within the period filter?
  const isInPeriodFilter = (obl: Obligation): boolean => {
    if (!periodBounds) return true; // "none" → no filter
    // For confirmed: use last payment's paid_at date
    if (statusTab === "confirmed") {
      const sortedPays = [...obl.payments].sort(
        (a, b) => new Date(b.paid_at).getTime() - new Date(a.paid_at).getTime()
      );
      const lastPaidAt = sortedPays[0]?.paid_at || obl.due_date;
      return lastPaidAt >= periodBounds.from && lastPaidAt <= periodBounds.to;
    }
    // For action/all: use due_date
    return obl.due_date >= periodBounds.from && obl.due_date <= periodBounds.to;
  };

  // Check if an obligation's proof is "missing" (not approved without proof)
  const isMissingProof = (obl: Obligation): boolean => {
    const proofStatus = obl.payment_proofs?.proof_status;
    if (proofStatus === "approved_without_proof") return false;
    const hasAttachment = (obl.payments || []).some((p: any) => p.attachment_url);
    const hasProofFile = obl.payment_proofs?.files?.length > 0;
    return !hasAttachment && !hasProofFile;
  };

  const getFiltered = () => {
    let filtered = obligations.filter((o) => o.kind === (kindTab === "rent" ? "rent" : "service"));

    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        (o) =>
          o.properties?.internal_identifier?.toLowerCase().includes(q) ||
          o.tenants?.full_name?.toLowerCase().includes(q)
      );
    }

    if (statusTab === "action") {
      filtered = filtered.filter(
        (o) =>
          ["pending_send", "awaiting_review", "rejected", "partial"].includes(o.display_status) &&
          o.period <= currentMonthStr
      );
      if (dueScope === "current_month") {
        filtered = filtered.filter((o) => o.due_date >= monthStartStr && o.due_date <= monthEndStr);
      } else if (dueScope === "overdue") {
        filtered = filtered.filter((o) => o.due_date < monthStartStr);
      }
      // Apply period filter on due_date for action tab
      if (periodBounds && !dueScope) {
        filtered = filtered.filter(isInPeriodFilter);
      }
      return filtered;
    }

    if (statusTab === "confirmed") {
      filtered = filtered.filter((o) => o.display_status === "confirmed");
      // Apply period filter (date of payment)
      if (periodBounds) {
        filtered = filtered.filter(isInPeriodFilter);
      }
      // Apply missing proof filter
      if (missingProofFilter) {
        filtered = filtered.filter(isMissingProof);
      }
      return filtered;
    }

    // "all" — exclude upcoming, last 6 months
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1);
    const sixMonthsStr = format(sixMonthsAgo, "yyyy-MM");
    let result = filtered.filter((o) => o.display_status !== "upcoming" && o.period >= sixMonthsStr);
    if (periodBounds) {
      result = result.filter(isInPeriodFilter);
    }
    return result;
  };

  const filtered = getFiltered();

  // ─── Summary total ──────────────────────────────────────────────────────────
  const summaryTotal = (() => {
    if (statusTab === "confirmed") return filtered.reduce((s, o) => s + o.total_paid, 0);
    if (statusTab === "action") return filtered.reduce((s, o) => s + o.balance_due, 0);
    return null;
  })();

  // ─── Active filter chips ────────────────────────────────────────────────────
  interface FilterChip { label: string; onRemove: () => void; }
  const activeChips: FilterChip[] = [];
  if (dueScope === "current_month") {
    activeChips.push({ label: "Mes actual", onRemove: () => setDueScope("") });
  }
  if (dueScope === "overdue") {
    activeChips.push({ label: "Vencidos (meses anteriores)", onRemove: () => setDueScope("") });
  }
  if (missingProofFilter) {
    activeChips.push({ label: "Sin comprobante adjunto", onRemove: () => setMissingProofFilter(false) });
  }

  const clearAllFilters = () => {
    setDueScope("");
    setPeriodFilter({ preset: "current_month" });
    setMissingProofFilter(false);
  };

  // ─── Helpers ────────────────────────────────────────────────────────────────
  const formatMonth = (period: string) => {
    const [year, month] = period.split("-");
    return new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString(
      isEs ? "es-AR" : "en-US", { month: "long", year: "numeric" }
    );
  };

  const formatCurrency = (amount: number, currency?: string | null) =>
    new Intl.NumberFormat(isEs ? "es-AR" : "en-US", {
      style: "currency", currency: currency || "USD",
    }).format(amount);

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString(isEs ? "es-AR" : "en-US", { month: "short", day: "numeric", year: "numeric" });

  const getServiceLabel = (svcType: string | null) => {
    if (!svcType) return t("obligations.service");
    const label = SERVICE_TYPE_LABELS[svcType];
    return label ? (isEs ? label.es : label.en) : svcType;
  };

  // ─── Upload helper ──────────────────────────────────────────────────────────
  const uploadFile = async (file: File, oblId: string): Promise<string | null> => {
    if (!user) return null;
    const ext = file.name.split(".").pop();
    const path = `${user.id}/${oblId}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("documents").upload(path, file);
    if (error) throw error;
    return path;
  };

  const getProxyUrl = (filePathOrUrl: string, download = false): string => {
    const base = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/serve-file`;
    const params = new URLSearchParams();
    if (filePathOrUrl.startsWith("http") && filePathOrUrl.includes("/storage/v1/")) {
      params.set("url", filePathOrUrl);
    } else if (filePathOrUrl.startsWith("http")) {
      return filePathOrUrl;
    } else {
      params.set("bucket", "proof-files");
      params.set("path", filePathOrUrl);
    }
    if (download) params.set("download", "1");
    return `${base}?${params.toString()}`;
  };

  const openFiles = (files: string[]) => {
    setViewFiles(files);
    setFilesOpen(true);
    setSignedUrls(files.map((f) => getProxyUrl(f)));
  };

  // ─── Sync obligation status ─────────────────────────────────────────────────
  const syncOblStatus = async (oblId: string) => {
    const obl = obligations.find((o) => o.id === oblId);
    if (!obl) return;
    const { data: payments } = await supabase.from("payments").select("amount").eq("obligation_id", oblId);
    const totalPaid = (payments || []).reduce((s, p) => s + Number(p.amount), 0);
    const expected = obl.expected_amount ?? 0;
    const balanceDue = Math.max(expected - totalPaid, 0);
    let newStatus: string;
    if (obl.kind === "rent") {
      newStatus = deriveRentStatus(totalPaid, balanceDue, obl.due_date);
    } else {
      newStatus = deriveServiceStatus(obl.payment_proofs, obl.due_date);
    }
    await supabase.from("obligations").update({ status: newStatus }).eq("id", oblId);
  };

  // ─── Confirm modal ──────────────────────────────────────────────────────────
  const openConfirm = (obl: Obligation) => {
    setConfirmObl(obl);
    setConfirmDate(new Date().toISOString().split("T")[0]);
    setConfirmAmount(String(obl.payment_proofs?.amount ?? obl.expected_amount ?? 0));
    setConfirmMethod("transfer");
    setConfirmNotes("");
    setConfirmFile(null);
    setConfirmOpen(true);
  };

  const handleConfirmFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: t("common.error"), description: t("rent.fileTooLarge"), variant: "destructive" });
      return;
    }
    setConfirmFile(file);
  };

  const handleConfirm = async () => {
    if (!confirmObl) return;
    const amount = parseFloat(confirmAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({ title: t("common.error"), description: t("rent.validAmount"), variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    try {
      let attachmentUrl: string | null = null;
      if (confirmFile) {
        attachmentUrl = await uploadFile(confirmFile, confirmObl.id);
      }
      if (confirmObl.payment_proof_id) {
        await supabase.from("payment_proofs")
          .update({ status: "approved", proof_status: attachmentUrl ? "uploaded" : "required" })
          .eq("id", confirmObl.payment_proof_id);
      }
      await supabase.from("payments").insert({
        obligation_id: confirmObl.id, amount, paid_at: confirmDate,
        method: confirmMethod, notes: confirmNotes || null, attachment_url: attachmentUrl,
      });
      if (confirmObl.kind === "service" && !confirmObl.expected_amount && confirmObl.payment_proofs?.amount) {
        await supabase.from("obligations")
          .update({ expected_amount: confirmObl.payment_proofs.amount }).eq("id", confirmObl.id);
      }
      await syncOblStatus(confirmObl.id);
      toast({ title: t("obligations.proofApproved") });
      setConfirmOpen(false);
      fetchObligations();
    } catch (err) {
      console.error("Confirm error:", err);
      toast({ title: t("common.error"), variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Approve without proof ──────────────────────────────────────────────────
  const openApproveNoProof = (obl: Obligation) => {
    setApproveNoProofObl(obl);
    setApproveNoProofOpen(true);
  };

  const handleApproveNoProof = async () => {
    if (!approveNoProofObl) return;
    setIsSubmitting(true);
    try {
      // Upsert a payment_proof with proof_status=approved_without_proof
      if (approveNoProofObl.payment_proof_id) {
        await supabase.from("payment_proofs")
          .update({
            proof_status: "approved_without_proof",
            approved_at: new Date().toISOString(),
            approved_by: user?.id || null,
          })
          .eq("id", approveNoProofObl.payment_proof_id);
      } else {
        // Create a minimal payment_proof record to store the audit
        await supabase.from("payment_proofs").insert({
          contract_id: approveNoProofObl.contract_id,
          obligation_id: approveNoProofObl.id,
          amount: approveNoProofObl.total_paid || approveNoProofObl.expected_amount || 0,
          paid_at: new Date().toISOString().split("T")[0],
          period: approveNoProofObl.period,
          type: "rent",
          files: [],
          status: "approved",
          proof_status: "approved_without_proof",
          approved_at: new Date().toISOString(),
          approved_by: user?.id || null,
        });
      }
      toast({ title: isEs ? "Aprobado sin comprobante" : "Approved without proof",
        description: isEs ? "El pago quedó registrado como excepción administrativa." : "Recorded as administrative exception." });
      setApproveNoProofOpen(false);
      fetchObligations();
    } catch (err) {
      console.error("Approve no proof error:", err);
      toast({ title: t("common.error"), variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Register payment modal ─────────────────────────────────────────────────
  const openRegisterPayment = (obl?: Obligation) => {
    if (obl) {
      setPayObl(obl);
      setPayDate(new Date().toISOString().split("T")[0]);
      setPayAmount(String(obl.balance_due > 0 ? obl.balance_due : obl.expected_amount ?? 0));
      setPayMethod("transfer");
      setPayNotes("");
      setPayFile(null);
    }
    setPayOpen(true);
  };

  const handlePayFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: t("common.error"), description: t("rent.fileTooLarge"), variant: "destructive" });
      return;
    }
    setPayFile(file);
  };

  const handleRegisterPayment = async () => {
    if (!payObl) return;
    const amount = parseFloat(payAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({ title: t("common.error"), description: t("rent.validAmount"), variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    try {
      let attachmentUrl: string | null = null;
      if (payFile) attachmentUrl = await uploadFile(payFile, payObl.id);
      await supabase.from("payments").insert({
        obligation_id: payObl.id, amount, paid_at: payDate,
        method: payMethod, notes: payNotes || null, attachment_url: attachmentUrl,
      });
      await syncOblStatus(payObl.id);
      toast({ title: isEs ? "Pago registrado" : "Payment recorded" });
      setPayOpen(false);
      fetchObligations();
    } catch (err) {
      console.error("Register payment error:", err);
      toast({ title: t("common.error"), variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── View payments ──────────────────────────────────────────────────────────
  const openViewPayments = (obl: Obligation) => { setViewPayObl(obl); setViewPayOpen(true); };

  // ─── Delete payment ─────────────────────────────────────────────────────────
  const handleDeletePayment = async () => {
    if (!deletePayId || !deletePayOblId) return;
    setIsSubmitting(true);
    try {
      await supabase.from("payments").delete().eq("id", deletePayId);
      await syncOblStatus(deletePayOblId);
      toast({ title: isEs ? "Pago eliminado" : "Payment deleted" });
      setDeletePayId(null);
      setDeletePayOblId(null);
      fetchObligations();
      if (viewPayObl && viewPayObl.id === deletePayOblId) {
        const { data: updated } = await supabase.from("payments").select("*").eq("obligation_id", deletePayOblId);
        setViewPayObl({ ...viewPayObl, payments: (updated || []) as Payment[] });
      }
    } catch {
      toast({ title: t("common.error"), variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Reject modal ───────────────────────────────────────────────────────────
  const openReject = (obl: Obligation) => { setRejectObl(obl); setRejectReason(""); setRejectOpen(true); };

  const handleReject = async () => {
    if (!rejectObl) return;
    if (!rejectReason.trim()) {
      toast({ title: t("common.error"), description: t("obligations.reasonRequired"), variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    try {
      await supabase.from("obligations").update({ status: "rejected" }).eq("id", rejectObl.id);
      if (rejectObl.payment_proof_id) {
        await supabase.from("payment_proofs")
          .update({ status: "rejected", rejection_reason: rejectReason })
          .eq("id", rejectObl.payment_proof_id);
      }
      toast({ title: t("obligations.proofRejected") });
      setRejectOpen(false);
      fetchObligations();
    } catch {
      toast({ title: t("common.error"), variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Render ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const renderRentRow = (obl: Obligation) => {
    const isCash = (obl.payments || []).some((p) => p.method === "cash");
    const isConfirmedMissingProof = obl.display_status === "confirmed" && isMissingProof(obl);
    const isApprovedNoProof = obl.payment_proofs?.proof_status === "approved_without_proof";

    return (
      <TableRow key={obl.id}>
        <TableCell>
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-primary shrink-0" />
            <span className="font-medium">{obl.properties?.internal_identifier}</span>
          </div>
        </TableCell>
        <TableCell className="text-muted-foreground">{obl.tenants?.full_name}</TableCell>
        <TableCell className="capitalize">{formatMonth(obl.period)}</TableCell>
        <TableCell>{formatDate(obl.due_date)}</TableCell>
        <TableCell className="text-right font-semibold">
          {obl.expected_amount ? formatCurrency(obl.expected_amount, obl.currency) : "—"}
        </TableCell>
        <TableCell className="text-right">
          <span className={obl.total_paid > 0 ? "font-semibold text-success" : "text-muted-foreground"}>
            {formatCurrency(obl.total_paid, obl.currency)}
          </span>
        </TableCell>
        <TableCell className="text-right">
          <span className={obl.balance_due > 0 ? "font-semibold text-warning" : "text-muted-foreground"}>
            {formatCurrency(obl.balance_due, obl.currency)}
          </span>
        </TableCell>
        <TableCell>
          <StatusBadge variant={obl.display_status as any} />
          {isApprovedNoProof && (
            <span className="block text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <Ban className="w-3 h-3" /> Sin comprobante (aprobado)
            </span>
          )}
          {obl.payment_proofs?.rejection_reason && (
            <p className="text-xs text-destructive mt-1">{obl.payment_proofs.rejection_reason}</p>
          )}
        </TableCell>
        <TableCell className="text-right">
          <div className="flex items-center justify-end gap-1 flex-wrap">
            {obl.payment_proofs?.files && obl.payment_proofs.files.length > 0 && (
              <Button size="sm" variant="ghost" onClick={() => openFiles(obl.payment_proofs!.files)}
                title={isEs ? "Ver adjuntos" : "View attachments"}>
                <Eye className="w-4 h-4" />
              </Button>
            )}
            {obl.payments.length > 0 && (
              <Button size="sm" variant="ghost" onClick={() => openViewPayments(obl)}
                title={isEs ? "Ver pagos" : "View payments"}>
                <List className="w-4 h-4 mr-1" />
                {obl.payments.length}
              </Button>
            )}
            {obl.balance_due > 0 && (
              <Button size="sm" variant="outline" onClick={() => openRegisterPayment(obl)}>
                <Plus className="w-4 h-4 mr-1" />
                {isEs ? "Registrar pago" : "Record payment"}
              </Button>
            )}
            {obl.display_status === "awaiting_review" && (
              <Button size="sm" variant="outline" className="text-success" onClick={() => openConfirm(obl)}>
                <CheckCircle className="w-4 h-4 mr-1" />
                {t("obligations.confirm")}
              </Button>
            )}
            {obl.display_status === "awaiting_review" && (
              <Button size="sm" variant="outline" className="text-destructive" onClick={() => openReject(obl)}>
                <XCircle className="w-4 h-4 mr-1" />
                {t("obligations.reject")}
              </Button>
            )}
            {/* Approve without proof — only for confirmed with missing proof */}
            {isConfirmedMissingProof && !isApprovedNoProof && (
              <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => openApproveNoProof(obl)}
                title={isEs ? "Aprobar sin comprobante" : "Approve without proof"}>
                <Ban className="w-4 h-4 mr-1" />
                {isEs ? "Aprobar sin adj." : "No proof"}
              </Button>
            )}
          </div>
        </TableCell>
      </TableRow>
    );
  };

  const renderServiceRow = (obl: Obligation) => {
    const displayAmount = obl.expected_amount ?? obl.payment_proofs?.amount ?? null;
    return (
      <TableRow key={obl.id}>
        <TableCell>
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-primary shrink-0" />
            <span className="font-medium">{obl.properties?.internal_identifier}</span>
          </div>
        </TableCell>
        <TableCell className="text-muted-foreground">{obl.tenants?.full_name}</TableCell>
        <TableCell className="capitalize">{getServiceLabel(obl.service_type)}</TableCell>
        <TableCell className="capitalize">{formatMonth(obl.period)}</TableCell>
        <TableCell>{formatDate(obl.due_date)}</TableCell>
        <TableCell className="text-right font-semibold">
          {displayAmount ? formatCurrency(displayAmount, obl.currency) : "—"}
        </TableCell>
        <TableCell>
          <StatusBadge variant={obl.display_status as any} />
          {obl.payment_proofs?.rejection_reason && (
            <p className="text-xs text-destructive mt-1">{obl.payment_proofs.rejection_reason}</p>
          )}
        </TableCell>
        <TableCell className="text-right">
          <div className="flex items-center justify-end gap-1">
            {obl.payment_proofs?.files && obl.payment_proofs.files.length > 0 && (
              <Button size="sm" variant="ghost" onClick={() => openFiles(obl.payment_proofs!.files)}>
                <Eye className="w-4 h-4" />
              </Button>
            )}
            {["pending_send", "awaiting_review", "rejected"].includes(obl.display_status) && (
              <Button size="sm" variant="outline" className="text-success" onClick={() => openConfirm(obl)}>
                <CheckCircle className="w-4 h-4 mr-1" />
                {t("obligations.confirm")}
              </Button>
            )}
            {obl.display_status === "awaiting_review" && (
              <Button size="sm" variant="outline" className="text-destructive" onClick={() => openReject(obl)}>
                <XCircle className="w-4 h-4 mr-1" />
                {t("obligations.reject")}
              </Button>
            )}
          </div>
        </TableCell>
      </TableRow>
    );
  };

  return (
    <div>
      <PageHeader title={t("obligations.title")} description={t("obligations.description")}>
        <Button variant="outline" size="sm" onClick={ensureAndFetch} disabled={ensuring}>
          {ensuring ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
          {t("common.refresh")}
        </Button>
      </PageHeader>

      {/* Kind tabs: Alquileres / Servicios */}
      <Tabs value={kindTab} onValueChange={(v) => setKindTab(v as KindTab)} className="mb-4">
        <TabsList>
          <TabsTrigger value="rent">
            <DollarSign className="w-4 h-4 mr-1" />
            {t("obligations.rentTab")}
          </TabsTrigger>
          <TabsTrigger value="services">
            <FileCheck className="w-4 h-4 mr-1" />
            {t("obligations.servicesTab")}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Search + status filter */}
      <div className="flex flex-col sm:flex-row gap-3 mb-3">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder={t("obligations.searchPlaceholder")}
          className="flex-1 max-w-md"
        />
        <Tabs value={statusTab} onValueChange={(v) => {
          setStatusTab(v as StatusTab);
          setDueScope("");
          setMissingProofFilter(false);
        }}>
          <TabsList>
            <TabsTrigger value="action">{t("obligations.actionNeeded")}</TabsTrigger>
            <TabsTrigger value="confirmed">{t("obligations.confirmed")}</TabsTrigger>
            <TabsTrigger value="all">{t("obligations.all")}</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Period filter + chips row */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <PeriodFilterDropdown value={periodFilter} onChange={setPeriodFilter} />

        {/* View mode chip — set from Dashboard navigation */}
        {initialViewMode === "cumulative" && (
          <Badge variant="secondary" className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium">
            Vista acumulada
          </Badge>
        )}
        {initialViewMode === "monthly" && initialMonth && (
          <Badge variant="secondary" className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium">
            {(() => {
              const [y, m] = initialMonth.split("-").map(Number);
              const d = new Date(y, m - 1, 1);
              const label = d.toLocaleDateString("es-AR", { month: "long", year: "numeric" });
              return `Vista mensual · ${label.charAt(0).toUpperCase() + label.slice(1)}`;
            })()}
          </Badge>
        )}

        {dueScope === "current_month" && (
          <Badge variant="secondary" className="flex items-center gap-1.5 pl-3 pr-2 py-1 text-xs font-medium">
            Mes actual
            <button onClick={() => setDueScope("")} className="ml-1 rounded-full hover:bg-muted-foreground/20 p-0.5"><X className="w-3 h-3" /></button>
          </Badge>
        )}
        {dueScope === "overdue" && (
          <Badge variant="secondary" className="flex items-center gap-1.5 pl-3 pr-2 py-1 text-xs font-medium">
            Vencidos (meses anteriores)
            <button onClick={() => setDueScope("")} className="ml-1 rounded-full hover:bg-muted-foreground/20 p-0.5"><X className="w-3 h-3" /></button>
          </Badge>
        )}
        {missingProofFilter && (
          <Badge variant="secondary" className="flex items-center gap-1.5 pl-3 pr-2 py-1 text-xs font-medium">
            Sin comprobante adjunto
            <button onClick={() => setMissingProofFilter(false)} className="ml-1 rounded-full hover:bg-muted-foreground/20 p-0.5"><X className="w-3 h-3" /></button>
          </Badge>
        )}
        {(dueScope || missingProofFilter || periodFilter.preset !== "current_month") && (
          <button
            onClick={clearAllFilters}
            className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
          >
            {isEs ? "Limpiar filtros" : "Clear filters"}
          </button>
        )}
      </div>

      {/* Summary bar */}
      {summaryTotal !== null && filtered.length > 0 && (
        <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-4 py-3 mb-4">
          <div>
            <p className="text-sm text-muted-foreground">
              {statusTab === "confirmed" ? "Total cobrado según filtros:" : "Total pendiente según filtros:"}
            </p>
            {criterionText && (
              <p className="text-xs text-muted-foreground/70 mt-0.5">{criterionText}</p>
            )}
          </div>
          <p className="text-base font-bold">
            {new Intl.NumberFormat(isEs ? "es-AR" : "en-US", {
              style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0,
            }).format(summaryTotal)}
          </p>
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyStateContextual
          kindTab={kindTab}
          statusTab={statusTab}
          dueScope={dueScope}
          periodFilter={periodFilter}
          missingProofFilter={missingProofFilter}
          onRegisterPayment={() => openRegisterPayment()}
          onClearFilters={clearAllFilters}
          onSwitchToOverdue={() => { setDueScope("overdue"); setStatusTab("action"); }}
        />
      ) : (
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              {kindTab === "rent" ? (
                <Table className="min-w-[1000px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("common.property")}</TableHead>
                      <TableHead>{t("common.tenant")}</TableHead>
                      <TableHead>{t("common.period")}</TableHead>
                      <TableHead>{t("rent.dueDate")}</TableHead>
                      <TableHead className="text-right">{t("rent.expected")}</TableHead>
                      <TableHead className="text-right">{t("rent.totalPaid")}</TableHead>
                      <TableHead className="text-right">{t("rent.balanceDue")}</TableHead>
                      <TableHead>{t("common.status")}</TableHead>
                      <TableHead className="text-right">{t("common.actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>{filtered.map(renderRentRow)}</TableBody>
                </Table>
              ) : (
                <Table className="min-w-[900px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("common.property")}</TableHead>
                      <TableHead>{t("common.tenant")}</TableHead>
                      <TableHead>{t("obligations.serviceLabel")}</TableHead>
                      <TableHead>{t("common.period")}</TableHead>
                      <TableHead>{t("rent.dueDate")}</TableHead>
                      <TableHead className="text-right">{t("common.amount")}</TableHead>
                      <TableHead>{t("common.status")}</TableHead>
                      <TableHead className="text-right">{t("common.actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>{filtered.map(renderServiceRow)}</TableBody>
                </Table>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Confirm Payment Modal */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b flex-shrink-0">
            <DialogTitle>{t("obligations.confirmPaymentTitle")}</DialogTitle>
            <DialogDescription>
              {confirmObl && (
                <>
                  {confirmObl.properties?.internal_identifier} – {formatMonth(confirmObl.period)}
                  {confirmObl.kind === "service" && confirmObl.service_type && (
                    <> – {getServiceLabel(confirmObl.service_type)}</>
                  )}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-6 py-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{t("rent.paymentDate")} *</Label>
                <Input type="date" value={confirmDate} onChange={(e) => setConfirmDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>{t("rent.amount")} *</Label>
                <Input type="number" step="0.01" min="0" value={confirmAmount} onChange={(e) => setConfirmAmount(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>{t("rent.method")} *</Label>
                <Select value={confirmMethod} onValueChange={setConfirmMethod}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="transfer">{t("rent.transfer")}</SelectItem>
                    <SelectItem value="cash">{t("rent.cash")}</SelectItem>
                    <SelectItem value="other">{isEs ? "Otro" : "Other"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {/* Cash hint */}
              {confirmMethod === "cash" && (
                <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-sm text-muted-foreground">
                  <span>💵</span>
                  <p>Pago en efectivo. Puede aprobar sin comprobante usando el botón correspondiente.</p>
                </div>
              )}
              <div className="space-y-2">
                <Label>{t("rent.notesOptional")}</Label>
                <Textarea value={confirmNotes} onChange={(e) => setConfirmNotes(e.target.value)} placeholder={t("rent.addNotes")} rows={2} />
              </div>
              <div className="space-y-2">
                <Label>{t("obligations.attachOptional")}</Label>
                {confirmFile ? (
                  <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                    <FileText className="w-5 h-5 text-muted-foreground" />
                    <span className="flex-1 text-sm truncate">{confirmFile.name}</span>
                    <Button type="button" variant="ghost" size="sm" onClick={() => { setConfirmFile(null); if (confirmFileRef.current) confirmFileRef.current.value = ""; }}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-primary/50 transition-colors" onClick={() => confirmFileRef.current?.click()}>
                    <Upload className="w-6 h-6 mx-auto mb-1 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">{t("rent.clickUpload")}</p>
                  </div>
                )}
                <input ref={confirmFileRef} type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={handleConfirmFileChange} />
              </div>
            </div>
          </div>
          <DialogFooter className="px-6 py-4 border-t flex-shrink-0">
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={isSubmitting}>{t("common.cancel")}</Button>
            <Button onClick={handleConfirm} disabled={isSubmitting}>
              {isSubmitting ? t("common.saving") : t("obligations.confirmPaymentTitle")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approve Without Proof Modal */}
      <AlertDialog open={approveNoProofOpen} onOpenChange={setApproveNoProofOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{isEs ? "Aprobar sin comprobante" : "Approve without proof"}</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                {approveNoProofObl && (
                  <>
                    <strong>{approveNoProofObl.properties?.internal_identifier}</strong> – {formatMonth(approveNoProofObl.period)}
                  </>
                )}
              </span>
              <span className="block">
                {isEs
                  ? "El pago quedará registrado como excepción administrativa. No se puede adjuntar un comprobante después de aprobar de esta forma."
                  : "This payment will be recorded as an administrative exception. Proof cannot be attached afterwards."}
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleApproveNoProof} disabled={isSubmitting}
              className="bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border">
              {isSubmitting ? t("common.saving") : (isEs ? "Confirmar excepción" : "Confirm exception")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Register Payment Modal */}
      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b flex-shrink-0">
            <DialogTitle>{isEs ? "Registrar pago" : "Record Payment"}</DialogTitle>
            <DialogDescription>
              {payObl && (
                <>
                  {payObl.properties?.internal_identifier} – {formatMonth(payObl.period)}
                  {payObl.balance_due > 0 && (
                    <span className="ml-2 text-warning font-medium">
                      {isEs ? "Saldo:" : "Balance:"} {formatCurrency(payObl.balance_due, payObl.currency)}
                    </span>
                  )}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-6 py-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{t("rent.paymentDate")} *</Label>
                <Input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>{t("rent.amount")} *</Label>
                <Input type="number" step="0.01" min="0" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>{t("rent.method")} *</Label>
                <Select value={payMethod} onValueChange={setPayMethod}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="transfer">{t("rent.transfer")}</SelectItem>
                    <SelectItem value="cash">{t("rent.cash")}</SelectItem>
                    <SelectItem value="other">{isEs ? "Otro" : "Other"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {payMethod === "cash" && (
                <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-sm text-muted-foreground">
                  <span>💵</span>
                  <p>Pago en efectivo. Puede aprobar sin comprobante desde la vista de comprobantes confirmados.</p>
                </div>
              )}
              <div className="space-y-2">
                <Label>{t("rent.notesOptional")}</Label>
                <Textarea value={payNotes} onChange={(e) => setPayNotes(e.target.value)} placeholder={t("rent.addNotes")} rows={2} />
              </div>
              <div className="space-y-2">
                <Label>{t("obligations.attachOptional")}</Label>
                {payFile ? (
                  <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                    <FileText className="w-5 h-5 text-muted-foreground" />
                    <span className="flex-1 text-sm truncate">{payFile.name}</span>
                    <Button type="button" variant="ghost" size="sm" onClick={() => { setPayFile(null); if (payFileRef.current) payFileRef.current.value = ""; }}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-primary/50 transition-colors" onClick={() => payFileRef.current?.click()}>
                    <Upload className="w-6 h-6 mx-auto mb-1 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">{t("rent.clickUpload")}</p>
                  </div>
                )}
                <input ref={payFileRef} type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={handlePayFileChange} />
              </div>
            </div>
          </div>
          <DialogFooter className="px-6 py-4 border-t flex-shrink-0">
            <Button variant="outline" onClick={() => setPayOpen(false)} disabled={isSubmitting}>{t("common.cancel")}</Button>
            <Button onClick={handleRegisterPayment} disabled={isSubmitting}>
              {isSubmitting ? t("common.saving") : (isEs ? "Registrar pago" : "Record Payment")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Payments Modal */}
      <Dialog open={viewPayOpen} onOpenChange={setViewPayOpen}>
        <DialogContent className="sm:max-w-[700px]">
          <DialogHeader>
            <DialogTitle>{isEs ? "Historial de pagos" : "Payment History"}</DialogTitle>
            <DialogDescription>
              {viewPayObl && (
                <>
                  {viewPayObl.properties?.internal_identifier} – {formatMonth(viewPayObl.period)}
                  {viewPayObl.expected_amount && (
                    <> | {isEs ? "Esperado:" : "Expected:"} {formatCurrency(viewPayObl.expected_amount, viewPayObl.currency)}</>
                  )}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          {viewPayObl && viewPayObl.payments.length > 0 ? (
            <div className="space-y-3">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("rent.paymentDate")}</TableHead>
                    <TableHead className="text-right">{t("rent.amount")}</TableHead>
                    <TableHead>{t("rent.method")}</TableHead>
                    <TableHead>{isEs ? "Notas" : "Notes"}</TableHead>
                    <TableHead className="text-right"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {viewPayObl.payments
                    .sort((a, b) => new Date(a.paid_at).getTime() - new Date(b.paid_at).getTime())
                    .map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>{formatDate(p.paid_at)}</TableCell>
                        <TableCell className="text-right font-semibold">{formatCurrency(p.amount, viewPayObl.currency)}</TableCell>
                        <TableCell className="capitalize">{p.method}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{p.notes || "—"}</TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="ghost" className="text-destructive"
                            onClick={() => { setDeletePayId(p.id); setDeletePayOblId(viewPayObl.id); }}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
              <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                <span className="font-medium">{isEs ? "Total pagado" : "Total paid"}</span>
                <span className="font-bold text-success">{formatCurrency(viewPayObl.total_paid, viewPayObl.currency)}</span>
              </div>
              {viewPayObl.balance_due > 0 && (
                <div className="flex justify-between items-center p-3 bg-warning/10 rounded-lg">
                  <span className="font-medium text-warning">{isEs ? "Saldo pendiente" : "Balance due"}</span>
                  <span className="font-bold text-warning">{formatCurrency(viewPayObl.balance_due, viewPayObl.currency)}</span>
                </div>
              )}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-6">{isEs ? "Sin pagos registrados" : "No payments recorded"}</p>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Payment Confirmation */}
      <AlertDialog open={!!deletePayId} onOpenChange={(open) => { if (!open) { setDeletePayId(null); setDeletePayOblId(null); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{isEs ? "Eliminar pago" : "Delete Payment"}</AlertDialogTitle>
            <AlertDialogDescription>
              {isEs ? "¿Estás seguro? Esta acción no se puede deshacer y recalculará el saldo de la obligación." : "Are you sure? This action cannot be undone and will recalculate the obligation balance."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeletePayment} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isSubmitting ? t("common.saving") : (isEs ? "Eliminar" : "Delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reject Modal */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("obligations.rejectProof")}</DialogTitle>
            <DialogDescription>{t("obligations.rejectDesc")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>{t("obligations.reason")} *</Label>
            <Textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder={t("obligations.reasonPlaceholder")} rows={3} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)} disabled={isSubmitting}>{t("common.cancel")}</Button>
            <Button variant="destructive" onClick={handleReject} disabled={isSubmitting}>
              {isSubmitting ? t("common.saving") : t("obligations.reject")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Files dialog */}
      <Dialog open={filesOpen} onOpenChange={(open) => { setFilesOpen(open); if (!open) setSignedUrls([]); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("obligations.attachments")}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            {viewFiles.map((originalUrl, i) => {
              const viewUrl = signedUrls[i] || getProxyUrl(originalUrl);
              const downloadUrl = getProxyUrl(originalUrl, true);
              const isImage = originalUrl.match(/\.(jpg|jpeg|png|webp)($|\?)/i);
              const isPdf = originalUrl.match(/\.pdf($|\?)/i);
              return (
                <div key={i} className="space-y-2">
                  {isImage && <img src={viewUrl} alt={`Attachment ${i + 1}`} className="w-full rounded-lg border" />}
                  {isPdf && <iframe src={viewUrl} className="w-full h-96 rounded-lg border" title={`PDF ${i + 1}`} />}
                  <div className="flex gap-2">
                    <Button variant="default" size="sm" asChild>
                      <a href={downloadUrl} download rel="noopener noreferrer">
                        <Upload className="w-4 h-4 mr-2 rotate-180" />
                        {isEs ? "Descargar" : "Download"}
                      </a>
                    </Button>
                    {(isImage || isPdf) && (
                      <Button variant="outline" size="sm" asChild>
                        <a href={viewUrl} target="_blank" rel="noopener noreferrer">
                          <Eye className="w-4 h-4 mr-2" />
                          {isEs ? "Ver" : "View"}
                        </a>
                      </Button>
                    )}
                    {!isImage && !isPdf && (
                      <Button variant="outline" size="sm" asChild>
                        <a href={viewUrl} target="_blank" rel="noopener noreferrer">
                          <FileCheck className="w-5 h-5 mr-2" />
                          {isEs ? `Archivo ${i + 1}` : `File ${i + 1}`}
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
