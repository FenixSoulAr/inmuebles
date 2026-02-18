import { useState } from "react";
import { AlertTriangle, DollarSign } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface CorrectCurrencyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contractId: string;
  currentCurrencyRent: string;
  currentCurrencyDeposit: string;
  currentRent: number;
  currentDeposit: number | null;
  onSuccess: () => void;
}

export function CorrectCurrencyModal({
  open,
  onOpenChange,
  contractId,
  currentCurrencyRent,
  currentCurrencyDeposit,
  currentRent,
  currentDeposit,
  onSuccess,
}: CorrectCurrencyModalProps) {
  const { toast } = useToast();

  const [currencyRent, setCurrencyRent] = useState(currentCurrencyRent || "ARS");
  const [currencyDeposit, setCurrencyDeposit] = useState(currentCurrencyDeposit || "ARS");
  const [depositAmount, setDepositAmount] = useState(
    currentDeposit != null ? String(currentDeposit) : ""
  );
  const [overrideRent, setOverrideRent] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updateData: Record<string, unknown> = {
        currency: currencyRent,
        currency_deposit: currencyDeposit,
      };

      if (depositAmount !== "") {
        const parsed = parseFloat(depositAmount);
        if (isNaN(parsed) || parsed < 0) {
          toast({ title: "Error", description: "Monto de depósito inválido.", variant: "destructive" });
          setSaving(false);
          return;
        }
        updateData.deposit = parsed;
      }

      if (overrideRent !== "") {
        const parsedRent = parseFloat(overrideRent);
        if (isNaN(parsedRent) || parsedRent <= 0) {
          toast({ title: "Error", description: "Monto de alquiler inválido.", variant: "destructive" });
          setSaving(false);
          return;
        }
        updateData.current_rent = parsedRent;
      }

      const { error } = await supabase
        .from("contracts")
        .update(updateData)
        .eq("id", contractId);

      if (error) throw error;

      toast({
        title: "Moneda corregida",
        description: "Los datos del contrato fueron actualizados. Los comprobantes históricos no fueron modificados.",
      });
      onOpenChange(false);
      onSuccess();
    } catch (err) {
      console.error("Error correcting currency:", err);
      toast({ title: "Error", description: "No se pudo actualizar el contrato.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="w-4 h-4" />
            Corregir moneda del contrato
          </DialogTitle>
        </DialogHeader>

        <Alert className="border-warning/40 bg-warning/5">
          <AlertTriangle className="h-4 w-4 text-warning" />
          <AlertDescription className="text-sm text-warning-foreground">
            Esta corrección{" "}
            <span className="font-semibold">no afecta comprobantes ya emitidos</span>.
            Solo actualiza el contrato hacia adelante y los comprobantes futuros.
          </AlertDescription>
        </Alert>

        <div className="space-y-4 pt-1">
          {/* Moneda del alquiler */}
          <div className="space-y-1.5">
            <Label>Moneda del alquiler</Label>
            <Select value={currencyRent} onValueChange={setCurrencyRent}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ARS">ARS — Peso argentino ($)</SelectItem>
                <SelectItem value="USD">USD — Dólar estadounidense (US$)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Alquiler actual:{" "}
              <span className="font-medium">
                {currentCurrencyRent === currencyRent
                  ? formatAmount(currentRent, currentCurrencyRent)
                  : formatAmount(currentRent, currencyRent)}
              </span>
            </p>
          </div>

          {/* Override alquiler actual (opcional) */}
          <div className="space-y-1.5">
            <Label htmlFor="override-rent">
              Nuevo monto de alquiler{" "}
              <span className="text-muted-foreground font-normal">(opcional — solo si cambió)</span>
            </Label>
            <Input
              id="override-rent"
              type="number"
              placeholder={String(currentRent)}
              value={overrideRent}
              onChange={(e) => setOverrideRent(e.target.value)}
            />
          </div>

          <div className="border-t border-border" />

          {/* Moneda del depósito */}
          <div className="space-y-1.5">
            <Label>Moneda del depósito</Label>
            <Select value={currencyDeposit} onValueChange={setCurrencyDeposit}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ARS">ARS — Peso argentino ($)</SelectItem>
                <SelectItem value="USD">USD — Dólar estadounidense (US$)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Monto del depósito */}
          <div className="space-y-1.5">
            <Label htmlFor="deposit-amount">
              Monto del depósito{" "}
              <span className="text-muted-foreground font-normal">(opcional)</span>
            </Label>
            <Input
              id="deposit-amount"
              type="number"
              placeholder={currentDeposit != null ? String(currentDeposit) : "Sin depósito"}
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
            />
          </div>

          {/* Preview */}
          {(currencyRent !== currentCurrencyRent || currencyDeposit !== currentCurrencyDeposit) && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-1.5 text-sm">
              <p className="font-medium text-primary">Vista previa de cambios:</p>
              {currencyRent !== currentCurrencyRent && (
                <p>
                  Alquiler:{" "}
                  <span className="line-through text-muted-foreground">{currentCurrencyRent}</span>{" "}
                  → <span className="font-semibold">{currencyRent}</span>
                </p>
              )}
              {currencyDeposit !== currentCurrencyDeposit && (
                <p>
                  Depósito:{" "}
                  <span className="line-through text-muted-foreground">{currentCurrencyDeposit}</span>{" "}
                  → <span className="font-semibold">{currencyDeposit}</span>
                </p>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Guardando..." : "Aplicar corrección"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function formatAmount(amount: number, currency: string) {
  const symbol = currency === "USD" ? "US$" : "$";
  return `${symbol} ${new Intl.NumberFormat("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount)}`;
}
