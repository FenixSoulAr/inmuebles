import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { FileCheck, Eye, CheckCircle, XCircle, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/ui/page-header";
import { SearchBar } from "@/components/ui/search-bar";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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

interface PaymentProof {
  id: string;
  contract_id: string;
  type: string;
  service_type: string | null;
  period: string;
  amount: number;
  paid_at: string;
  comment: string | null;
  files: string[];
  status: string;
  rejection_reason: string | null;
  replaces_proof_id: string | null;
  created_at: string;
  contracts: {
    properties: { internal_identifier: string };
    tenants: { full_name: string };
  };
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

export default function PaymentProofs() {
  const { t, i18n } = useTranslation();
  const isEs = i18n.language?.startsWith("es");
  const { user } = useAuth();
  const { toast } = useToast();

  const [proofs, setProofs] = useState<PaymentProof[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  // Reject dialog
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [selectedProof, setSelectedProof] = useState<PaymentProof | null>(null);

  // Files dialog
  const [filesDialogOpen, setFilesDialogOpen] = useState(false);
  const [viewFiles, setViewFiles] = useState<string[]>([]);

  useEffect(() => {
    if (user) fetchProofs();
  }, [user]);

  const fetchProofs = async () => {
    try {
      const { data, error } = await supabase
        .from("payment_proofs")
        .select(`
          *,
          contracts(
            properties(internal_identifier),
            tenants(full_name)
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setProofs((data as unknown as PaymentProof[]) || []);
    } catch (err) {
      console.error("Error fetching proofs:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (proof: PaymentProof) => {
    try {
      const { error } = await supabase
        .from("payment_proofs")
        .update({ status: "approved" })
        .eq("id", proof.id);
      if (error) throw error;
      toast({ title: isEs ? "Comprobante aprobado" : "Proof approved" });
      fetchProofs();
    } catch {
      toast({ title: t("common.error"), variant: "destructive" });
    }
  };

  const openReject = (proof: PaymentProof) => {
    setSelectedProof(proof);
    setRejectReason("");
    setRejectDialogOpen(true);
  };

  const handleReject = async () => {
    if (!selectedProof) return;
    try {
      const { error } = await supabase
        .from("payment_proofs")
        .update({ status: "rejected", rejection_reason: rejectReason || null })
        .eq("id", selectedProof.id);
      if (error) throw error;
      toast({ title: isEs ? "Comprobante rechazado" : "Proof rejected" });
      setRejectDialogOpen(false);
      fetchProofs();
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
    return new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString(isEs ? "es-AR" : "en-US", {
      month: "long",
      year: "numeric",
    });
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);

  const filtered = proofs.filter((p) => {
    const matchesSearch =
      p.contracts.properties.internal_identifier.toLowerCase().includes(search.toLowerCase()) ||
      p.contracts.tenants.full_name.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || p.status === statusFilter;
    const matchesType = typeFilter === "all" || p.type === typeFilter;
    return matchesSearch && matchesStatus && matchesType;
  });

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
        title={isEs ? "Comprobantes de pago" : "Payment Proofs"}
        description={isEs ? "Revisá y gestioná los comprobantes enviados por inquilinos" : "Review and manage proofs submitted by tenants"}
      />

      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder={isEs ? "Buscar por propiedad o inquilino..." : "Search by property or tenant..."}
          className="flex-1 max-w-md"
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("common.allStatus")}</SelectItem>
            <SelectItem value="pending">{isEs ? "Pendiente" : "Pending"}</SelectItem>
            <SelectItem value="approved">{isEs ? "Aprobado" : "Approved"}</SelectItem>
            <SelectItem value="rejected">{isEs ? "Rechazado" : "Rejected"}</SelectItem>
            <SelectItem value="replaced">{isEs ? "Reemplazado" : "Replaced"}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("common.all")}</SelectItem>
            <SelectItem value="rent">{isEs ? "Alquiler" : "Rent"}</SelectItem>
            <SelectItem value="service">{isEs ? "Servicio" : "Service"}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={FileCheck}
          title={isEs ? "Sin comprobantes" : "No payment proofs"}
          description={isEs ? "Los comprobantes enviados por inquilinos aparecerán aquí." : "Proofs submitted by tenants will appear here."}
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
                    <TableHead>{isEs ? "Tipo" : "Type"}</TableHead>
                    <TableHead>{isEs ? "Período" : "Period"}</TableHead>
                    <TableHead className="text-right">{isEs ? "Monto" : "Amount"}</TableHead>
                    <TableHead>{t("common.status")}</TableHead>
                    <TableHead className="text-right">{t("common.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-primary shrink-0" />
                          <span className="font-medium">{p.contracts.properties.internal_identifier}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{p.contracts.tenants.full_name}</TableCell>
                      <TableCell>
                        <span className="capitalize">
                          {p.type === "rent"
                            ? isEs ? "Alquiler" : "Rent"
                            : p.service_type
                              ? (SERVICE_TYPE_LABELS[p.service_type]?.[isEs ? "es" : "en"] || p.service_type)
                              : isEs ? "Servicio" : "Service"}
                        </span>
                      </TableCell>
                      <TableCell>{formatMonth(p.period)}</TableCell>
                      <TableCell className="text-right font-semibold">{formatCurrency(p.amount)}</TableCell>
                      <TableCell>
                        <StatusBadge variant={p.status as any} />
                        {p.rejection_reason && (
                          <p className="text-xs text-destructive mt-1">{p.rejection_reason}</p>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button size="sm" variant="ghost" onClick={() => openFiles(p.files)}>
                            <Eye className="w-4 h-4" />
                          </Button>
                          {p.status === "pending" && (
                            <>
                              <Button size="sm" variant="ghost" className="text-success" onClick={() => handleApprove(p)}>
                                <CheckCircle className="w-4 h-4" />
                              </Button>
                              <Button size="sm" variant="ghost" className="text-destructive" onClick={() => openReject(p)}>
                                <XCircle className="w-4 h-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
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
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>{t("common.cancel")}</Button>
            <Button variant="destructive" onClick={handleReject}>{isEs ? "Rechazar" : "Reject"}</Button>
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
                  <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-3 rounded-lg border hover:bg-muted">
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
