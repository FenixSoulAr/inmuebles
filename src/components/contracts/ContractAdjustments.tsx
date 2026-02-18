import { useEffect, useState, useMemo } from "react";
import { format, parseISO, addMonths } from "date-fns";
import { es } from "date-fns/locale";
import {
  TrendingUp, Plus, CheckCircle, Clock, ChevronDown, ChevronUp,
  Pencil, Trash2, AlertTriangle, Calendar, Info,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ContractAdjustment {
  id: string;
  adjustment_date: string;
  previous_amount: number;
  manual_percentage: number | null;
  calculated_amount: number;
  confirmed_amount: number | null;
  status: string; // 'draft' | 'confirmed'
  confirmed_by: string | null;
  confirmed_at: string | null;
  note: string | null;
  created_at: string;
}

interface ContractAdjustmentsProps {
  contractId: string;
  currentRent: number;
  currency: string;
  adjustmentType: string;
  adjustmentFrequency: number | null;
  adjustmentBaseDate: string | null;
  startDate: string;
  isActive: boolean;
  onRentUpdated: () => void;
}

const ADJUSTMENT_TYPE_LABELS: Record<string, string> = {
  ipc: "IPC",
  icl: "ICL",
  fixed_percentage: "Porcentaje fijo",
  fixed: "Porcentaje fijo",
  manual: "Manual",
};

// ─── Utils ────────────────────────────────────────────────────────────────────

function formatAmountFn(amount: number, currency: string) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: currency || "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDateFn(dateStr: string) {
  return format(parseISO(dateStr), "dd 'de' MMMM yyyy", { locale: es });
}

