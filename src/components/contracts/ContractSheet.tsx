import { useState } from "react";
import { useTranslation } from "react-i18next";
import { FileText, Pencil, Printer, Copy, Users, User, Download, Shield, CheckSquare, Square } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Separator } from "@/components/ui/separator";

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
    // New fields
    tipo_contrato?: string | null;
    usa_seguro?: boolean | null;
    seguro_tipo?: string | null;
    seguro_obligatorio?: boolean | null;
    expensas_ordinarias?: boolean | null;
    expensas_extraordinarias?: boolean | null;
    impuestos_a_cargo_locatario?: boolean | null;
    permite_subalquiler?: boolean | null;
    permite_mascotas?: boolean | null;
    properties: { internal_identifier: string; full_address: string };
    tenants: { full_name: string; email: string | null; phone: string | null; doc_id?: string | null };
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

const TIPO_CONTRATO_LABELS: Record<string, string> = {
  vivienda: "Vivienda / Habitacional",
  comercial: "Comercial",
  temporal: "Temporal",
};

const SEGURO_TIPO_LABELS: Record<string, string> = {
  incendio: "Seguro contra incendio",
  caucion: "Seguro de caución",
  integral: "Seguro integral de inquilinos",
};

const FREQ_LABELS: Record<number, string> = {
  1: "mensualmente",
  3: "trimestralmente",
  4: "cuatrimestralmente",
  6: "semestralmente",
  12: "anualmente",
};

