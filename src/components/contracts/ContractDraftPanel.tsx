import { useState, useEffect, useCallback } from "react";
import {
  FileText, Wand2, RefreshCw, Save, Copy, ChevronUp, ChevronDown,
  Loader2, CheckCheck, Info, AlertTriangle
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ClauseTemplate {
  id: string;
  name: string;
  applies_to: string;
  is_optional: boolean;
  default_enabled: boolean;
  template_text: string;
  order_default: number;
  version: number;
  is_active: boolean;
}

interface ContractClause {
  id: string;
  clause_template_id: string | null;
  title: string;
  rendered_text: string;
  order_position: number;
  enabled: boolean;
  source_version: number | null;
}

export interface ContractForDraft {
  id: string;
  tipo_contrato?: string | null;
  start_date: string;
  end_date: string;
  current_rent: number;
  currency?: string | null;
  price_mode?: string | null;
  deposit?: number | null;
  draft_text?: string | null;
  draft_last_generated_at?: string | null;
  draft_status?: string | null;
  has_price_update?: boolean | null;
  adjustment_type?: string | null;
  adjustment_frequency?: number | null;
  booking_channel?: string | null;
  deposit_mode?: string | null;
  properties: { internal_identifier: string; full_address: string };
  tenants: { full_name: string };
  owners?: Array<{ full_name: string }>;
}

interface SelectedClause {
  templateId: string;
  title: string;
  enabled: boolean;
  order: number;
  text: string;
  version: number;
}

interface Props {
  contract: ContractForDraft;
  onSaved?: () => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const BOOKING_CHANNEL_LABELS: Record<string, string> = {
  directo: "Directo",
  airbnb: "Airbnb",
  booking: "Booking.com",
  otro: "Otra plataforma",
};

const PRICE_MODE_LABELS: Record<string, string> = {
  mensual: "mensual",
  diario: "por día",
  semanal: "semanal",
  total_estadia: "total de estadía",
};

const ADJUSTMENT_TYPE_LABELS: Record<string, string> = {
  ipc: "IPC (Índice de Precios al Consumidor)",
  icl: "ICL (Índice de Contratos de Locación)",
  fixed: "Porcentaje fijo pactado",
  manual: "Actualización acordada entre partes",
};

function fmtDate(d: string): string {
  try {
    return format(new Date(d + "T00:00:00"), "d 'de' MMMM 'de' yyyy", { locale: es });
  } catch {
    return d;
  }
}

function fmtCurrency(n: number, currency: string): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
  }).format(n);
}

// Clause names that relate to price updates — excluded for temporario
const PRICE_UPDATE_CLAUSE_KEYWORDS = ["actualizaci", "indexaci", "ajuste de precio", "precio period"];

function isPriceUpdateClause(name: string): boolean {
  const lower = name.toLowerCase();
  return PRICE_UPDATE_CLAUSE_KEYWORDS.some(kw => lower.includes(kw));
}

