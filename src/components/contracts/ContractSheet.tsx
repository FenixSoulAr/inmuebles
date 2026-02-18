import { useState } from "react";
import { useTranslation } from "react-i18next";
import { FileText, Pencil, Printer, Copy, Users, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ContractSheetProps {
  contract: {
    id: string;
    start_date: string;
    end_date: string;
    initial_rent: number;
    current_rent: number;
    deposit: number | null;
    currency: string | null;
    currency_deposit: string | null;
    rent_due_day: number;
    adjustment_type: string;
    adjustment_frequency: number | null;
    clauses_text: string | null;
    basic_terms?: string | null;
    properties: { internal_identifier: string; full_address: string };
    tenants: { full_name: string; email: string | null; phone: string | null };
  };
  onUpdate: () => void;
}

const ADJUSTMENT_TYPE_LABELS: Record<string, string> = {
  ipc: "IPC (Índice de Precios al Consumidor)",
  icl: "ICL (Índice de Construcción)",
  fixed: "Porcentaje fijo",
  manual: "Ajuste manual",
  uva: "UVA",
  other: "Otro",
};

export function ContractSheet({ contract, onUpdate }: ContractSheetProps) {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const isEs = i18n.language?.startsWith("es");

  const [editOpen, setEditOpen] = useState(false);
  const [draftOpen, setDraftOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    basic_terms: contract.basic_terms || "",
    clauses_text: contract.clauses_text || "",
    adjustment_type: contract.adjustment_type,
    adjustment_frequency: contract.adjustment_frequency?.toString() || "12",
  });

  const formatDate = (d: string) =>
    new Date(d + "T00:00:00").toLocaleDateString(isEs ? "es-AR" : "en-US", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

  const formatMoney = (amount: number, currency: string) =>
    new Intl.NumberFormat(isEs ? "es-AR" : "en-US", {
      style: "currency",
      currency: currency || "ARS",
      minimumFractionDigits: 0,
    }).format(amount);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("contracts")
        .update({
          basic_terms: formData.basic_terms || null,
          clauses_text: formData.clauses_text || null,
          adjustment_type: formData.adjustment_type,
          adjustment_frequency: formData.adjustment_frequency
            ? parseInt(formData.adjustment_frequency)
            : null,
        })
        .eq("id", contract.id);

      if (error) throw error;
      toast({ title: "Ficha actualizada", description: "Los datos del contrato fueron guardados." });
      setEditOpen(false);
      onUpdate();
    } catch (err) {
      console.error(err);
      toast({ title: "Error", description: "No se pudo guardar.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // Build draft text
  const buildDraft = () => {
    const rentCurr = contract.currency || "ARS";
    const depCurr = contract.currency_deposit || "ARS";
    const adjLabel = ADJUSTMENT_TYPE_LABELS[contract.adjustment_type] || contract.adjustment_type;

    return `CONTRATO DE LOCACIÓN
════════════════════════════════════════════════════════

PARTES

• Locador/Propietario: [Nombre del propietario]
• Locatario/Inquilino: ${contract.tenants.full_name}${contract.tenants.email ? `\n  Email: ${contract.tenants.email}` : ""}${contract.tenants.phone ? `\n  Teléfono: ${contract.tenants.phone}` : ""}

INMUEBLE

• Identificador: ${contract.properties.internal_identifier}
• Domicilio: ${contract.properties.full_address}

PLAZO Y FECHAS

• Inicio del contrato: ${formatDate(contract.start_date)}
• Vencimiento: ${formatDate(contract.end_date)}

CONDICIONES ECONÓMICAS

• Alquiler inicial: ${formatMoney(contract.initial_rent, rentCurr)} (${rentCurr})
• Alquiler actual: ${formatMoney(contract.current_rent, rentCurr)} (${rentCurr})
• Vencimiento del pago: día ${contract.rent_due_day || 5} de cada mes
${contract.deposit != null ? `• Depósito de garantía: ${formatMoney(contract.deposit, depCurr)} (${depCurr})\n` : ""}
ACTUALIZACIÓN / INDEXACIÓN

• Tipo: ${adjLabel}
${contract.adjustment_frequency ? `• Frecuencia: cada ${contract.adjustment_frequency} meses\n` : ""}
${contract.basic_terms ? `CONDICIONES BÁSICAS\n\n${contract.basic_terms}\n` : ""}
${contract.clauses_text ? `CLÁUSULAS ADICIONALES\n\n${contract.clauses_text}\n` : ""}
════════════════════════════════════════════════════════
FIRMAS

Locador: _________________________________   Fecha: ___________

Locatario: _______________________________   Fecha: ___________
`;
  };

  const handleCopyDraft = () => {
    navigator.clipboard.writeText(buildDraft());
    toast({ title: "Copiado", description: "Borrador copiado al portapapeles." });
  };

  const handlePrint = () => {
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<pre style="font-family:monospace;padding:2rem;white-space:pre-wrap">${buildDraft()}</pre>`);
    win.document.close();
    win.print();
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="w-4 h-4" />
              Ficha del contrato
            </CardTitle>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setDraftOpen(true)}>
                <Printer className="w-3.5 h-3.5 mr-1.5" />
                Generar borrador
              </Button>
              <Button size="sm" variant="outline" onClick={() => {
                setFormData({
                  basic_terms: contract.basic_terms || "",
                  clauses_text: contract.clauses_text || "",
                  adjustment_type: contract.adjustment_type,
                  adjustment_frequency: contract.adjustment_frequency?.toString() || "12",
                });
                setEditOpen(true);
              }}>
                <Pencil className="w-3.5 h-3.5 mr-1.5" />
                Editar ficha
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Parties */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border p-3 space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium uppercase tracking-wide">
                <Users className="w-3 h-3" /> Locadores
              </div>
              <p className="text-sm font-medium">[Propietario de la propiedad]</p>
            </div>
            <div className="rounded-lg border p-3 space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium uppercase tracking-wide">
                <User className="w-3 h-3" /> Locatarios
              </div>
              <p className="text-sm font-medium">{contract.tenants.full_name}</p>
              {contract.tenants.email && <p className="text-xs text-muted-foreground">{contract.tenants.email}</p>}
              {contract.tenants.phone && <p className="text-xs text-muted-foreground">{contract.tenants.phone}</p>}
            </div>
          </div>

          {/* Dates & Amounts */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground">Inicio</p>
              <p className="text-sm font-medium">{formatDate(contract.start_date)}</p>
            </div>
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground">Vencimiento</p>
              <p className="text-sm font-medium">{formatDate(contract.end_date)}</p>
            </div>
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground">Vence día</p>
              <p className="text-sm font-medium">Día {contract.rent_due_day || 5} de cada mes</p>
            </div>
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground">Alquiler inicial</p>
              <div className="flex items-center gap-1">
                <p className="text-sm font-medium">{formatMoney(contract.initial_rent, contract.currency || "ARS")}</p>
                <Badge variant="outline" className="text-xs font-mono">{contract.currency || "ARS"}</Badge>
              </div>
            </div>
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground">Alquiler actual</p>
              <div className="flex items-center gap-1">
                <p className="text-sm font-semibold text-primary">{formatMoney(contract.current_rent, contract.currency || "ARS")}</p>
                <Badge variant="outline" className="text-xs font-mono">{contract.currency || "ARS"}</Badge>
              </div>
            </div>
            {contract.deposit != null && (
              <div className="space-y-0.5">
                <p className="text-xs text-muted-foreground">Depósito</p>
                <div className="flex items-center gap-1">
                  <p className="text-sm font-medium">{formatMoney(contract.deposit, contract.currency_deposit || "ARS")}</p>
                  <Badge variant="outline" className="text-xs font-mono">{contract.currency_deposit || "ARS"}</Badge>
                </div>
              </div>
            )}
          </div>

          {/* Indexation */}
          <div className="rounded-lg bg-muted/40 p-3 space-y-1">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Actualización / Indexación</p>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="secondary">
                {ADJUSTMENT_TYPE_LABELS[contract.adjustment_type] || contract.adjustment_type}
              </Badge>
              {contract.adjustment_frequency && (
                <span className="text-sm text-muted-foreground">cada {contract.adjustment_frequency} meses</span>
              )}
            </div>
          </div>

          {/* Basic terms */}
          {contract.basic_terms && (
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Cláusulas básicas</p>
              <p className="text-sm whitespace-pre-wrap rounded-lg border p-3 bg-muted/20">{contract.basic_terms}</p>
            </div>
          )}

          {/* Additional clauses */}
          {contract.clauses_text && (
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Cláusulas adicionales</p>
              <p className="text-sm whitespace-pre-wrap rounded-lg border p-3 bg-muted/20">{contract.clauses_text}</p>
            </div>
          )}

          {!contract.basic_terms && !contract.clauses_text && (
            <p className="text-sm text-muted-foreground italic">
              Sin cláusulas registradas.{" "}
              <button
                className="underline underline-offset-2 hover:text-foreground transition-colors"
                onClick={() => setEditOpen(true)}
              >
                Agregar ahora
              </button>
            </p>
          )}
        </CardContent>
      </Card>

      {/* Edit Modal */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar ficha del contrato</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Tipo de ajuste</Label>
              <Select
                value={formData.adjustment_type}
                onValueChange={(v) => setFormData((p) => ({ ...p, adjustment_type: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ipc">IPC (Índice de Precios al Consumidor)</SelectItem>
                  <SelectItem value="icl">ICL (Índice de Construcción)</SelectItem>
                  <SelectItem value="fixed">Porcentaje fijo</SelectItem>
                  <SelectItem value="uva">UVA</SelectItem>
                  <SelectItem value="manual">Ajuste manual</SelectItem>
                  <SelectItem value="other">Otro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="adj_freq">Frecuencia de ajuste (meses)</Label>
              <Input
                id="adj_freq"
                type="number"
                min="1"
                value={formData.adjustment_frequency}
                onChange={(e) => setFormData((p) => ({ ...p, adjustment_frequency: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="basic_terms">Cláusulas básicas</Label>
              <Textarea
                id="basic_terms"
                rows={4}
                placeholder="Condiciones esenciales del contrato: uso habitacional, prohibición de subarrendar, etc."
                value={formData.basic_terms}
                onChange={(e) => setFormData((p) => ({ ...p, basic_terms: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="clauses_text">Cláusulas adicionales</Label>
              <Textarea
                id="clauses_text"
                rows={5}
                placeholder="Cualquier condición adicional pactada entre las partes..."
                value={formData.clauses_text}
                onChange={(e) => setFormData((p) => ({ ...p, clauses_text: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Guardando..." : "Guardar cambios"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Draft Modal */}
      <Dialog open={draftOpen} onOpenChange={setDraftOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Borrador del contrato</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto">
            <pre className="text-xs font-mono whitespace-pre-wrap bg-muted/30 rounded-lg p-4 border leading-relaxed">
              {buildDraft()}
            </pre>
          </div>
          <DialogFooter className="flex gap-2 pt-4">
            <Button variant="outline" onClick={handleCopyDraft}>
              <Copy className="w-4 h-4 mr-2" />
              Copiar texto
            </Button>
            <Button variant="outline" onClick={handlePrint}>
              <Printer className="w-4 h-4 mr-2" />
              Imprimir
            </Button>
            <Button variant="outline" onClick={() => setDraftOpen(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
