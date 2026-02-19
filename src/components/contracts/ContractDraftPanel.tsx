import { useState, useEffect, useCallback } from "react";
import {
  FileText, Wand2, RefreshCw, Save, Copy, ChevronUp, ChevronDown,
  Loader2, CheckCheck, Info
} from "lucide-react";
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
  properties: { internal_identifier: string; full_address: string };
  tenants: { full_name: string };
  owners?: Array<{ full_name: string }>;
}

interface Props {
  contract: ContractForDraft;
  onSaved?: () => void;
}

// ─── Variable renderer ───────────────────────────────────────────────────────

const PRICE_MODE_LABELS: Record<string, string> = {
  mensual: "mensual",
  diario: "por día",
  semanal: "semanal",
  total_estadia: "total de estadía",
};

function renderTemplate(
  template: string,
  contract: ContractForDraft,
  servicesList: string
): string {
  const locale = "es-AR";
  const fmt = (n: number, curr: string) =>
    new Intl.NumberFormat(locale, { style: "currency", currency: curr, minimumFractionDigits: 0 }).format(n);
  const fmtDate = (d: string) =>
    new Date(d + "T00:00:00").toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" });

  const ownerName = contract.owners?.map(o => o.full_name).join(" / ") || "__________";
  const currency = contract.currency || "ARS";
  const priceMode = PRICE_MODE_LABELS[contract.price_mode || "mensual"] || contract.price_mode || "mensual";

  const vars: Record<string, string> = {
    "{{owner_name}}": ownerName,
    "{{tenant_name}}": contract.tenants.full_name || "__________",
    "{{property_address}}": contract.properties.full_address || "__________",
    "{{start_date}}": fmtDate(contract.start_date),
    "{{end_date}}": fmtDate(contract.end_date),
    "{{base_price}}": contract.current_rent != null ? fmt(contract.current_rent, currency) : "__________",
    "{{currency}}": currency,
    "{{price_mode}}": priceMode,
    "{{deposit_value}}": contract.deposit != null ? fmt(contract.deposit, currency) : "__________",
    "{{services_list}}": servicesList || "__________",
  };

  let result = template;
  for (const [key, val] of Object.entries(vars)) {
    // Use split+join instead of replaceAll for broader TS target compatibility
    result = result.split(key).join(val);
  }
  // Replace any remaining {{...}} with __________
  result = result.replace(/\{\{[^}]+\}\}/g, "__________");
  return result;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ContractDraftPanel({ contract, onSaved }: Props) {
  const [availableTemplates, setAvailableTemplates] = useState<ClauseTemplate[]>([]);
  const [selectedClauses, setSelectedClauses] = useState<
    Array<{ templateId: string; title: string; enabled: boolean; order: number; text: string; version: number }>
  >([]);
  const [savedClauses, setSavedClauses] = useState<ContractClause[]>([]);
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

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Load clause templates that apply to this contract type
      const { data: templates } = await (supabase as any)
        .from("clause_templates")
        .select("*")
        .eq("owner_user_id", user!.id)
        .eq("is_active", true)
        .or(`applies_to.eq.todos,applies_to.eq.${tipoContrato}`)
        .order("order_default");

      // Load existing contract_clauses (snapshot)
      const { data: clauses } = await (supabase as any)
        .from("contract_clauses")
        .select("*")
        .eq("contract_id", contract.id)
        .order("order_position");

      // Load services included (for temporario)
      const { data: services } = await (supabase as any)
        .from("contract_services")
        .select("service_type")
        .eq("contract_id", contract.id)
        .eq("active", true);

      const serviceNames = (services || []).map((s: any) => s.service_type);
      setServicesIncluded(serviceNames);
      setSavedClauses(clauses || []);

      const tpls: ClauseTemplate[] = templates || [];
      setAvailableTemplates(tpls);

      // If we already have saved clauses, use them; else build from templates
      if (clauses && clauses.length > 0) {
        const mapped = (clauses as ContractClause[]).map(c => ({
          templateId: c.clause_template_id || "",
          title: c.title,
          enabled: c.enabled,
          order: c.order_position,
          text: c.rendered_text,
          version: c.source_version || 1,
        }));
        setSelectedClauses(mapped);
      } else {
        const mapped = tpls.map((t, idx) => ({
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
  }, [contract.id, tipoContrato, user]);

  useEffect(() => {
    if (user) loadData();
  }, [loadData, user]);

  const toggleClause = (idx: number) => {
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
      const enabledClauses = selectedClauses
        .filter(c => c.enabled)
        .map((c, idx) => {
          const tpl = availableTemplates.find(t => t.id === c.templateId);
          const rendered = tpl
            ? renderTemplate(tpl.template_text, contract, servicesList)
            : c.text;
          return { ...c, text: rendered, order: idx };
        });

      // Upsert contract_clauses (delete old ones and insert fresh snapshot)
      await (supabase as any).from("contract_clauses").delete().eq("contract_id", contract.id);

      const inserts = selectedClauses.map((c, idx) => {
        const tpl = availableTemplates.find(t => t.id === c.templateId);
        const rendered = c.enabled && tpl
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

      if (inserts.length > 0) {
        await (supabase as any).from("contract_clauses").insert(inserts);
      }

      // Build draft_text
      const fullText = enabledClauses
        .map((c, i) => {
          const clauseNum = toRomanLike(i + 1);
          return `CLÁUSULA ${clauseNum} — ${c.title.toUpperCase()}\n\n${c.text}`;
        })
        .join("\n\n" + "─".repeat(70) + "\n\n");

      const now = new Date().toISOString();

      // Save draft
      const { error } = await (supabase as any)
        .from("contracts")
        .update({
          draft_text: fullText,
          draft_last_generated_at: now,
          draft_status: "borrador",
        })
        .eq("id", contract.id);

      if (error) throw error;

      setDraftText(fullText);
      setDraftStatus("borrador");
      setDraftGeneratedAt(now);
      setSelectedClauses(prev => prev.map((c, idx) => {
        const tpl = availableTemplates.find(t => t.id === c.templateId);
        const rendered = c.enabled && tpl
          ? renderTemplate(tpl.template_text, contract, servicesList)
          : c.text;
        return { ...c, text: rendered, order: idx };
      }));

      toast({ title: "✅ Borrador generado", description: `${enabledClauses.length} cláusulas incluidas.` });
      onSaved?.();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
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

  const statusColors: Record<string, string> = {
    no_generado: "secondary",
    borrador: "outline",
    final: "default",
  };
  const statusLabels: Record<string, string> = {
    no_generado: "Sin borrador",
    borrador: "Borrador",
    final: "Final",
  };

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
        <Badge variant={statusColors[draftStatus] as any || "secondary"}>
          {statusLabels[draftStatus] || draftStatus}
        </Badge>
      </div>

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
          {/* Clause selector */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Cláusulas a incluir ({selectedClauses.filter(c => c.enabled).length}/{selectedClauses.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 p-4 pt-0">
              {selectedClauses.map((clause, idx) => {
                const tpl = availableTemplates.find(t => t.id === clause.templateId);
                return (
                  <div
                    key={clause.templateId + idx}
                    className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                      clause.enabled ? "bg-muted/30 border-border" : "bg-transparent border-dashed border-border/50 opacity-50"
                    }`}
                  >
                    <div className="flex flex-col gap-0.5">
                      <button
                        onClick={() => moveClause(idx, "up")}
                        disabled={idx === 0}
                        className="p-0.5 rounded hover:bg-muted disabled:opacity-20"
                      >
                        <ChevronUp className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => moveClause(idx, "down")}
                        disabled={idx === selectedClauses.length - 1}
                        className="p-0.5 rounded hover:bg-muted disabled:opacity-20"
                      >
                        <ChevronDown className="w-3 h-3" />
                      </button>
                    </div>
                    <Switch
                      checked={clause.enabled}
                      onCheckedChange={() => toggleClause(idx)}
                      disabled={tpl && !tpl.is_optional}
                    />
                    <span className="flex-1 text-sm font-medium">{clause.title}</span>
                    {tpl?.applies_to && tpl.applies_to !== "todos" && (
                      <Badge variant="outline" className="text-xs">{tpl.applies_to}</Badge>
                    )}
                    {tpl && !tpl.is_optional && (
                      <Badge variant="default" className="text-xs opacity-80">Obligatoria</Badge>
                    )}
                    <span className="text-xs text-muted-foreground font-mono">v{tpl?.version || clause.version}</span>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex gap-2 flex-wrap">
            <Button onClick={handleGenerate} disabled={generating} className="gap-2">
              {generating
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Generando…</>
                : draftStatus !== "no_generado"
                ? <><RefreshCw className="w-4 h-4" /> Regenerar borrador</>
                : <><Wand2 className="w-4 h-4" /> Generar borrador</>
              }
            </Button>
          </div>
        </>
      )}

      {/* Draft editor */}
      {draftText && (
        <>
          <Separator />
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-sm">Texto del borrador</h4>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleCopy} className="gap-1.5">
                  {copied ? <CheckCheck className="w-4 h-4 text-primary" /> : <Copy className="w-4 h-4" />}
                  {copied ? "Copiado" : "Copiar"}
                </Button>
                <Button variant="outline" size="sm" onClick={handleSaveDraftText} disabled={saving} className="gap-1.5">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Guardar
                </Button>
                {draftStatus === "borrador" && (
                  <Button size="sm" onClick={markFinal} variant="default" className="gap-1.5">
                    <CheckCheck className="w-4 h-4" />
                    Marcar como final
                  </Button>
                )}
              </div>
            </div>
            <Textarea
              value={draftText}
              onChange={e => setDraftText(e.target.value)}
              className="min-h-[500px] font-mono text-xs leading-relaxed"
            />
          </div>
        </>
      )}
    </div>
  );
}

// Small utility: 1 → "I", 2 → "II", etc (simplified ordinal labeling)
function toRomanLike(n: number): string {
  const ordinals = [
    "1ª", "2ª", "3ª", "4ª", "5ª", "6ª", "7ª", "8ª", "9ª", "10ª",
    "11ª", "12ª", "13ª", "14ª", "15ª", "16ª", "17ª", "18ª", "19ª", "20ª",
  ];
  return ordinals[n - 1] || String(n) + "ª";
}
