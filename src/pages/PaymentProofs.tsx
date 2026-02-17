import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { FileCheck, Eye, CheckCircle, XCircle, Building2, Loader2, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/ui/page-header";
import { SearchBar } from "@/components/ui/search-bar";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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

const STATUS_MAP = {
  pending_send: { es: "Pendiente de envío", en: "Pending submission" },
  awaiting_review: { es: "Recibido", en: "Received" },
  approved: { es: "Aprobado", en: "Approved" },
  rejected: { es: "Rechazado", en: "Rejected" },
  replaced: { es: "Reemplazado", en: "Replaced" },
};

export default function PaymentProofs() {
  const { t, i18n } = useTranslation();
  const isEs = i18n.language?.startsWith("es");
  const { user } = useAuth();
  const { toast } = useToast();

  const [obligations, setObligations] = useState<Obligation[]>([]);
  const [loading, setLoading] = useState(true);
  const [ensuring, setEnsuring] = useState(false);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("action");

  // Reject dialog
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [selectedObligation, setSelectedObligation] = useState<Obligation | null>(null);

  // Files dialog
  const [filesDialogOpen, setFilesDialogOpen] = useState(false);
  const [viewFiles, setViewFiles] = useState<string[]>([]);

  useEffect(() => {
    if (user) {
      ensureAndFetch();
    }
  }, [user]);

  const ensureObligations = async () => {
    setEnsuring(true);
    try {
      await supabase.functions.invoke("ensure-obligations");
    } catch (err) {
      console.error("Error ensuring obligations:", err);
    } finally {
      setEnsuring(false);
    }
  };

  const ensureAndFetch = async () => {
    await ensureObligations();
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
          payment_proofs(id, amount, paid_at, files, status, rejection_reason, comment)
        `)
        .order("due_date", { ascending: false });

      if (error) throw error;
      setObligations((data as unknown as Obligation[]) || []);
    } catch (err) {
      console.error("Error fetching obligations:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (obl: Obligation) => {
    if (!obl.payment_proof_id) return;
    try {
      await supabase
        .from("payment_proofs")
        .update({ status: "approved" })
        .eq("id", obl.payment_proof_id);
      await supabase
        .from("obligations")
        .update({ status: "approved" })
        .eq("id", obl.id);
      toast({ title: isEs ? "Comprobante aprobado" : "Proof approved" });
      fetchObligations();
    } catch {
      toast({ title: t("common.error"), variant: "destructive" });
    }
  };

  const openReject = (obl: Obligation) => {
    setSelectedObligation(obl);
    setRejectReason("");
    setRejectDialogOpen(true);
  };

  const handleReject = async () => {
    if (!selectedObligation?.payment_proof_id) return;
    try {
      await supabase
        .from("payment_proofs")
        .update({ status: "rejected", rejection_reason: rejectReason || null })
        .eq("id", selectedObligation.payment_proof_id);
      await supabase
        .from("obligations")
        .update({ status: "rejected" })
        .eq("id", selectedObligation.id);
      toast({ title: isEs ? "Comprobante rechazado" : "Proof rejected" });
      setRejectDialogOpen(false);
      fetchObligations();
    } catch {
      toast({ title: t("common.error"), variant: "destructive" });
    }
  };

  const openFiles = (files: string[]) => {
    setViewFiles(files);
    setFilesDialogOpen(true);
  };

  const formatMonth = (period: string) => {
    const [year, month] = period.split("-");
    return new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString(
      isEs ? "es-AR" : "en-US",
      { month: "long", year: "numeric" }
    );
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);

  const getKindLabel = (obl: Obligation) => {
    if (obl.kind === "rent") return isEs ? "Alquiler" : "Rent";
    if (obl.service_type) {
      const label = SERVICE_TYPE_LABELS[obl.service_type];
      return label ? (isEs ? label.es : label.en) : obl.service_type;
    }
    return isEs ? "Servicio" : "Service";
  };

  const getStatusLabel = (status: string) => {
    const s = STATUS_MAP[status as keyof typeof STATUS_MAP];
    return s ? (isEs ? s.es : s.en) : status;
  };

  // Filter by tab
  const getFilteredByTab = () => {
    let filtered = obligations;

    // Search filter
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        (o) =>
          o.properties?.internal_identifier?.toLowerCase().includes(q) ||
          o.tenants?.full_name?.toLowerCase().includes(q)
      );
    }

    if (activeTab === "action") {
      // Default view: pending_send + awaiting_review (actionable items)
      return filtered.filter((o) => o.status === "pending_send" || o.status === "awaiting_review");
    }
    if (activeTab === "pending_send") return filtered.filter((o) => o.status === "pending_send");
    if (activeTab === "awaiting_review") return filtered.filter((o) => o.status === "awaiting_review");
    if (activeTab === "approved") return filtered.filter((o) => o.status === "approved");
    if (activeTab === "rejected") return filtered.filter((o) => o.status === "rejected");
    if (activeTab === "all") return filtered;
    return filtered;
  };

  const filtered = getFilteredByTab();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const renderRow = (obl: Obligation) => (
    <TableRow key={obl.id}>
      <TableCell>
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-primary shrink-0" />
          <span className="font-medium">{obl.properties?.internal_identifier}</span>
        </div>
      </TableCell>
      <TableCell className="text-muted-foreground">{obl.tenants?.full_name}</TableCell>
      <TableCell>
        <span className="capitalize">{getKindLabel(obl)}</span>
      </TableCell>
      <TableCell>{formatMonth(obl.period)}</TableCell>
      <TableCell className="text-right font-semibold">
        {obl.payment_proofs?.amount
          ? formatCurrency(obl.payment_proofs.amount)
          : obl.expected_amount
          ? formatCurrency(obl.expected_amount)
          : "—"}
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
          {obl.status === "awaiting_review" && (
            <>
              <Button size="sm" variant="ghost" className="text-success" onClick={() => handleApprove(obl)}>
                <CheckCircle className="w-4 h-4" />
              </Button>
              <Button size="sm" variant="ghost" className="text-destructive" onClick={() => openReject(obl)}>
                <XCircle className="w-4 h-4" />
              </Button>
            </>
          )}
        </div>
      </TableCell>
    </TableRow>
  );

  return (
    <div>
      <PageHeader
        title={isEs ? "Comprobantes" : "Proofs & Obligations"}
        description={isEs ? "Obligaciones mensuales y comprobantes de pago" : "Monthly obligations and payment proofs"}
      >
        <Button
          variant="outline"
          size="sm"
          onClick={ensureAndFetch}
          disabled={ensuring}
        >
          {ensuring ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
          {isEs ? "Actualizar" : "Refresh"}
        </Button>
      </PageHeader>

      <div className="flex flex-col sm:flex-row gap-4 mb-4">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder={isEs ? "Buscar por propiedad o inquilino..." : "Search by property or tenant..."}
          className="flex-1 max-w-md"
        />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-4">
        <TabsList>
          <TabsTrigger value="action">
            {isEs ? "Por gestionar" : "Action needed"}
          </TabsTrigger>
          <TabsTrigger value="pending_send">
            {isEs ? "Pendientes" : "Pending"}
          </TabsTrigger>
          <TabsTrigger value="awaiting_review">
            {isEs ? "Recibidos" : "Received"}
          </TabsTrigger>
          <TabsTrigger value="approved">
            {isEs ? "Aprobados" : "Approved"}
          </TabsTrigger>
          <TabsTrigger value="rejected">
            {isEs ? "Rechazados" : "Rejected"}
          </TabsTrigger>
          <TabsTrigger value="all">
            {isEs ? "Todos" : "All"}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {filtered.length === 0 ? (
        <EmptyState
          icon={FileCheck}
          title={isEs ? "Sin obligaciones" : "No obligations"}
          description={
            activeTab === "action"
              ? isEs
                ? "No hay obligaciones que requieran atención."
                : "No obligations require attention."
              : isEs
              ? "No hay obligaciones en este estado."
              : "No obligations in this status."
          }
          className="py-12"
        />
      ) : (
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table className="min-w-[900px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>{isEs ? "Propiedad" : "Property"}</TableHead>
                    <TableHead>{isEs ? "Inquilino" : "Tenant"}</TableHead>
                    <TableHead>{isEs ? "Concepto" : "Type"}</TableHead>
                    <TableHead>{isEs ? "Período" : "Period"}</TableHead>
                    <TableHead className="text-right">{isEs ? "Monto" : "Amount"}</TableHead>
                    <TableHead>{t("common.status")}</TableHead>
                    <TableHead className="text-right">{t("common.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>{filtered.map(renderRow)}</TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Reject dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isEs ? "Rechazar comprobante" : "Reject proof"}</DialogTitle>
            <DialogDescription>
              {isEs ? "Indicá el motivo del rechazo (opcional)." : "Provide a reason for rejection (optional)."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>{isEs ? "Motivo" : "Reason"}</Label>
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder={isEs ? "Motivo del rechazo..." : "Rejection reason..."}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button variant="destructive" onClick={handleReject}>
              {isEs ? "Rechazar" : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Files dialog */}
      <Dialog open={filesDialogOpen} onOpenChange={setFilesDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{isEs ? "Adjuntos" : "Attachments"}</DialogTitle>
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
                    <span className="text-sm">{isEs ? `Archivo ${i + 1}` : `File ${i + 1}`}</span>
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
