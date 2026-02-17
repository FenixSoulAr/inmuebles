import { useEffect, useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  FileCheck, Eye, CheckCircle, XCircle, Building2, Loader2, RefreshCw,
  DollarSign, Upload, X, FileText,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/ui/page-header";
import { SearchBar } from "@/components/ui/search-bar";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
import { useToast } from "@/hooks/use-toast";

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
  } | null;
  // Computed from rent_payments
  total_paid?: number;
  balance_due?: number;
}

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

export default function PaymentProofs() {
  const { t, i18n } = useTranslation();
  const isEs = i18n.language?.startsWith("es");
  const { user } = useAuth();
  const { toast } = useToast();

  const [obligations, setObligations] = useState<Obligation[]>([]);
  const [loading, setLoading] = useState(true);
  const [ensuring, setEnsuring] = useState(false);
  const [search, setSearch] = useState("");
  const [kindTab, setKindTab] = useState<KindTab>("rent");
  const [statusTab, setStatusTab] = useState<StatusTab>("action");

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

  // Reject modal
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectObl, setRejectObl] = useState<Obligation | null>(null);

  // Files dialog
  const [filesOpen, setFilesOpen] = useState(false);
  const [viewFiles, setViewFiles] = useState<string[]>([]);

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
          payment_proofs!obligations_payment_proof_id_fkey(id, amount, paid_at, files, status, rejection_reason, comment)
        `)
        .order("due_date", { ascending: false });

      if (error) throw error;

      const obls = (data as unknown as Obligation[]) || [];

      // For rent obligations, fetch payment totals from rent_dues
      const rentObls = obls.filter((o) => o.kind === "rent");
      if (rentObls.length > 0) {
        const contractPeriods = rentObls.map((o) => ({
          contract_id: o.contract_id,
          period: o.period,
        }));
        const uniqueContracts = [...new Set(contractPeriods.map((cp) => cp.contract_id))];
        const uniquePeriods = [...new Set(contractPeriods.map((cp) => cp.period))];

        const { data: rdData } = await supabase
          .from("rent_dues")
          .select("contract_id, period_month, expected_amount, balance_due, rent_payments(amount)")
          .in("contract_id", uniqueContracts)
          .in("period_month", uniquePeriods);

        if (rdData) {
          const rdMap = new Map<string, { totalPaid: number; balanceDue: number }>();
          for (const rd of rdData as any[]) {
            const payments = rd.rent_payments || [];
            const totalPaid = payments.reduce((s: number, p: any) => s + Number(p.amount), 0);
            rdMap.set(`${rd.contract_id}|${rd.period_month}`, {
              totalPaid,
              balanceDue: Math.max(rd.expected_amount - totalPaid, 0),
            });
          }
          for (const o of rentObls) {
            const key = `${o.contract_id}|${o.period}`;
            const rd = rdMap.get(key);
            if (rd) {
              o.total_paid = rd.totalPaid;
              o.balance_due = rd.balanceDue;
            }
          }
        }
      }

      setObligations(obls);
    } catch (err) {
      console.error("Error fetching obligations:", err);
    } finally {
      setLoading(false);
    }
  };

  // --- Filters ---
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

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
      return filtered.filter(
        (o) =>
          ["pending_send", "awaiting_review", "rejected"].includes(o.status) &&
          o.period <= currentMonth
      );
    }
    if (statusTab === "confirmed") {
      return filtered.filter((o) => o.status === "confirmed");
    }
    // "all" — exclude upcoming by default, last 6 months
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1);
    const sixMonthsStr = `${sixMonthsAgo.getFullYear()}-${String(sixMonthsAgo.getMonth() + 1).padStart(2, "0")}`;
    return filtered.filter((o) => o.status !== "upcoming" && o.period >= sixMonthsStr);
  };

  const filtered = getFiltered();

  // --- Helpers ---
  const formatMonth = (period: string) => {
    const [year, month] = period.split("-");
    return new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString(
      isEs ? "es-AR" : "en-US",
      { month: "long", year: "numeric" }
    );
  };

  const formatCurrency = (amount: number, currency?: string | null) =>
    new Intl.NumberFormat(isEs ? "es-AR" : "en-US", {
      style: "currency",
      currency: currency || "USD",
    }).format(amount);

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString(isEs ? "es-AR" : "en-US", {
      month: "short", day: "numeric", year: "numeric",
    });

  const getServiceLabel = (svcType: string | null) => {
    if (!svcType) return t("obligations.service");
    const label = SERVICE_TYPE_LABELS[svcType];
    return label ? (isEs ? label.es : label.en) : svcType;
  };

  // --- Confirm modal ---
  const openConfirm = (obl: Obligation) => {
    setConfirmObl(obl);
    setConfirmDate(new Date().toISOString().split("T")[0]);
    const defaultAmount = obl.payment_proofs?.amount ?? obl.expected_amount ?? 0;
    setConfirmAmount(String(defaultAmount));
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

  const uploadAttachment = async (oblId: string): Promise<string | null> => {
    if (!confirmFile || !user) return null;
    const ext = confirmFile.name.split(".").pop();
    const path = `${user.id}/${oblId}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("documents").upload(path, confirmFile);
    if (error) throw error;
    return supabase.storage.from("documents").getPublicUrl(path).data.publicUrl;
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
        attachmentUrl = await uploadAttachment(confirmObl.id);
      }

      // Approve linked payment proof if exists
      if (confirmObl.payment_proof_id) {
        await supabase
          .from("payment_proofs")
          .update({ status: "approved" })
          .eq("id", confirmObl.payment_proof_id);
      }

      // Derive obligation status from actual balance
      let newOblStatus = "confirmed";

      if (confirmObl.kind === "rent") {
        const { data: rentDue } = await supabase
          .from("rent_dues")
          .select("id, expected_amount")
          .eq("contract_id", confirmObl.contract_id)
          .eq("period_month", confirmObl.period)
          .maybeSingle();

        if (rentDue) {
          await supabase.from("rent_payments").insert({
            rent_due_id: rentDue.id,
            payment_date: confirmDate,
            amount,
            method: confirmMethod,
            receipt_file_url: attachmentUrl,
            notes: confirmNotes || null,
          });

          // Recalculate balance
          const { data: payments } = await supabase
            .from("rent_payments")
            .select("amount")
            .eq("rent_due_id", rentDue.id);

          const newTotal = (payments || []).reduce((s, p) => s + Number(p.amount), 0);
          const newBalance = Math.max(rentDue.expected_amount - newTotal, 0);

          await supabase
            .from("rent_dues")
            .update({ status: newBalance <= 0 ? "paid" : "partial", balance_due: newBalance })
            .eq("id", rentDue.id);

          // Derive obligation status from balance
          if (newBalance <= 0) {
            newOblStatus = "confirmed";
          } else if (newTotal > 0) {
            newOblStatus = "awaiting_review";
          } else {
            newOblStatus = "pending_send";
          }
        }
      }

      await supabase
        .from("obligations")
        .update({ status: newOblStatus })
        .eq("id", confirmObl.id);

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

  // --- Reject modal ---
  const openReject = (obl: Obligation) => {
    setRejectObl(obl);
    setRejectReason("");
    setRejectOpen(true);
  };

  const handleReject = async () => {
    if (!rejectObl) return;
    if (!rejectReason.trim()) {
      toast({ title: t("common.error"), description: t("obligations.reasonRequired"), variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    try {
      await supabase
        .from("obligations")
        .update({ status: "rejected" })
        .eq("id", rejectObl.id);

      if (rejectObl.payment_proof_id) {
        await supabase
          .from("payment_proofs")
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

  // --- Files dialog ---
  const openFiles = (files: string[]) => {
    setViewFiles(files);
    setFilesOpen(true);
  };

  // --- Render ---
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const renderRentRow = (obl: Obligation) => {
    const totalPaid = obl.total_paid ?? 0;
    const balanceDue = obl.balance_due ?? (obl.expected_amount ? obl.expected_amount - totalPaid : 0);

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
          <span className={totalPaid > 0 ? "font-semibold text-success" : "text-muted-foreground"}>
            {formatCurrency(totalPaid, obl.currency)}
          </span>
        </TableCell>
        <TableCell className="text-right">
          <span className={balanceDue > 0 ? "font-semibold text-warning" : "text-muted-foreground"}>
            {formatCurrency(balanceDue, obl.currency)}
          </span>
        </TableCell>
        <TableCell>
          <StatusBadge variant={obl.status as any} />
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
            {["pending_send", "awaiting_review", "rejected"].includes(obl.status) && (
              <Button size="sm" variant="outline" className="text-success" onClick={() => openConfirm(obl)}>
                <CheckCircle className="w-4 h-4 mr-1" />
                {t("obligations.confirm")}
              </Button>
            )}
            {obl.status === "awaiting_review" && (
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

  const renderServiceRow = (obl: Obligation) => (
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
        {obl.expected_amount ? formatCurrency(obl.expected_amount, obl.currency) : "—"}
      </TableCell>
      <TableCell>
        <StatusBadge variant={obl.status as any} />
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
          {["pending_send", "awaiting_review", "rejected"].includes(obl.status) && (
            <Button size="sm" variant="outline" className="text-success" onClick={() => openConfirm(obl)}>
              <CheckCircle className="w-4 h-4 mr-1" />
              {t("obligations.confirm")}
            </Button>
          )}
          {obl.status === "awaiting_review" && (
            <Button size="sm" variant="outline" className="text-destructive" onClick={() => openReject(obl)}>
              <XCircle className="w-4 h-4 mr-1" />
              {t("obligations.reject")}
            </Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  );

  return (
    <div>
      <PageHeader
        title={t("obligations.title")}
        description={t("obligations.description")}
      >
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
      <div className="flex flex-col sm:flex-row gap-4 mb-4">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder={t("obligations.searchPlaceholder")}
          className="flex-1 max-w-md"
        />
        <Tabs value={statusTab} onValueChange={(v) => setStatusTab(v as StatusTab)}>
          <TabsList>
            <TabsTrigger value="action">{t("obligations.actionNeeded")}</TabsTrigger>
            <TabsTrigger value="confirmed">{t("obligations.confirmed")}</TabsTrigger>
            <TabsTrigger value="all">{t("obligations.all")}</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={kindTab === "rent" ? DollarSign : FileCheck}
          title={t("obligations.noObligations")}
          description={
            statusTab === "action"
              ? t("obligations.noActionNeeded")
              : t("obligations.noInStatus")
          }
          className="py-12"
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
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={confirmAmount}
                  onChange={(e) => setConfirmAmount(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>{t("rent.method")} *</Label>
                <Select value={confirmMethod} onValueChange={setConfirmMethod}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="transfer">{t("rent.transfer")}</SelectItem>
                    <SelectItem value="cash">{t("rent.cash")}</SelectItem>
                    <SelectItem value="other">{t("obligations.otherMethod")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{t("rent.notesOptional")}</Label>
                <Textarea
                  value={confirmNotes}
                  onChange={(e) => setConfirmNotes(e.target.value)}
                  placeholder={t("rent.addNotes")}
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label>{t("obligations.attachOptional")}</Label>
                {confirmFile ? (
                  <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                    <FileText className="w-5 h-5 text-muted-foreground" />
                    <span className="flex-1 text-sm truncate">{confirmFile.name}</span>
                    <Button type="button" variant="ghost" size="sm" onClick={() => {
                      setConfirmFile(null);
                      if (confirmFileRef.current) confirmFileRef.current.value = "";
                    }}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <div
                    className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-primary/50 transition-colors"
                    onClick={() => confirmFileRef.current?.click()}
                  >
                    <Upload className="w-6 h-6 mx-auto mb-1 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">{t("rent.clickUpload")}</p>
                  </div>
                )}
                <input
                  ref={confirmFileRef}
                  type="file"
                  className="hidden"
                  accept=".pdf,.jpg,.jpeg,.png,.webp"
                  onChange={handleConfirmFileChange}
                />
              </div>
            </div>
          </div>

          <DialogFooter className="px-6 py-4 border-t flex-shrink-0">
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={isSubmitting}>
              {t("common.cancel")}
            </Button>
            <Button onClick={handleConfirm} disabled={isSubmitting}>
              {isSubmitting ? t("common.saving") : t("obligations.confirmPaymentTitle")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Modal */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("obligations.rejectProof")}</DialogTitle>
            <DialogDescription>{t("obligations.rejectDesc")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>{t("obligations.reason")} *</Label>
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder={t("obligations.reasonPlaceholder")}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)} disabled={isSubmitting}>
              {t("common.cancel")}
            </Button>
            <Button variant="destructive" onClick={handleReject} disabled={isSubmitting}>
              {isSubmitting ? t("common.saving") : t("obligations.reject")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Files dialog */}
      <Dialog open={filesOpen} onOpenChange={setFilesOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("obligations.attachments")}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            {viewFiles.map((url, i) => (
              <div key={i}>
                {url.match(/\.(jpg|jpeg|png)$/i) ? (
                  <img src={url} alt={`Attachment ${i + 1}`} className="w-full rounded-lg border" />
                ) : (
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 p-3 rounded-lg border hover:bg-muted"
                  >
                    <FileCheck className="w-5 h-5 text-primary" />
                    <span className="text-sm">{t("obligations.file", { num: i + 1 })}</span>
                  </a>
                )}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
