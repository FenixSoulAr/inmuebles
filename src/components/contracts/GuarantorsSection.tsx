import { useState } from "react";
import { Plus, Trash2, ShieldCheck, User, Building2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";

export interface GuarantorEntry {
  /** client-side key */
  _key: string;
  guarantee_type: "fiador_solidario" | "garantia_propietaria" | "seguro_caucion";
  // Common
  full_name: string;
  document_or_cuit: string;
  address: string;
  phone: string;
  email: string;
  notes: string;
  // seguro_caucion specific
  company_name: string;
  insurance_policy_number: string;
  coverage_amount: string;
  insurance_valid_from: string;
  insurance_valid_to: string;
  // garantia_propietaria specific
  matricula: string;
}

function newEntry(): GuarantorEntry {
  return {
    _key: crypto.randomUUID(),
    guarantee_type: "fiador_solidario",
    full_name: "",
    document_or_cuit: "",
    address: "",
    phone: "",
    email: "",
    notes: "",
    company_name: "",
    insurance_policy_number: "",
    coverage_amount: "",
    insurance_valid_from: "",
    insurance_valid_to: "",
    matricula: "",
  };
}

const TYPE_LABELS: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  fiador_solidario: { label: "Fiador solidario", icon: User, color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" },
  garantia_propietaria: { label: "Garantía propietaria", icon: Building2, color: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300" },
  seguro_caucion: { label: "Seguro de caución", icon: ShieldCheck, color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" },
};

interface GuarantorsSectionProps {
  value: GuarantorEntry[];
  onChange: (entries: GuarantorEntry[]) => void;
}

function GuarantorCard({
  entry,
  onUpdate,
  onRemove,
}: {
  entry: GuarantorEntry;
  onUpdate: (patch: Partial<GuarantorEntry>) => void;
  onRemove: () => void;
}) {
  const meta = TYPE_LABELS[entry.guarantee_type];
  const Icon = meta.icon;
  const isCaucion = entry.guarantee_type === "seguro_caucion";
  const isPropietaria = entry.guarantee_type === "garantia_propietaria";
  const isFiador = entry.guarantee_type === "fiador_solidario";

  return (
    <div className="border border-border rounded-lg p-4 space-y-4 bg-card">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-muted-foreground" />
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${meta.color}`}>
            {meta.label}
          </span>
        </div>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-7 w-7 text-destructive hover:text-destructive"
          onClick={onRemove}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Guarantee type selector */}
      <div className="space-y-1.5">
        <Label className="text-xs">Tipo de garantía</Label>
        <Select
          value={entry.guarantee_type}
          onValueChange={(v) => onUpdate({ guarantee_type: v as GuarantorEntry["guarantee_type"] })}
        >
          <SelectTrigger className="h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="fiador_solidario">👤 Fiador solidario / liso llano pagador</SelectItem>
            <SelectItem value="garantia_propietaria">🏠 Garantía propietaria (inmueble)</SelectItem>
            <SelectItem value="seguro_caucion">🛡 Seguro de caución</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* seguro_caucion fields */}
      {isCaucion && (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Aseguradora / Compañía *</Label>
              <Input
                className="h-9"
                placeholder="Ej: Fianzas y Crédito S.A."
                value={entry.company_name}
                onChange={(e) => onUpdate({ company_name: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">N° de póliza</Label>
              <Input
                className="h-9"
                placeholder="Ej: POL-2024-001234"
                value={entry.insurance_policy_number}
                onChange={(e) => onUpdate({ insurance_policy_number: e.target.value })}
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Cobertura (ARS)</Label>
              <Input
                className="h-9"
                type="number"
                min="0"
                placeholder="0"
                value={entry.coverage_amount}
                onChange={(e) => onUpdate({ coverage_amount: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Vigencia desde</Label>
              <Input
                className="h-9"
                type="date"
                value={entry.insurance_valid_from}
                onChange={(e) => onUpdate({ insurance_valid_from: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Vigencia hasta</Label>
              <Input
                className="h-9"
                type="date"
                value={entry.insurance_valid_to}
                onChange={(e) => onUpdate({ insurance_valid_to: e.target.value })}
              />
            </div>
          </div>
        </>
      )}

      {/* garantia_propietaria fields */}
      {isPropietaria && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs">Dirección del inmueble en garantía</Label>
            <Input
              className="h-9"
              placeholder="Calle y número, localidad, provincia"
              value={entry.address}
              onChange={(e) => onUpdate({ address: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Matrícula / Folio Real</Label>
            <Input
              className="h-9"
              placeholder="Ej: 15-1234/5"
              value={entry.matricula}
              onChange={(e) => onUpdate({ matricula: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Titular (nombre)</Label>
            <Input
              className="h-9"
              placeholder="Nombre del titular del inmueble"
              value={entry.full_name}
              onChange={(e) => onUpdate({ full_name: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">DNI / CUIT titular</Label>
            <Input
              className="h-9"
              placeholder="20-12345678-9"
              value={entry.document_or_cuit}
              onChange={(e) => onUpdate({ document_or_cuit: e.target.value })}
            />
          </div>
        </div>
      )}

      {/* fiador_solidario fields */}
      {isFiador && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Nombre completo *</Label>
            <Input
              className="h-9"
              placeholder="Ej: María López"
              value={entry.full_name}
              onChange={(e) => onUpdate({ full_name: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">DNI / CUIT</Label>
            <Input
              className="h-9"
              placeholder="20-12345678-9"
              value={entry.document_or_cuit}
              onChange={(e) => onUpdate({ document_or_cuit: e.target.value })}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs">Domicilio real</Label>
            <Input
              className="h-9"
              placeholder="Calle 123, CABA"
              value={entry.address}
              onChange={(e) => onUpdate({ address: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Teléfono</Label>
            <Input
              className="h-9"
              placeholder="+54 11 1234-5678"
              value={entry.phone}
              onChange={(e) => onUpdate({ phone: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Email</Label>
            <Input
              className="h-9"
              type="email"
              placeholder="email@ejemplo.com"
              value={entry.email}
              onChange={(e) => onUpdate({ email: e.target.value })}
            />
          </div>
        </div>
      )}

      {/* Notes — all types */}
      <div className="space-y-1.5">
        <Label className="text-xs">Observaciones (opcional)</Label>
        <Textarea
          className="text-xs resize-none"
          rows={2}
          placeholder="Notas adicionales sobre esta garantía…"
          value={entry.notes}
          onChange={(e) => onUpdate({ notes: e.target.value })}
        />
      </div>
    </div>
  );
}

export function GuarantorsSection({ value, onChange }: GuarantorsSectionProps) {
  const addEntry = () => onChange([...value, newEntry()]);

  const removeEntry = (key: string) =>
    onChange(value.filter((e) => e._key !== key));

  const updateEntry = (key: string, patch: Partial<GuarantorEntry>) =>
    onChange(value.map((e) => (e._key === key ? { ...e, ...patch } : e)));

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="w-4 h-4" />
            Garantías del contrato
            {value.length > 0 && (
              <Badge variant="secondary" className="text-xs">{value.length}</Badge>
            )}
          </CardTitle>
          <Button type="button" size="sm" variant="outline" onClick={addEntry}>
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Agregar garantía
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {value.length === 0 ? (
          <div className="text-center py-6 border-2 border-dashed border-border rounded-lg">
            <ShieldCheck className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Sin garantías agregadas</p>
            <p className="text-xs text-muted-foreground mt-1">
              Podés agregar fiadores, garantías propietarias o seguros de caución.
            </p>
            <Button type="button" size="sm" variant="outline" className="mt-3" onClick={addEntry}>
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              Agregar garantía
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {value.map((entry, idx) => (
              <div key={entry._key}>
                {idx > 0 && <Separator />}
                <div className={idx > 0 ? "pt-4" : ""}>
                  <GuarantorCard
                    entry={entry}
                    onUpdate={(patch) => updateEntry(entry._key, patch)}
                    onRemove={() => removeEntry(entry._key)}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
