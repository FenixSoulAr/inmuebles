import { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { TrendingUp, Plus, CheckCircle, Clock, ChevronDown, ChevronUp } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface ContractAdjustment {
  id: string;
  adjustment_date: string;
  previous_amount: number;
  calculated_amount: number;
  confirmed_amount: number | null;
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
  isActive: boolean;
  onRentUpdated: () => void;
}

const ADJUSTMENT_TYPE_LABELS: Record<string, string> = {
  ipc: "IPC",
  icl: "ICL",
  fixed_percentage: "Porcentaje fijo",
  manual: "Manual",
};

export function ContractAdjustments({
  contractId,
  currentRent,
  currency,
  adjustmentType,
  adjustmentFrequency,
  adjustmentBaseDate,
  isActive,
  onRentUpdated,
}: ContractAdjustmentsProps) {
  const [adjustments, setAdjustments] = useState<ContractAdjustment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewModal, setShowNewModal] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  // Form state
  const [adjDate, setAdjDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [calculatedAmount, setCalculatedAmount] = useState("");
  const [confirmedAmount, setConfirmedAmount] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [confirmOverride, setConfirmOverride] = useState("");

  useEffect(() => {
    fetchAdjustments();
  }, [contractId]);

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
      // silently handle
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: currency || "ARS",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);

  const formatDate = (dateStr: string) =>
    format(parseISO(dateStr), "dd 'de' MMMM yyyy", { locale: es });

  const handleRegisterAdjustment = async () => {
    if (!calculatedAmount || isNaN(Number(calculatedAmount))) {
      toast({ title: "Error", description: "Ingresá un monto calculado válido.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("contract_adjustments" as any)
        .insert({
          contract_id: contractId,
          adjustment_date: adjDate,
          previous_amount: currentRent,
          calculated_amount: Number(calculatedAmount),
          confirmed_amount: null,
          note: note || null,
        });
      if (error) throw error;

      toast({ title: "Ajuste registrado", description: "El ajuste quedó pendiente de confirmación." });
      setShowNewModal(false);
      setCalculatedAmount("");
      setConfirmedAmount("");
      setNote("");
      fetchAdjustments();
    } catch {
      toast({ title: "Error", description: "No se pudo registrar el ajuste.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmAdjustment = async (adj: ContractAdjustment) => {
    const finalAmount = confirmOverride ? Number(confirmOverride) : adj.calculated_amount;
    if (isNaN(finalAmount) || finalAmount <= 0) {
      toast({ title: "Error", description: "Monto de confirmación inválido.", variant: "destructive" });
      return;
    }
    setConfirming(adj.id);
    try {
      // Update the adjustment record
      const { error: adjError } = await supabase
        .from("contract_adjustments" as any)
        .update({
          confirmed_amount: finalAmount,
          confirmed_by: user?.id,
          confirmed_at: new Date().toISOString(),
        })
        .eq("id", adj.id);
      if (adjError) throw adjError;

      // Update contract's current_rent
      const { error: contractError } = await supabase
        .from("contracts")
        .update({ current_rent: finalAmount })
        .eq("id", contractId);
      if (contractError) throw contractError;

      toast({
        title: "Ajuste confirmado",
        description: `El alquiler fue actualizado a ${formatCurrency(finalAmount)}.`,
      });
      setConfirming(null);
      setConfirmOverride("");
      fetchAdjustments();
      onRentUpdated();
    } catch {
      toast({ title: "Error", description: "No se pudo confirmar el ajuste.", variant: "destructive" });
      setConfirming(null);
    }
  };

  const pendingAdjustments = adjustments.filter((a) => !a.confirmed_at);
  const confirmedAdjustments = adjustments.filter((a) => a.confirmed_at);

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
              <Button size="sm" variant="outline" onClick={() => setShowNewModal(true)}>
                <Plus className="w-3.5 h-3.5 mr-1" />
                Registrar ajuste
              </Button>
            )}
          </div>
          {/* Adjustment settings summary */}
          <div className="flex flex-wrap gap-2 mt-2">
            <Badge variant="secondary" className="text-xs">
              {ADJUSTMENT_TYPE_LABELS[adjustmentType] || adjustmentType}
            </Badge>
            {adjustmentFrequency && (
              <Badge variant="outline" className="text-xs">
                Cada {adjustmentFrequency} {adjustmentFrequency === 1 ? "mes" : "meses"}
              </Badge>
            )}
            {adjustmentBaseDate && (
              <Badge variant="outline" className="text-xs">
                Base: {formatDate(adjustmentBaseDate)}
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Pending adjustments */}
          {pendingAdjustments.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Pendientes de confirmación ({pendingAdjustments.length})
              </p>
              {pendingAdjustments.map((adj) => (
                <PendingAdjustmentRow
                  key={adj.id}
                  adj={adj}
                  formatCurrency={formatCurrency}
                  formatDate={formatDate}
                  confirmOverride={confirmOverride}
                  setConfirmOverride={setConfirmOverride}
                  onConfirm={() => handleConfirmAdjustment(adj)}
                  isConfirming={confirming === adj.id}
                />
              ))}
            </div>
          )}

          {pendingAdjustments.length === 0 && confirmedAdjustments.length === 0 && !loading && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No hay ajustes registrados todavía.
            </p>
          )}

          {/* History */}
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
                    <ConfirmedAdjustmentRow
                      key={adj.id}
                      adj={adj}
                      formatCurrency={formatCurrency}
                      formatDate={formatDate}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* New Adjustment Modal */}
      <Dialog open={showNewModal} onOpenChange={setShowNewModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar ajuste de alquiler</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-muted/40">
              <div>
                <p className="text-xs text-muted-foreground">Alquiler actual</p>
                <p className="font-semibold">{formatCurrency(currentRent)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Tipo de ajuste</p>
                <p className="font-semibold">{ADJUSTMENT_TYPE_LABELS[adjustmentType] || adjustmentType}</p>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="adj-date">Fecha de ajuste</Label>
              <Input
                id="adj-date"
                type="date"
                value={adjDate}
                onChange={(e) => setAdjDate(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="calc-amount">Monto calculado (según índice)</Label>
              <Input
                id="calc-amount"
                type="number"
                placeholder="Ej: 350000"
                value={calculatedAmount}
                onChange={(e) => setCalculatedAmount(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Ingresá el monto resultante de aplicar el índice. Luego podrás confirmar o modificar.
              </p>
            </div>

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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewModal(false)}>Cancelar</Button>
            <Button onClick={handleRegisterAdjustment} disabled={saving}>
              {saving ? "Guardando..." : "Registrar ajuste"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ---------- sub-components ----------

function PendingAdjustmentRow({
  adj,
  formatCurrency,
  formatDate,
  confirmOverride,
  setConfirmOverride,
  onConfirm,
  isConfirming,
}: {
  adj: ContractAdjustment;
  formatCurrency: (n: number) => string;
  formatDate: (s: string) => string;
  confirmOverride: string;
  setConfirmOverride: (v: string) => void;
  onConfirm: () => void;
  isConfirming: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const pct = adj.previous_amount > 0
    ? (((adj.calculated_amount - adj.previous_amount) / adj.previous_amount) * 100).toFixed(1)
    : null;

  return (
    <div className="rounded-lg border border-warning/30 bg-warning/5 p-3 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Clock className="w-3.5 h-3.5 text-warning shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium">{formatDate(adj.adjustment_date)}</p>
            {adj.note && <p className="text-xs text-muted-foreground">{adj.note}</p>}
          </div>
        </div>
        <Badge variant="outline" className="border-warning/50 text-warning text-xs shrink-0">
          Pendiente
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">Anterior</p>
          <p className="font-medium">{formatCurrency(adj.previous_amount)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">
            Calculado {pct && <span className={cn("font-semibold", Number(pct) >= 0 ? "text-success" : "text-destructive")}>({Number(pct) >= 0 ? "+" : ""}{pct}%)</span>}
          </p>
          <p className="font-semibold">{formatCurrency(adj.calculated_amount)}</p>
        </div>
      </div>

      <div>
        <button
          className="text-xs text-primary underline underline-offset-2"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? "Ocultar" : "Confirmar con monto personalizado"}
        </button>
        {expanded && (
          <div className="mt-2 space-y-1.5">
            <Label className="text-xs">Monto a confirmar (dejar vacío para usar el calculado)</Label>
            <Input
              type="number"
              placeholder={String(adj.calculated_amount)}
              value={confirmOverride}
              onChange={(e) => setConfirmOverride(e.target.value)}
              className="h-8 text-sm"
            />
          </div>
        )}
      </div>

      <Button
        size="sm"
        className="w-full"
        onClick={onConfirm}
        disabled={isConfirming}
      >
        <CheckCircle className="w-3.5 h-3.5 mr-1.5" />
        {isConfirming ? "Confirmando..." : `Confirmar ${confirmOverride ? formatCurrency(Number(confirmOverride)) : formatCurrency(adj.calculated_amount)}`}
      </Button>
    </div>
  );
}

function ConfirmedAdjustmentRow({
  adj,
  formatCurrency,
  formatDate,
}: {
  adj: ContractAdjustment;
  formatCurrency: (n: number) => string;
  formatDate: (s: string) => string;
}) {
  const pct = adj.previous_amount > 0 && adj.confirmed_amount
    ? (((adj.confirmed_amount - adj.previous_amount) / adj.previous_amount) * 100).toFixed(1)
    : null;

  return (
    <div className="rounded-lg border border-border bg-muted/20 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <CheckCircle className="w-3.5 h-3.5 text-success shrink-0" />
          <div>
            <p className="text-sm font-medium">{formatDate(adj.adjustment_date)}</p>
            {adj.note && <p className="text-xs text-muted-foreground">{adj.note}</p>}
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-semibold">{formatCurrency(adj.confirmed_amount ?? adj.calculated_amount)}</p>
          {pct && (
            <p className={cn("text-xs font-medium", Number(pct) >= 0 ? "text-success" : "text-destructive")}>
              {Number(pct) >= 0 ? "+" : ""}{pct}%
            </p>
          )}
        </div>
      </div>
      <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
        <span>Anterior: {formatCurrency(adj.previous_amount)}</span>
        {adj.confirmed_at && (
          <span>Confirmado: {format(parseISO(adj.confirmed_at), "dd/MM/yyyy")}</span>
        )}
      </div>
    </div>
  );
}