export function ContractSheet({ contract, onUpdate }: ContractSheetProps) {
  const { i18n } = useTranslation();
  const { toast } = useToast();
  const isEs = i18n.language?.startsWith("es");

  const [editOpen, setEditOpen] = useState(false);
  const [draftOpen, setDraftOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    tipo_contrato: contract.tipo_contrato || "vivienda",
    basic_terms: contract.basic_terms || "",
    clauses_text: contract.clauses_text || "",
    adjustment_type: contract.adjustment_type,
    adjustment_frequency: contract.adjustment_frequency?.toString() || "12",
    usa_seguro: contract.usa_seguro ?? false,
    seguro_tipo: contract.seguro_tipo || "incendio",
    seguro_obligatorio: contract.seguro_obligatorio ?? true,
    expensas_ordinarias: contract.expensas_ordinarias ?? true,
    expensas_extraordinarias: contract.expensas_extraordinarias ?? false,
    impuestos_a_cargo_locatario: contract.impuestos_a_cargo_locatario ?? false,
    permite_subalquiler: contract.permite_subalquiler ?? false,
    permite_mascotas: contract.permite_mascotas ?? false,
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
          tipo_contrato: formData.tipo_contrato,
          basic_terms: formData.basic_terms || null,
          clauses_text: formData.clauses_text || null,
          adjustment_type: formData.adjustment_type,
          adjustment_frequency: formData.adjustment_frequency
            ? parseInt(formData.adjustment_frequency)
            : null,
          usa_seguro: formData.usa_seguro,
          seguro_tipo: formData.usa_seguro ? formData.seguro_tipo : null,
          seguro_obligatorio: formData.usa_seguro ? formData.seguro_obligatorio : null,
          expensas_ordinarias: formData.expensas_ordinarias,
          expensas_extraordinarias: formData.expensas_extraordinarias,
          impuestos_a_cargo_locatario: formData.impuestos_a_cargo_locatario,
          permite_subalquiler: formData.permite_subalquiler,
          permite_mascotas: formData.permite_mascotas,
        } as any)
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

  // ──────────────────────────────────────────────────────────────────────────
  // Helpers
  // ──────────────────────────────────────────────────────────────────────────
  const numberToWords = (n: number): string => {
    const words: Record<number, string> = {
      1: "uno", 2: "dos", 3: "tres", 4: "cuatro", 5: "cinco",
      6: "seis", 7: "siete", 8: "ocho", 9: "nueve", 10: "diez",
      15: "quince", 20: "veinte", 25: "veinticinco", 28: "veintiocho",
    };
    return words[n] || n.toString();
  };

  // ──────────────────────────────────────────────────────────────────────────
  // Professional legal contract text builder
  // ──────────────────────────────────────────────────────────────────────────
  const buildDraft = () => {
    const rentCurr = contract.currency || "ARS";
    const depCurr = contract.currency_deposit || "ARS";
    const adjLabel = ADJUSTMENT_TYPE_LABELS[contract.adjustment_type] || contract.adjustment_type;
    const freqLabel = FREQ_LABELS[contract.adjustment_frequency || 12] || `cada ${contract.adjustment_frequency} meses`;
    const tipoLabel = TIPO_CONTRATO_LABELS[contract.tipo_contrato || "vivienda"] || "Vivienda";
    const today = new Date().toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" });

    const expOrd = contract.expensas_ordinarias ?? true;
    const expExt = contract.expensas_extraordinarias ?? false;
    const impLocatario = contract.impuestos_a_cargo_locatario ?? false;
    const subalquiler = contract.permite_subalquiler ?? false;
    const mascotas = contract.permite_mascotas ?? false;
    const usaSeguro = contract.usa_seguro ?? false;
    const segTipo = contract.seguro_tipo ? (SEGURO_TIPO_LABELS[contract.seguro_tipo] || contract.seguro_tipo) : "Seguro de caución";
    const segOblig = contract.seguro_obligatorio ?? true;

    return `═══════════════════════════════════════════════════════════
                    CONTRATO DE LOCACIÓN
═══════════════════════════════════════════════════════════

En la ciudad de _________________, a los ${today}, entre las partes que se identifican a continuación, se celebra el presente CONTRATO DE LOCACIÓN, sujeto a las disposiciones del Código Civil y Comercial de la Nación Argentina (Ley 26.994) y sus modificatorias.

───────────────────────────────────────────────────────────
PARTES CONTRATANTES
───────────────────────────────────────────────────────────

LOCADOR (Propietario):
  Nombre: ________________________________________________
  DNI / CUIT: ____________________________________________
  Domicilio real: ________________________________________
  Domicilio constituido: _________________________________

LOCATARIO (Inquilino):
  Nombre: ${contract.tenants.full_name}
  DNI / CUIT: ${(contract.tenants as any).doc_id || "________________________"}
  Domicilio real: ________________________________________
  Domicilio constituido: ${contract.properties.full_address}
${contract.tenants.email ? `  Email: ${contract.tenants.email}` : ""}
${contract.tenants.phone ? `  Teléfono: ${contract.tenants.phone}` : ""}

───────────────────────────────────────────────────────────
CLÁUSULA 1ª — OBJETO DEL CONTRATO
───────────────────────────────────────────────────────────

El LOCADOR da en locación al LOCATARIO el inmueble ubicado en:

  Domicilio: ${contract.properties.full_address}
  Identificador interno: ${contract.properties.internal_identifier}

En el estado en que se encuentra, habiéndolo visitado y aceptado el LOCATARIO, quien declara conocerlo.

───────────────────────────────────────────────────────────
CLÁUSULA 2ª — DESTINO
───────────────────────────────────────────────────────────

El inmueble se destina exclusivamente para uso: ${tipoLabel}.

Queda expresamente ${subalquiler ? "PERMITIDO el subalquiler con autorización escrita previa del LOCADOR" : "PROHIBIDO subalquilar, ceder o transferir el presente contrato"}, total o parcialmente, sin autorización expresa y escrita del LOCADOR.

El LOCATARIO ${mascotas ? "podrá tener mascotas domésticas, siendo responsable de cualquier daño ocasionado" : "NO podrá tener mascotas en el inmueble"}.

───────────────────────────────────────────────────────────
CLÁUSULA 3ª — PLAZO
───────────────────────────────────────────────────────────

El plazo del presente contrato es de _______ (___) años, con vigencia:

  Inicio: ${formatDate(contract.start_date)}
  Vencimiento: ${formatDate(contract.end_date)}

Vencido el plazo, el LOCATARIO deberá restituir el inmueble sin necesidad de interpelación previa. En caso de continuar en el uso del inmueble, se entenderá como renovación tácita mes a mes.

───────────────────────────────────────────────────────────
CLÁUSULA 4ª — PRECIO DEL ALQUILER
───────────────────────────────────────────────────────────

El precio de la locación se fija en la suma de:

  ${formatMoney(contract.initial_rent, rentCurr)} (${rentCurr}) mensuales.

El canon locativo deberá abonarse por mes adelantado, dentro de los primeros ${contract.rent_due_day || 5} (${numberToWords(contract.rent_due_day || 5)}) días de cada mes.

El pago se realizará mediante transferencia bancaria o el medio acordado entre las partes.

───────────────────────────────────────────────────────────
CLÁUSULA 5ª — ACTUALIZACIÓN DEL PRECIO
───────────────────────────────────────────────────────────

El precio del alquiler se actualizará ${freqLabel}, de conformidad con el índice:

  ${adjLabel}

Cada actualización será notificada al LOCATARIO con una antelación de 15 (quince) días hábiles. El precio actualizado reemplaza al anterior y se aplicará a partir del período siguiente a la notificación.

───────────────────────────────────────────────────────────
CLÁUSULA 6ª — DEPÓSITO DE GARANTÍA
───────────────────────────────────────────────────────────

${contract.deposit != null
  ? `En concepto de depósito de garantía, el LOCATARIO entrega al LOCADOR la suma de:

  ${formatMoney(contract.deposit, depCurr)} (${depCurr})

equivalente a _____ (___) meses de alquiler, en carácter de garantía por el fiel cumplimiento de las obligaciones asumidas. Dicha suma será devuelta al LOCATARIO dentro de los 30 días de la restitución del inmueble, deduciéndose los montos que correspondan por daños, deudas o incumplimientos.`
  : `Las partes podrán acordar depósito de garantía en instrumento separado.`}

───────────────────────────────────────────────────────────
CLÁUSULA 7ª — EXPENSAS Y GASTOS
───────────────────────────────────────────────────────────

  • Expensas ordinarias: a cargo del ${expOrd ? "LOCATARIO" : "LOCADOR"}
  • Expensas extraordinarias: a cargo del ${expExt ? "LOCATARIO" : "LOCADOR"}
  • Impuestos que afecten al inmueble (ABL, rentas, etc.): a cargo del ${impLocatario ? "LOCATARIO" : "LOCADOR"}
  • Servicios básicos (luz, gas, agua, internet): a cargo del LOCATARIO
  • Mantenimiento de artefactos e instalaciones menores: a cargo del LOCATARIO

───────────────────────────────────────────────────────────
CLÁUSULA 8ª — SEGURO
───────────────────────────────────────────────────────────

${usaSeguro
  ? `El LOCATARIO deberá contratar y mantener vigente durante toda la duración del contrato un seguro del tipo:

  ${segTipo}

El seguro deberá endosarse a nombre del LOCADOR y presentarse póliza al inicio y en cada renovación. La contratación de dicho seguro es ${segOblig ? "OBLIGATORIA y condición esencial del contrato" : "recomendada"}.

En caso de no renovar el seguro en término, el LOCADOR podrá contratarlo por cuenta del LOCATARIO, debitándose el costo del canon locativo.`
  : `Las partes podrán acordar la contratación de seguros en instrumento separado.`}

───────────────────────────────────────────────────────────
CLÁUSULA 9ª — CONSERVACIÓN DEL INMUEBLE
───────────────────────────────────────────────────────────

El LOCATARIO deberá:

  a) Usar el inmueble en forma ordenada y conforme a su destino;
  b) Conservarlo en buen estado, realizando las reparaciones locativas que correspondan;
  c) Comunicar al LOCADOR cualquier deterioro o daño significativo dentro de las 48 horas de conocerlo;
  d) Permitir el acceso al LOCADOR para inspecciones, con previo aviso de 48 horas;
  e) No realizar modificaciones sin autorización escrita del LOCADOR.

───────────────────────────────────────────────────────────
CLÁUSULA 10ª — MORA Y PENALIDADES
───────────────────────────────────────────────────────────

La mora del LOCATARIO operará en forma automática, sin necesidad de interpelación judicial ni extrajudicial, a partir del día siguiente al vencimiento del plazo de pago pactado en la Cláusula 4ª.

El incumplimiento en el pago de dos o más períodos consecutivos dará derecho al LOCADOR a solicitar la rescisión del contrato y el desalojo del inmueble, sin perjuicio de reclamar los montos adeudados.

───────────────────────────────────────────────────────────
CLÁUSULA 11ª — RESTITUCIÓN DEL INMUEBLE
───────────────────────────────────────────────────────────

Al vencimiento del contrato, o ante cualquier causa que lo extinga, el LOCATARIO deberá:

  a) Desalojar el inmueble y restituirlo al LOCADOR en el mismo estado en que lo recibió;
  b) Entregar la totalidad de llaves, tarjetas de acceso y dispositivos de seguridad;
  c) Cancelar todos los servicios a su nombre;
  d) Saldar deudas pendientes de expensas, impuestos y servicios.

───────────────────────────────────────────────────────────
CLÁUSULA 12ª — GARANTÍA
───────────────────────────────────────────────────────────

Las partes podrán acordar garantía personal (fiadores solidarios) o garantía real (seguro de caución), en instrumento separado que forma parte integrante del presente contrato.

───────────────────────────────────────────────────────────
CLÁUSULA 13ª — RESCISIÓN ANTICIPADA
───────────────────────────────────────────────────────────

El LOCATARIO podrá rescindir el contrato en cualquier momento, notificando al LOCADOR con 60 (sesenta) días de antelación. Si la rescisión opera antes de transcurrido el primer año, corresponde el pago de la indemnización prevista en el art. 1221 del CCyCN.

───────────────────────────────────────────────────────────
CLÁUSULA 14ª — JURISDICCIÓN
───────────────────────────────────────────────────────────

Para todos los efectos legales derivados del presente contrato, las partes se someten expresamente a la jurisdicción de los Tribunales Ordinarios competentes, renunciando a cualquier otro fuero que pudiera corresponderles.

${contract.basic_terms ? `───────────────────────────────────────────────────────────
CLÁUSULA 15ª — CONDICIONES BÁSICAS PACTADAS
───────────────────────────────────────────────────────────

${contract.basic_terms}

` : ""}${contract.clauses_text ? `───────────────────────────────────────────────────────────
CLÁUSULA ADICIONAL — CONDICIONES ESPECIALES
───────────────────────────────────────────────────────────

${contract.clauses_text}

` : ""}═══════════════════════════════════════════════════════════
FIRMAS
═══════════════════════════════════════════════════════════

Leído el presente contrato y conformes con su contenido, las partes lo firman en señal de conformidad.


LOCADOR:                              LOCATARIO:

_____________________________         _____________________________
Nombre:                               Nombre: ${contract.tenants.full_name}
DNI:                                  DNI: ${(contract.tenants as any).doc_id || "___________"}
Fecha: ___________________            Fecha: ___________________


${contract.permite_subalquiler === false ? "" : `FIADOR/GARANTE:

_____________________________
Nombre:
DNI:
Fecha: ___________________

`}═══════════════════════════════════════════════════════════
Contrato generado el ${today} — ${contract.properties.internal_identifier}
═══════════════════════════════════════════════════════════`;
  };


  const handleCopyDraft = () => {
    navigator.clipboard.writeText(buildDraft());
    toast({ title: "Copiado", description: "Contrato copiado al portapapeles." });
  };

  const handlePrint = () => {
    const win = window.open("", "_blank");
    if (!win) return;
    const text = buildDraft().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    win.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Contrato de Locación — ${contract.properties.internal_identifier}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: "Courier New", Courier, monospace; font-size: 11px; line-height: 1.6; padding: 2.5cm 2cm; color: #111; background: #fff; }
    pre { white-space: pre-wrap; word-wrap: break-word; }
    @media print {
      body { padding: 1.5cm; }
      @page { margin: 2cm; size: A4; }
    }
  </style>
</head>
<body><pre>${text}</pre></body>
</html>`);
    win.document.close();
    win.focus();
    win.print();
  };

  const handleSaveText = async () => {
    try {
      const texto = buildDraft();
      await supabase.from("contracts").update({ texto_contrato: texto } as any).eq("id", contract.id);
      toast({ title: "Guardado", description: "Texto del contrato guardado en el registro." });
    } catch {
      toast({ title: "Error", description: "No se pudo guardar el texto.", variant: "destructive" });
    }
  };

  const BoolRow = ({ label, value }: { label: string; value: boolean }) => (
    <div className="flex items-center gap-2 text-sm">
      {value
        ? <CheckSquare className="w-4 h-4 text-primary shrink-0" />
        : <Square className="w-4 h-4 text-muted-foreground shrink-0" />}
      <span className={value ? "text-foreground" : "text-muted-foreground"}>{label}</span>
    </div>
  );

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="w-4 h-4" />
              Ficha del contrato
            </CardTitle>
            <div className="flex gap-2 flex-wrap justify-end">
              <Button size="sm" variant="outline" onClick={() => setDraftOpen(true)}>
                <Printer className="w-3.5 h-3.5 mr-1.5" />
                Generar contrato
              </Button>
              <Button size="sm" variant="outline" onClick={() => {
                setFormData({
                  tipo_contrato: contract.tipo_contrato || "vivienda",
                  basic_terms: contract.basic_terms || "",
                  clauses_text: contract.clauses_text || "",
                  adjustment_type: contract.adjustment_type,
                  adjustment_frequency: contract.adjustment_frequency?.toString() || "12",
                  usa_seguro: contract.usa_seguro ?? false,
                  seguro_tipo: contract.seguro_tipo || "incendio",
                  seguro_obligatorio: contract.seguro_obligatorio ?? true,
                  expensas_ordinarias: contract.expensas_ordinarias ?? true,
                  expensas_extraordinarias: contract.expensas_extraordinarias ?? false,
                  impuestos_a_cargo_locatario: contract.impuestos_a_cargo_locatario ?? false,
                  permite_subalquiler: contract.permite_subalquiler ?? false,
                  permite_mascotas: contract.permite_mascotas ?? false,
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

          {/* Tipo contrato + Dates + Amounts */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground">Tipo de contrato</p>
              <Badge variant="secondary">{TIPO_CONTRATO_LABELS[contract.tipo_contrato || "vivienda"] || "Vivienda"}</Badge>
            </div>
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
                <span className="text-sm text-muted-foreground">
                  {FREQ_LABELS[contract.adjustment_frequency] || `cada ${contract.adjustment_frequency} meses`}
                </span>
              )}
            </div>
          </div>

          {/* Conditions grid */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border p-3 space-y-2">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Gastos y expensas</p>
              <BoolRow label="Expensas ordinarias a cargo del inquilino" value={contract.expensas_ordinarias ?? true} />
              <BoolRow label="Expensas extraordinarias a cargo del inquilino" value={contract.expensas_extraordinarias ?? false} />
              <BoolRow label="Impuestos a cargo del inquilino" value={contract.impuestos_a_cargo_locatario ?? false} />
            </div>
            <div className="rounded-lg border p-3 space-y-2">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Condiciones</p>
              <BoolRow label="Permite subalquiler" value={contract.permite_subalquiler ?? false} />
              <BoolRow label="Permite mascotas" value={contract.permite_mascotas ?? false} />
              {(contract.usa_seguro) && (
                <div className="flex items-center gap-2 text-sm pt-1 border-t mt-1">
                  <Shield className="w-4 h-4 text-primary shrink-0" />
                  <span className="text-foreground">
                    {SEGURO_TIPO_LABELS[contract.seguro_tipo || ""] || "Seguro"}{contract.seguro_obligatorio ? " (obligatorio)" : ""}
                  </span>
                </div>
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

      {/* ── EDIT MODAL ──────────────────────────────────────────────── */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar ficha del contrato</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-2">

            {/* Sección 1: Tipo */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Tipo de contrato</h3>
              <div className="space-y-2">
                <Label>Tipo de contrato</Label>
                <Select
                  value={formData.tipo_contrato}
                  onValueChange={(v) => setFormData((p) => ({ ...p, tipo_contrato: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="vivienda">Vivienda / Habitacional</SelectItem>
                    <SelectItem value="comercial">Comercial</SelectItem>
                    <SelectItem value="temporal">Temporal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            {/* Sección 2: Indexación */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Actualización</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Índice de actualización</Label>
                  <Select
                    value={formData.adjustment_type}
                    onValueChange={(v) => setFormData((p) => ({ ...p, adjustment_type: v }))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ipc">IPC (Índice de Precios al Consumidor)</SelectItem>
                      <SelectItem value="icl">ICL (Índice de Construcción)</SelectItem>
                      <SelectItem value="uva">UVA</SelectItem>
                      <SelectItem value="fixed">Porcentaje fijo</SelectItem>
                      <SelectItem value="manual">Ajuste manual</SelectItem>
                      <SelectItem value="other">Otro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Frecuencia (meses)</Label>
                  <Select
                    value={formData.adjustment_frequency}
                    onValueChange={(v) => setFormData((p) => ({ ...p, adjustment_frequency: v }))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Mensual</SelectItem>
                      <SelectItem value="3">Trimestral</SelectItem>
                      <SelectItem value="4">Cuatrimestral</SelectItem>
                      <SelectItem value="6">Semestral</SelectItem>
                      <SelectItem value="12">Anual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <Separator />

            {/* Sección 3: Seguro */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <Shield className="w-4 h-4" /> Seguro
              </h3>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="usa_seguro"
                  checked={formData.usa_seguro}
                  onCheckedChange={(v) => setFormData((p) => ({ ...p, usa_seguro: !!v }))}
                />
                <Label htmlFor="usa_seguro">El contrato requiere seguro</Label>
              </div>
              {formData.usa_seguro && (
                <div className="grid gap-4 sm:grid-cols-2 pl-6">
                  <div className="space-y-2">
                    <Label>Tipo de seguro</Label>
                    <Select
                      value={formData.seguro_tipo}
                      onValueChange={(v) => setFormData((p) => ({ ...p, seguro_tipo: v }))}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="incendio">Seguro contra incendio</SelectItem>
                        <SelectItem value="caucion">Seguro de caución</SelectItem>
                        <SelectItem value="integral">Seguro integral de inquilinos</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2 pt-7">
                    <Checkbox
                      id="seguro_obligatorio"
                      checked={formData.seguro_obligatorio}
                      onCheckedChange={(v) => setFormData((p) => ({ ...p, seguro_obligatorio: !!v }))}
                    />
                    <Label htmlFor="seguro_obligatorio">Obligatorio</Label>
                  </div>
                </div>
              )}
            </div>

            <Separator />

            {/* Sección 4: Condiciones */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Condiciones</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  { key: "expensas_ordinarias", label: "Expensas ordinarias a cargo del inquilino" },
                  { key: "expensas_extraordinarias", label: "Expensas extraordinarias a cargo del inquilino" },
                  { key: "impuestos_a_cargo_locatario", label: "Impuestos a cargo del inquilino" },
                  { key: "permite_subalquiler", label: "Permite subalquiler" },
                  { key: "permite_mascotas", label: "Permite mascotas" },
                ].map(({ key, label }) => (
                  <div key={key} className="flex items-center gap-2">
                    <Checkbox
                      id={key}
                      checked={formData[key as keyof typeof formData] as boolean}
                      onCheckedChange={(v) => setFormData((p) => ({ ...p, [key]: !!v }))}
                    />
                    <Label htmlFor={key}>{label}</Label>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* Cláusulas */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Cláusulas</h3>
              <div className="space-y-2">
                <Label htmlFor="basic_terms">Cláusulas básicas</Label>
                <Textarea
                  id="basic_terms"
                  rows={4}
                  placeholder="Condiciones esenciales pactadas: uso habitacional, prohibición de subarrendar, etc."
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
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Guardando..." : "Guardar cambios"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── DRAFT MODAL ─────────────────────────────────────────────── */}
      <Dialog open={draftOpen} onOpenChange={setDraftOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Contrato de Locación — {contract.properties.internal_identifier}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto rounded-lg border bg-muted/20">
            <pre className="text-xs font-mono whitespace-pre-wrap p-5 leading-relaxed text-foreground">
              {buildDraft()}
            </pre>
          </div>
          <DialogFooter className="flex flex-wrap gap-2 pt-4">
            <Button variant="outline" size="sm" onClick={handleCopyDraft}>
              <Copy className="w-4 h-4 mr-1.5" />
              Copiar texto
            </Button>
            <Button variant="outline" size="sm" onClick={handleSaveText}>
              <Download className="w-4 h-4 mr-1.5" />
              Guardar en registro
            </Button>
            <Button size="sm" onClick={handlePrint}>
              <Printer className="w-4 h-4 mr-1.5" />
              Imprimir / Exportar PDF
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setDraftOpen(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