function calcNextAdjustmentDate(
  startDate: string,
  frequencyMonths: number,
  lastConfirmedDate: string | null
): Date {
  const base = lastConfirmedDate ? parseISO(lastConfirmedDate) : parseISO(startDate);
  return addMonths(base, frequencyMonths);
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ContractAdjustments({
  contractId,
  currentRent,
  currency,
  adjustmentType,
  adjustmentFrequency,
  adjustmentBaseDate,
  startDate,
  isActive,
  onRentUpdated,
}: ContractAdjustmentsProps) {
  const [adjustments, setAdjustments] = useState<ContractAdjustment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingDraft, setEditingDraft] = useState<ContractAdjustment | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const formatAmount = (n: number) => formatAmountFn(n, currency);

  // ── Data ──────────────────────────────────────────────────────────────────

  const fetchAdjustments = async () => {
    try {
      const { data, error } = await supabase
        .from("contract_adjustments" as any)
        .select("*")
        .eq("contract_id", contractId)
        .order("adjustment_date", { ascending: false });

      if (error) throw error;
      setAdjustments((data as unknown as ContractAdjustment[]) || []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdjustments();
  }, [contractId]);

  // ── Derived ───────────────────────────────────────────────────────────────

  const confirmedAdjustments = useMemo(
    () => adjustments.filter((a) => a.status === "confirmed"),
    [adjustments]
  );
  const draftAdjustments = useMemo(
    () => adjustments.filter((a) => a.status === "draft"),
    [adjustments]
  );

  const lastConfirmed = confirmedAdjustments[0] ?? null; // already sorted desc

  const nextAdjustmentDate = useMemo(() => {
    if (!adjustmentFrequency) return null;
    return calcNextAdjustmentDate(
      startDate,
      adjustmentFrequency,
      lastConfirmed?.adjustment_date ?? null
    );
  }, [startDate, adjustmentFrequency, lastConfirmed]);

  // ── Delete draft ──────────────────────────────────────────────────────────

  const handleDeleteDraft = async (id: string) => {
    try {
      const { error } = await supabase
        .from("contract_adjustments" as any)
        .delete()
        .eq("id", id)
        .eq("status", "draft");
      if (error) throw error;
      toast({ title: "Borrador eliminado" });
      fetchAdjustments();
    } catch {
      toast({ title: "Error", description: "No se pudo eliminar el borrador.", variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  };

  const handleConfirmAdjustment = async (adj: ContractAdjustment, finalAmount: number) => {
    try {
      const { error: adjErr } = await supabase
        .from("contract_adjustments" as any)
        .update({
          confirmed_amount: finalAmount,
          confirmed_by: user?.id,
          confirmed_at: new Date().toISOString(),
          status: "confirmed",
        })
        .eq("id", adj.id);
      if (adjErr) throw adjErr;

      const { error: contractErr } = await supabase
        .from("contracts")
        .update({ current_rent: finalAmount })
        .eq("id", contractId);
      if (contractErr) throw contractErr;

      toast({
        title: "Ajuste confirmado",
        description: `El alquiler fue actualizado a ${formatAmount(finalAmount)}.`,
      });
      fetchAdjustments();
      onRentUpdated();
    } catch {
      toast({ title: "Error", description: "No se pudo confirmar el ajuste.", variant: "destructive" });
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="w-4 h-4" />
              Ajuste de alquiler
            </CardTitle>
            {isActive && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => { setEditingDraft(null); setShowModal(true); }}
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Registrar ajuste
              </Button>
            )}
          </div>

          {/* Settings row */}
          <div className="flex flex-wrap gap-2 mt-2">
            <Badge variant="secondary" className="text-xs">
              {ADJUSTMENT_TYPE_LABELS[adjustmentType] || adjustmentType}
            </Badge>
            {adjustmentFrequency && (
              <Badge variant="outline" className="text-xs">
                Cada {adjustmentFrequency} {adjustmentFrequency === 1 ? "mes" : "meses"}
              </Badge>
            )}
            {nextAdjustmentDate && (
              <Badge variant="outline" className="text-xs gap-1">
                <Calendar className="w-3 h-3" />
                Próximo ajuste: {format(nextAdjustmentDate, "dd/MM/yyyy")}
              </Badge>
            )}
          </div>

          {/* Current rent */}
          <div className="mt-3 rounded-lg bg-muted/40 px-3 py-2 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Alquiler vigente</span>
            <span className="font-semibold text-primary">{formatAmount(currentRent)}</span>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Draft adjustments */}
          {draftAdjustments.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Borradores ({draftAdjustments.length})
              </p>
              {draftAdjustments.map((adj) => (
                <DraftRow
                  key={adj.id}
                  adj={adj}
                  formatAmount={formatAmount}
                  onEdit={() => { setEditingDraft(adj); setShowModal(true); }}
                  onDelete={() => setDeletingId(adj.id)}
                  onConfirm={handleConfirmAdjustment}
                />
              ))}
            </div>
          )}

          {!loading && draftAdjustments.length === 0 && confirmedAdjustments.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No hay ajustes registrados todavía.
            </p>
          )}

          {/* Confirmed history */}
          {confirmedAdjustments.length > 0 && (
            <div>
              <button
                className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setShowHistory((v) => !v)}
              >
                {showHistory ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                Historial confirmado ({confirmedAdjustments.length})
              </button>
              {showHistory && (
                <div className="mt-2 space-y-2">
                  {confirmedAdjustments.map((adj) => (
                    <ConfirmedRow key={adj.id} adj={adj} formatAmount={formatAmount} />
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Adjustment modal */}
      {showModal && (
        <AdjustmentModal
          open={showModal}
          onOpenChange={(v) => { setShowModal(v); if (!v) setEditingDraft(null); }}
          contractId={contractId}
          currentRent={currentRent}
          currency={currency}
          adjustmentType={adjustmentType}
          nextAdjustmentDate={nextAdjustmentDate}
          editingDraft={editingDraft}
          userId={user?.id ?? ""}
          onSaved={() => { fetchAdjustments(); setShowModal(false); setEditingDraft(null); }}
          onConfirmed={(adj, amount) => {
            handleConfirmAdjustment(adj, amount);
            setShowModal(false);
            setEditingDraft(null);
          }}
        />
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deletingId} onOpenChange={(v) => { if (!v) setDeletingId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar borrador?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. El borrador será eliminado permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deletingId && handleDeleteDraft(deletingId)}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ─── Draft Row ────────────────────────────────────────────────────────────────

function DraftRow({
  adj,
  formatAmount,
  onEdit,
  onDelete,
  onConfirm,
}: {
  adj: ContractAdjustment;
  formatAmount: (n: number) => string;
  onEdit: () => void;
  onDelete: () => void;
  onConfirm: (adj: ContractAdjustment, amount: number) => void;
}) {
  const pct = adj.manual_percentage != null
    ? `${adj.manual_percentage > 0 ? "+" : ""}${adj.manual_percentage}%`
    : null;

  return (
    <div className="rounded-lg border border-warning/30 bg-warning/5 p-3 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Clock className="w-3.5 h-3.5 text-warning shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium">{formatDateFn(adj.adjustment_date)}</p>
            {adj.note && <p className="text-xs text-muted-foreground">{adj.note}</p>}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Badge variant="outline" className="text-xs border-warning/50 text-warning">
            Borrador
          </Badge>
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={onEdit}>
            <Pencil className="w-3 h-3" />
          </Button>
          <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive hover:text-destructive" onClick={onDelete}>
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">Anterior</p>
          <p className="font-medium">{formatAmount(adj.previous_amount)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">% aplicado</p>
          <p className="font-medium">{pct ?? "—"}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Calculado</p>
          <p className="font-semibold text-primary">{formatAmount(adj.calculated_amount)}</p>
        </div>
      </div>

      <Button
        size="sm"
        className="w-full"
        onClick={() => onConfirm(adj, adj.calculated_amount)}
      >
        <CheckCircle className="w-3.5 h-3.5 mr-1.5" />
        Confirmar {formatAmount(adj.calculated_amount)}
      </Button>
    </div>
  );
}

// ─── Confirmed Row ────────────────────────────────────────────────────────────

function ConfirmedRow({
  adj,
  formatAmount,
}: {
  adj: ContractAdjustment;
  formatAmount: (n: number) => string;
}) {
  const finalAmount = adj.confirmed_amount ?? adj.calculated_amount;
  const pct = adj.manual_percentage != null
    ? `${adj.manual_percentage > 0 ? "+" : ""}${adj.manual_percentage}%`
    : adj.previous_amount > 0
      ? `+${(((finalAmount - adj.previous_amount) / adj.previous_amount) * 100).toFixed(1)}%`
      : null;

  return (
    <div className="rounded-lg border border-border bg-muted/20 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <CheckCircle className="w-3.5 h-3.5 text-success shrink-0" />
          <div>
            <p className="text-sm font-medium">{formatDateFn(adj.adjustment_date)}</p>
            {adj.note && <p className="text-xs text-muted-foreground">{adj.note}</p>}
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-semibold">{formatAmount(finalAmount)}</p>
          {pct && <p className="text-xs text-muted-foreground">{pct}</p>}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span>Anterior: {formatAmount(adj.previous_amount)}</span>
        {adj.confirmed_at && (
          <span>Confirmado: {format(parseISO(adj.confirmed_at), "dd/MM/yyyy")}</span>
        )}
      </div>
    </div>
  );
}

// ─── Adjustment Modal ─────────────────────────────────────────────────────────

interface AdjustmentModalProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  contractId: string;
  currentRent: number;
  currency: string;
  adjustmentType: string;
  nextAdjustmentDate: Date | null;
  editingDraft: ContractAdjustment | null;
  userId: string;
  onSaved: () => void;
  onConfirmed: (adj: ContractAdjustment, amount: number) => void;
}

function AdjustmentModal({
  open,
  onOpenChange,
  contractId,
  currentRent,
  currency,
  adjustmentType,
  nextAdjustmentDate,
  editingDraft,
  userId,
  onSaved,
  onConfirmed,
}: AdjustmentModalProps) {
  const { toast } = useToast();
  const isEditing = !!editingDraft;

  const defaultDate = nextAdjustmentDate
    ? format(nextAdjustmentDate, "yyyy-MM-dd")
    : format(new Date(), "yyyy-MM-dd");

  const [adjDate, setAdjDate] = useState(
    editingDraft?.adjustment_date ?? defaultDate
  );
  const [pctStr, setPctStr] = useState(
    editingDraft?.manual_percentage != null ? String(editingDraft.manual_percentage) : ""
  );
  const [confirmedStr, setConfirmedStr] = useState(
    editingDraft?.confirmed_amount != null ? String(editingDraft.confirmed_amount) : ""
  );
  const [note, setNote] = useState(editingDraft?.note ?? "");
  const [saving, setSaving] = useState(false);

  const previousAmount = editingDraft?.previous_amount ?? currentRent;

  const calculatedAmount = useMemo(() => {
    const pct = parseFloat(pctStr);
    if (isNaN(pct)) return null;
    return previousAmount * (1 + pct / 100);
  }, [previousAmount, pctStr]);

  const confirmedAmount = useMemo(() => {
    if (confirmedStr !== "") {
      const v = parseFloat(confirmedStr);
      return isNaN(v) ? null : v;
    }
    return calculatedAmount;
  }, [confirmedStr, calculatedAmount]);

  const formatAmount = (n: number) => formatAmountFn(n, currency);

  const buildPayload = (status: "draft" | "confirmed") => ({
    contract_id: contractId,
    adjustment_date: adjDate,
    previous_amount: previousAmount,
    manual_percentage: pctStr !== "" ? parseFloat(pctStr) : null,
    calculated_amount: calculatedAmount ?? previousAmount,
    confirmed_amount: status === "confirmed" ? (confirmedAmount ?? calculatedAmount ?? previousAmount) : null,
    confirmed_by: status === "confirmed" ? userId : null,
    confirmed_at: status === "confirmed" ? new Date().toISOString() : null,
    status,
    note: note || null,
  });

  const handleSave = async (mode: "draft" | "confirm") => {
    if (!adjDate) {
      toast({ title: "Error", description: "La fecha de vigencia es obligatoria.", variant: "destructive" });
      return;
    }
    if (mode === "confirm" && (confirmedAmount == null || confirmedAmount <= 0)) {
      toast({ title: "Error", description: "El monto confirmado debe ser mayor a 0.", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const payload = buildPayload(mode === "confirm" ? "confirmed" : "draft");

      if (isEditing && editingDraft) {
        const { error } = await supabase
          .from("contract_adjustments" as any)
          .update(payload)
          .eq("id", editingDraft.id)
          .eq("status", "draft");
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("contract_adjustments" as any)
          .insert(payload);
        if (error) throw error;
      }

      // If confirming: also update current_rent on the contract
      if (mode === "confirm") {
        const newRent = confirmedAmount ?? calculatedAmount ?? previousAmount;
        const { error } = await supabase
          .from("contracts")
          .update({ current_rent: newRent })
          .eq("id", contractId);
        if (error) throw error;
        toast({
          title: "Ajuste confirmado",
          description: `El alquiler fue actualizado a ${formatAmount(newRent)}.`,
        });
      } else {
        toast({ title: "Borrador guardado", description: "Podés confirmar el ajuste cuando estés listo." });
      }

      onSaved();
    } catch (err) {
      console.error(err);
      toast({ title: "Error", description: "No se pudo guardar el ajuste.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            {isEditing ? "Editar ajuste (borrador)" : "Registrar ajuste de alquiler"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Info block */}
          <div className="rounded-lg bg-muted/40 p-3 grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Alquiler anterior</p>
              <p className="font-semibold">{formatAmount(previousAmount)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Tipo de ajuste</p>
              <p className="font-semibold">{ADJUSTMENT_TYPE_LABELS[adjustmentType] || adjustmentType}</p>
            </div>
          </div>

          {/* A) Fecha de vigencia */}
          <div className="space-y-1.5">
            <Label htmlFor="adj-date">
              Fecha de vigencia del ajuste
              {nextAdjustmentDate && (
                <span className="ml-1.5 text-xs text-muted-foreground font-normal">
                  (próximo calculado: {format(nextAdjustmentDate, "dd/MM/yyyy")})
                </span>
              )}
            </Label>
            <Input
              id="adj-date"
              type="date"
              value={adjDate}
              onChange={(e) => setAdjDate(e.target.value)}
            />
          </div>

          {/* B) % de ajuste + cálculo en vivo */}
          <div className="space-y-1.5">
            <Label htmlFor="pct">% de ajuste</Label>
            <div className="relative">
              <Input
                id="pct"
                type="number"
                step="0.01"
                placeholder="Ej: 15.5"
                value={pctStr}
                onChange={(e) => {
                  setPctStr(e.target.value);
                  setConfirmedStr(""); // reset override when % changes
                }}
                className="pr-8"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
            </div>
            {calculatedAmount != null && (
              <div className="flex items-center gap-2 rounded-md bg-primary/5 border border-primary/20 px-3 py-2">
                <Info className="w-3.5 h-3.5 text-primary shrink-0" />
                <span className="text-sm">
                  Monto calculado:{" "}
                  <span className="font-semibold text-primary">{formatAmount(calculatedAmount)}</span>
                </span>
              </div>
            )}
          </div>

          {/* C) Monto final confirmado (editable) */}
          <div className="space-y-1.5">
            <Label htmlFor="confirmed">
              Monto final confirmado
              <span className="ml-1.5 text-xs text-muted-foreground font-normal">
                (prellenado con el calculado, editable)
              </span>
            </Label>
            <Input
              id="confirmed"
              type="number"
              placeholder={calculatedAmount != null ? String(Math.round(calculatedAmount)) : "Ingresá un %"}
              value={confirmedStr}
              onChange={(e) => setConfirmedStr(e.target.value)}
            />
          </div>

          {/* Note */}
          <div className="space-y-1.5">
            <Label htmlFor="adj-note">Nota (opcional)</Label>
            <Textarea
              id="adj-note"
              placeholder="Ej: IPC enero 2026 = 3.8%"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
            />
          </div>

          {/* Warning */}
          <Alert className="border-warning/40 bg-warning/5">
            <AlertTriangle className="h-4 w-4 text-warning" />
            <AlertDescription className="text-xs">
              Al confirmar, solo se actualiza el alquiler vigente del contrato.{" "}
              <strong>Los comprobantes ya emitidos no serán modificados.</strong>
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button
            variant="outline"
            onClick={() => handleSave("draft")}
            disabled={saving}
          >
            {saving ? "Guardando..." : "Guardar como borrador"}
          </Button>
          <Button
            onClick={() => handleSave("confirm")}
            disabled={saving || (confirmedAmount == null || confirmedAmount <= 0)}
          >
            {saving ? "Confirmando..." : "Confirmar ajuste"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