function renderTemplate(
  template: string,
  contract: ContractForDraft,
  servicesList: string
): string {
  const currency = contract.currency || "ARS";
  const priceMode = PRICE_MODE_LABELS[contract.price_mode || "mensual"] || contract.price_mode || "mensual";
  const ownerName = contract.owners?.map(o => o.full_name).join(" / ") || "__________";
  const freqMonths = contract.adjustment_frequency ?? null;
  const updateFrequency = freqMonths
    ? freqMonths === 1 ? "mensual"
    : freqMonths === 3 ? "trimestral"
    : freqMonths === 6 ? "semestral"
    : freqMonths === 12 ? "anual"
    : `cada ${freqMonths} meses`
    : "__________";
  const updateIndex = ADJUSTMENT_TYPE_LABELS[contract.adjustment_type || ""] || "__________";
  const bookingChannelLabel = BOOKING_CHANNEL_LABELS[contract.booking_channel || "directo"] || contract.booking_channel || "__________";

  const vars: Record<string, string> = {
    "{{owner_name}}": ownerName,
    "{{tenant_name}}": contract.tenants.full_name || "__________",
    "{{property_address}}": contract.properties.full_address || "__________",
    "{{start_date}}": fmtDate(contract.start_date),
    "{{end_date}}": fmtDate(contract.end_date),
    "{{base_price}}": contract.current_rent != null ? fmtCurrency(contract.current_rent, currency) : "__________",
    "{{currency}}": currency,
    "{{price_mode}}": priceMode,
    "{{deposit_value}}": contract.deposit != null ? fmtCurrency(contract.deposit, currency) : "__________",
    "{{services_list}}": servicesList || "__________",
    "{{update_frequency}}": updateFrequency,
    "{{update_index}}": updateIndex,
    "{{booking_channel}}": bookingChannelLabel,
  };

  let result = template;
  for (const [key, val] of Object.entries(vars)) {
    result = result.split(key).join(val);
  }
  // Replace any remaining {{...}} with blanks
  result = result.replace(/\{\{[^}]+\}\}/g, "__________");
  return result;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ContractDraftPanel({ contract, onSaved }: Props) {
  const [availableTemplates, setAvailableTemplates] = useState<ClauseTemplate[]>([]);
  const [selectedClauses, setSelectedClauses] = useState<SelectedClause[]>([]);
  const [draftText, setDraftText] = useState(contract.draft_text || "");
  const [draftStatus, setDraftStatus] = useState(contract.draft_status || "no_generado");
  const [draftGeneratedAt, setDraftGeneratedAt] = useState(contract.draft_last_generated_at || null);
  const [servicesIncluded, setServicesIncluded] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const tipoContrato = contract.tipo_contrato || "permanente";
  const isTemporario = tipoContrato === "temporario";
  const hasPriceUpdate = contract.has_price_update === true;
  const depositMode = contract.deposit_mode || "required";
  const depositRequired = depositMode === "required";
  const isPlatformCovered = depositMode === "platform_covered";

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Load clause templates matching this contract type
      const { data: templates } = await (supabase as any)
        .from("clause_templates")
        .select("*")
        .eq("owner_user_id", user!.id)
        .eq("is_active", true)
        .or(`applies_to.eq.todos,applies_to.eq.${tipoContrato}`)
        .order("order_default");

      // Load existing contract_clauses snapshot
      const { data: clauses } = await (supabase as any)
        .from("contract_clauses")
        .select("*")
        .eq("contract_id", contract.id)
        .order("order_position");

      // Load services for {{services_list}}
      const { data: services } = await (supabase as any)
        .from("contract_services")
        .select("service_type")
        .eq("contract_id", contract.id)
        .eq("active", true);

      const serviceNames: string[] = (services || []).map((s: any) => s.service_type);
      setServicesIncluded(serviceNames);

      // Filter templates:
      // - temporario: exclude price-update clauses
      // - permanente without has_price_update: exclude price-update clauses
      // - deposit clause excluded if deposit_mode != required
      // - platform_covered clause only if deposit_mode = platform_covered
      const isDepositClause = (name: string) => {
        const l = name.toLowerCase();
        return l.includes("depósito") || l.includes("deposito") || l.includes("garantía") || l.includes("garantia");
      };
      const isPlatformClause = (name: string) => {
        const l = name.toLowerCase();
        return l.includes("plataforma") || l.includes("platform");
      };

      let tpls: ClauseTemplate[] = (templates || []).filter((t: ClauseTemplate) => {
        if (isPriceUpdateClause(t.name)) {
          if (isTemporario) return false;
          if (!hasPriceUpdate) return false;
        }
        // Exclude deposit clause if deposit not required
        if (isDepositClause(t.name) && !depositRequired) return false;
        // Platform clause: only include if platform_covered
        if (isPlatformClause(t.name) && !isPlatformCovered) return false;
        // temporario: only include services clause if services exist
        if (isTemporario && t.name.toLowerCase().includes("servicio") && serviceNames.length === 0) {
          return false;
        }
        return true;
      });
      setAvailableTemplates(tpls);

      // If we have saved clauses, restore from snapshot; else build from templates
      if (clauses && clauses.length > 0) {
        const mapped: SelectedClause[] = (clauses as ContractClause[]).map(c => ({
          templateId: c.clause_template_id || "",
          title: c.title,
          enabled: c.enabled,
          order: c.order_position,
          text: c.rendered_text,
          version: c.source_version || 1,
        }));
        setSelectedClauses(mapped);
      } else {
        const mapped: SelectedClause[] = tpls.map((t, idx) => ({
          templateId: t.id,
          title: t.name,
          enabled: t.default_enabled,
          order: idx,
          text: "",
          version: t.version,
        }));
        setSelectedClauses(mapped);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [contract.id, tipoContrato, user, hasPriceUpdate, isTemporario]);

  useEffect(() => {
    if (user) loadData();
  }, [loadData, user]);

  const toggleClause = (idx: number) => {
    const tpl = availableTemplates.find(t => t.id === selectedClauses[idx]?.templateId);
    if (tpl && !tpl.is_optional) return; // mandatory clauses can't be toggled
    setSelectedClauses(prev =>
      prev.map((c, i) => i === idx ? { ...c, enabled: !c.enabled } : c)
    );
  };

  const moveClause = (idx: number, dir: "up" | "down") => {
    const newList = [...selectedClauses];
    const swapIdx = dir === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= newList.length) return;
    [newList[idx], newList[swapIdx]] = [newList[swapIdx], newList[idx]];
    setSelectedClauses(newList.map((c, i) => ({ ...c, order: i })));
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const servicesList = servicesIncluded.join(", ");

      // Build inserts with rendered snapshot
      const inserts = selectedClauses.map((c, idx) => {
        const tpl = availableTemplates.find(t => t.id === c.templateId);
        const rendered = tpl
          ? renderTemplate(tpl.template_text, contract, servicesList)
          : c.text;
        return {
          contract_id: contract.id,
          clause_template_id: c.templateId || null,
          title: c.title,
          rendered_text: rendered,
          order_position: idx,
          enabled: c.enabled,
          source_version: tpl?.version || c.version,
        };
      });

      // Delete old snapshot and insert fresh one
      await (supabase as any).from("contract_clauses").delete().eq("contract_id", contract.id);
      if (inserts.length > 0) {
        const { error: insertErr } = await (supabase as any).from("contract_clauses").insert(inserts);
        if (insertErr) throw insertErr;
      }

      // Build full draft text from enabled clauses
      const enabledInserts = inserts.filter(ins => ins.enabled);
      const fullText = enabledInserts
        .map((ins, i) => {
          return `CLÁUSULA ${toRoman(i + 1)} — ${ins.title.toUpperCase()}\n\n${ins.rendered_text}`;
        })
        .join("\n\n" + "─".repeat(70) + "\n\n");

      const now = new Date().toISOString();

      const { error } = await (supabase as any)
        .from("contracts")
        .update({
          draft_text: fullText,
          draft_last_generated_at: now,
          draft_status: "borrador",
        })
        .eq("id", contract.id);

      if (error) throw error;

      // Update local state with rendered texts
      setSelectedClauses(prev => prev.map((c, idx) => {
        const tpl = availableTemplates.find(t => t.id === c.templateId);
        const rendered = tpl ? renderTemplate(tpl.template_text, contract, servicesList) : c.text;
        return { ...c, text: rendered, order: idx };
      }));
      setDraftText(fullText);
      setDraftStatus("borrador");
      setDraftGeneratedAt(now);

      toast({
        title: "✅ Borrador generado",
        description: `${enabledInserts.length} cláusula${enabledInserts.length !== 1 ? "s" : ""} incluida${enabledInserts.length !== 1 ? "s" : ""}.`,
      });
      onSaved?.();
    } catch (err: any) {
      toast({ title: "Error al generar borrador", description: err.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveDraftText = async () => {
    setSaving(true);
    try {
      const { error } = await (supabase as any)
        .from("contracts")
        .update({ draft_text: draftText, draft_status: "borrador" })
        .eq("id", contract.id);
      if (error) throw error;
      toast({ title: "Borrador guardado" });
      onSaved?.();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(draftText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const markFinal = async () => {
    const { error } = await (supabase as any)
      .from("contracts")
      .update({ draft_status: "final" })
      .eq("id", contract.id);
    if (!error) {
      setDraftStatus("final");
      toast({ title: "Contrato marcado como final" });
      onSaved?.();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const statusColors: Record<string, "secondary" | "outline" | "default" | "destructive"> = {
    no_generado: "secondary",
    borrador: "outline",
    final: "default",
  };
  const statusLabels: Record<string, string> = {
    no_generado: "Sin borrador",
    borrador: "Borrador",
    final: "Final",
  };

  const enabledCount = selectedClauses.filter(c => c.enabled).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <FileText className="w-5 h-5 text-primary" />
          <div>
            <h3 className="font-semibold text-base">Generador de borrador</h3>
            {draftGeneratedAt && (
              <p className="text-xs text-muted-foreground">
                Última generación: {new Date(draftGeneratedAt).toLocaleString("es-AR")}
              </p>
            )}
          </div>
        </div>
        <Badge variant={statusColors[draftStatus] ?? "secondary"}>
          {statusLabels[draftStatus] || draftStatus}
        </Badge>
      </div>

      {/* Temporario note */}
      {isTemporario && (
        <div className="flex items-start gap-2 rounded-lg bg-muted/50 border border-border p-3 text-sm text-muted-foreground">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-amber-500" />
          <span>Contrato temporario: cláusulas de actualización de precio excluidas automáticamente.</span>
        </div>
      )}

      {availableTemplates.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center text-muted-foreground">
          <Info className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="font-medium">Sin cláusulas configuradas</p>
          <p className="text-sm mt-1">
            Creá cláusulas en <strong>Contratos → Cláusulas</strong> para poder generar borradores automáticos.
          </p>
        </div>
      ) : (
        <>
          {/* Clause list */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Cláusulas a incluir ({enabledCount}/{selectedClauses.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 p-4 pt-0">
              {selectedClauses.map((clause, idx) => {
                const tpl = availableTemplates.find(t => t.id === clause.templateId);
                const isOptional = tpl ? tpl.is_optional : true;
                return (
                  <div
                    key={clause.templateId + "-" + idx}
                    className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                      clause.enabled
                        ? "bg-muted/30 border-border"
                        : "bg-transparent border-dashed border-border/50 opacity-50"
                    }`}
                  >
                    {/* Order controls */}
                    <div className="flex flex-col gap-0.5 shrink-0">
                      <button
                        onClick={() => moveClause(idx, "up")}
                        disabled={idx === 0}
                        className="p-0.5 rounded hover:bg-muted disabled:opacity-20 transition-colors"
                        title="Subir"
                      >
                        <ChevronUp className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => moveClause(idx, "down")}
                        disabled={idx === selectedClauses.length - 1}
                        className="p-0.5 rounded hover:bg-muted disabled:opacity-20 transition-colors"
                        title="Bajar"
                      >
                        <ChevronDown className="w-3 h-3" />
                      </button>
                    </div>

                    {/* Toggle */}
                    <Switch
                      checked={clause.enabled}
                      onCheckedChange={() => toggleClause(idx)}
                      disabled={!isOptional}
                      title={!isOptional ? "Cláusula obligatoria" : undefined}
                    />

                    {/* Name */}
                    <span className="flex-1 text-sm font-medium min-w-0 truncate">{clause.title}</span>

                    {/* Badges */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {tpl?.applies_to && tpl.applies_to !== "todos" && (
                        <Badge variant="outline" className="text-xs capitalize">{tpl.applies_to}</Badge>
                      )}
                      {!isOptional ? (
                        <Badge variant="default" className="text-xs opacity-80">Obligatoria</Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs">Opcional</Badge>
                      )}
                      <span className="text-xs text-muted-foreground font-mono">
                        v{tpl?.version ?? clause.version}
                      </span>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Generate button */}
          <div className="flex gap-2 flex-wrap">
            <Button onClick={handleGenerate} disabled={generating || enabledCount === 0} className="gap-2">
              {generating ? (
                <><Loader2 className="w-4 h-4 animate-spin" />Generando…</>
              ) : draftStatus !== "no_generado" ? (
                <><RefreshCw className="w-4 h-4" />Regenerar borrador</>
              ) : (
                <><Wand2 className="w-4 h-4" />Generar borrador</>
              )}
            </Button>
            {enabledCount === 0 && (
              <p className="text-sm text-muted-foreground self-center">
                Activá al menos una cláusula para generar.
              </p>
            )}
          </div>
        </>
      )}

      {/* Draft editor */}
      {draftText && (
        <>
          <Separator />
          <div className="space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h4 className="font-medium text-sm">Texto del borrador</h4>
              <div className="flex gap-2 flex-wrap">
                <Button variant="outline" size="sm" onClick={handleCopy} className="gap-1.5">
                  {copied
                    ? <><CheckCheck className="w-4 h-4 text-primary" />Copiado</>
                    : <><Copy className="w-4 h-4" />Copiar</>
                  }
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSaveDraftText}
                  disabled={saving}
                  className="gap-1.5"
                >
                  {saving
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <Save className="w-4 h-4" />
                  }
                  Guardar edición
                </Button>
                {draftStatus === "borrador" && (
                  <Button size="sm" onClick={markFinal} className="gap-1.5">
                    <CheckCheck className="w-4 h-4" />
                    Marcar como final
                  </Button>
                )}
              </div>
            </div>

            <Textarea
              value={draftText}
              onChange={e => setDraftText(e.target.value)}
              className="min-h-[500px] font-mono text-xs leading-relaxed resize-y"
              placeholder="El borrador aparecerá aquí..."
            />

            <p className="text-xs text-muted-foreground">
              Podés editar el texto directamente antes de guardar o marcar como final.
              Al regenerar, el texto se reemplazará con los datos actuales del contrato.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Roman numeral helper ─────────────────────────────────────────────────────

function toRoman(n: number): string {
  const values = [1000, 900, 500, 400, 100, 90, 50, 40, 10, 9, 5, 4, 1];
  const symbols = ["M", "CM", "D", "CD", "C", "XC", "L", "XL", "X", "IX", "V", "IV", "I"];
  let result = "";
  for (let i = 0; i < values.length; i++) {
    while (n >= values[i]) {
      result += symbols[i];
      n -= values[i];
    }
  }
  return result;
}
