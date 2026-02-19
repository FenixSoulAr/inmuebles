import { useState, useEffect } from "react";
import { Plus, FileText, Pencil, Trash2, ToggleLeft, ToggleRight, ChevronUp, ChevronDown, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { DeleteConfirmationModal } from "@/components/ui/delete-confirmation-modal";
import { ClauseTemplateModal } from "@/components/contracts/ClauseTemplateModal";

export interface ClauseTemplate {
  id: string;
  owner_user_id: string;
  name: string;
  applies_to: string;
  is_optional: boolean;
  default_enabled: boolean;
  template_text: string;
  order_default: number;
  version: number;
  is_active: boolean;
  tags: string | null;
  created_at: string;
  updated_at: string;
}

const APPLIES_TO_LABELS: Record<string, string> = {
  todos: "Todos los tipos",
  permanente: "Permanente",
  temporario: "Temporario",
  comercial: "Comercial",
};

const APPLIES_TO_COLORS: Record<string, string> = {
  todos: "secondary",
  permanente: "default",
  temporario: "outline",
  comercial: "destructive",
};

export default function ClauseTemplates() {
  const [templates, setTemplates] = useState<ClauseTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ClauseTemplate | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ClauseTemplate | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (user) fetchTemplates();
  }, [user]);

  const fetchTemplates = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("clause_templates")
      .select("*")
      .eq("owner_user_id", user!.id)
      .order("order_default")
      .order("created_at");

    if (error) {
      toast({ title: "Error", description: "No se pudieron cargar las cláusulas.", variant: "destructive" });
    } else {
      setTemplates(data || []);
    }
    setLoading(false);
  };

  const handleToggleActive = async (t: ClauseTemplate) => {
    const { error } = await (supabase as any)
      .from("clause_templates")
      .update({ is_active: !t.is_active })
      .eq("id", t.id);
    if (error) {
      toast({ title: "Error", description: "No se pudo actualizar.", variant: "destructive" });
    } else {
      setTemplates(prev => prev.map(x => x.id === t.id ? { ...x, is_active: !x.is_active } : x));
    }
  };

  const handleMoveOrder = async (t: ClauseTemplate, direction: "up" | "down") => {
    const idx = templates.findIndex(x => x.id === t.id);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= templates.length) return;

    const swapTarget = templates[swapIdx];
    const newOrder = swapTarget.order_default;
    const oldOrder = t.order_default;

    await Promise.all([
      (supabase as any).from("clause_templates").update({ order_default: newOrder }).eq("id", t.id),
      (supabase as any).from("clause_templates").update({ order_default: oldOrder }).eq("id", swapTarget.id),
    ]);
    fetchTemplates();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await (supabase as any)
      .from("clause_templates")
      .delete()
      .eq("id", deleteTarget.id);
    if (error) {
      toast({ title: "Error", description: "No se pudo eliminar la cláusula.", variant: "destructive" });
    } else {
      toast({ title: "Cláusula eliminada" });
      setTemplates(prev => prev.filter(x => x.id !== deleteTarget.id));
    }
    setDeleteTarget(null);
  };

  const handleSaved = () => {
    setModalOpen(false);
    setEditTarget(null);
    fetchTemplates();
  };

  const DEFAULT_CLAUSES = [
    { name: "Objeto del contrato", applies_to: "todos", is_optional: false, default_enabled: true, order_default: 0,
      template_text: `El LOCADOR da en locación al LOCATARIO el inmueble ubicado en:\n\n  Dirección: {{property_address}}\n\nEl LOCATARIO declara conocer el estado del inmueble, habiéndolo visitado y aceptado en las condiciones en que se encuentra.` },
    { name: "Destino", applies_to: "todos", is_optional: false, default_enabled: true, order_default: 1,
      template_text: `El inmueble se destina exclusivamente al uso acordado entre las partes. Queda expresamente prohibido subalquilar, ceder, transferir o en cualquier forma subcontratar el presente contrato sin autorización expresa y escrita del LOCADOR.` },
    { name: "Plazo", applies_to: "todos", is_optional: false, default_enabled: true, order_default: 2,
      template_text: `El plazo del presente contrato se extiende desde {{start_date}} hasta {{end_date}}. Transcurrido dicho plazo, el LOCATARIO deberá restituir el inmueble libre de ocupantes y bienes, sin necesidad de interpelación previa.` },
    { name: "Precio y forma de pago", applies_to: "todos", is_optional: false, default_enabled: true, order_default: 3,
      template_text: `El precio de la locación se establece en {{base_price}} ({{currency}}) {{price_mode}}. El pago deberá realizarse dentro de los primeros días de cada período acordado, en el domicilio del LOCADOR o por transferencia bancaria.` },
    { name: "Depósito en garantía", applies_to: "todos", is_optional: false, default_enabled: true, order_default: 4,
      template_text: `El LOCATARIO entrega en este acto al LOCADOR la suma de {{deposit_value}} ({{currency}}) en concepto de depósito en garantía, el cual será devuelto al finalizar el contrato, previa verificación del estado del inmueble y cumplimiento de todas las obligaciones.` },
    { name: "Servicios incluidos", applies_to: "temporario", is_optional: true, default_enabled: true, order_default: 5,
      template_text: `El precio pactado incluye los siguientes servicios: {{services_list}}. El LOCATARIO se compromete a hacer uso racional de los mismos y no podrá reclamar compensación alguna por interrupciones de servicio ajenas al LOCADOR.` },
    { name: "Actualización de precio", applies_to: "permanente", is_optional: true, default_enabled: true, order_default: 6,
      template_text: `El precio de la locación se actualizará periódicamente conforme a los índices y plazos acordados entre las partes al momento de la firma del contrato, de acuerdo con la normativa vigente.` },
    { name: "Conservación del inmueble", applies_to: "todos", is_optional: false, default_enabled: true, order_default: 7,
      template_text: `El LOCATARIO se obliga a: (a) conservar el inmueble en buen estado; (b) realizar las reparaciones menores que le correspondan; (c) no efectuar modificaciones sin autorización escrita del LOCADOR; (d) comunicar inmediatamente cualquier daño o desperfecto que requiera reparación urgente.` },
    { name: "Restitución del inmueble", applies_to: "todos", is_optional: false, default_enabled: true, order_default: 8,
      template_text: `Al vencimiento del contrato o ante cualquier causa de rescisión, el LOCATARIO deberá restituir el inmueble en el mismo estado en que lo recibió, salvo el deterioro natural proveniente del uso y goce regular. El LOCATARIO deberá entregar las llaves dentro de las 24 horas de producido el vencimiento.` },
    { name: "Domicilio constituido", applies_to: "todos", is_optional: false, default_enabled: true, order_default: 9,
      template_text: `A todos los efectos del presente contrato, las partes constituyen domicilio especial:\n\n  LOCADOR: __________\n  LOCATARIO: {{property_address}}\n\nEn dichos domicilios serán válidas todas las notificaciones judiciales y extrajudiciales.` },
  ];

  const handleSeedDefaults = async () => {
    if (templates.length > 0) {
      if (!window.confirm("Ya tenés cláusulas creadas. ¿Querés agregar las cláusulas por defecto de todas formas?")) return;
    }
    const inserts = DEFAULT_CLAUSES.map(c => ({ ...c, owner_user_id: user!.id, version: 1, is_active: true }));
    const { error } = await (supabase as any).from("clause_templates").insert(inserts);
    if (error) {
      toast({ title: "Error", description: "No se pudieron crear las cláusulas.", variant: "destructive" });
    } else {
      toast({ title: "✅ Cláusulas creadas", description: `${inserts.length} cláusulas de ejemplo agregadas.` });
      fetchTemplates();
    }
  };


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
        title="Cláusulas de contratos"
        description="Administrá las plantillas de cláusulas con variables parametrizables para generar borradores automáticos."
      >
        <div className="flex gap-2">
          {templates.length === 0 && (
            <Button variant="outline" onClick={handleSeedDefaults}>
              <Sparkles className="w-4 h-4 mr-2" />
              Cargar ejemplos
            </Button>
          )}
          <Button onClick={() => { setEditTarget(null); setModalOpen(true); }}>
            <Plus className="w-4 h-4 mr-2" />
            Nueva cláusula
          </Button>
        </div>
      </PageHeader>

      {/* Help */}
      <div className="mb-6 p-4 rounded-lg bg-muted/50 border border-border text-sm text-muted-foreground">
        <p className="font-medium text-foreground mb-1">Variables disponibles</p>
        <p className="font-mono text-xs leading-relaxed">
          {`{{owner_name}}  {{tenant_name}}  {{property_address}}  {{start_date}}  {{end_date}}  {{base_price}}  {{currency}}  {{price_mode}}  {{deposit_value}}  {{services_list}}`}
        </p>
        <p className="mt-2">Los datos faltantes se reemplazarán por <code className="bg-muted px-1 rounded">__________</code>.</p>
      </div>

      {templates.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Sin cláusulas</p>
          <p className="text-sm mt-1">Creá la primera cláusula para empezar a generar borradores de contratos.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map((t, idx) => (
            <Card key={t.id} className={!t.is_active ? "opacity-50" : ""}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  {/* Order buttons */}
                  <div className="flex flex-col gap-0.5 mt-0.5">
                    <button
                      onClick={() => handleMoveOrder(t, "up")}
                      disabled={idx === 0}
                      className="p-1 rounded hover:bg-muted disabled:opacity-20 transition-colors"
                    >
                      <ChevronUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleMoveOrder(t, "down")}
                      disabled={idx === templates.length - 1}
                      className="p-1 rounded hover:bg-muted disabled:opacity-20 transition-colors"
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{t.name}</span>
                      <Badge variant={APPLIES_TO_COLORS[t.applies_to] as any || "secondary"} className="text-xs">
                        {APPLIES_TO_LABELS[t.applies_to] || t.applies_to}
                      </Badge>
                      {t.is_optional ? (
                        <Badge variant="outline" className="text-xs">Opcional</Badge>
                      ) : (
                        <Badge variant="default" className="text-xs opacity-80">Obligatoria</Badge>
                      )}
                      {t.default_enabled && (
                        <Badge variant="outline" className="text-xs border-primary text-primary">Activada por defecto</Badge>
                      )}
                      <span className="text-xs text-muted-foreground ml-auto">v{t.version}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2 font-mono">
                      {t.template_text.slice(0, 150)}{t.template_text.length > 150 ? "…" : ""}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      title={t.is_active ? "Desactivar" : "Activar"}
                      onClick={() => handleToggleActive(t)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      {t.is_active
                        ? <ToggleRight className="w-4 h-4 text-primary" />
                        : <ToggleLeft className="w-4 h-4" />
                      }
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => { setEditTarget(t); setModalOpen(true); }}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setDeleteTarget(t)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modal CRUD */}
      <ClauseTemplateModal
        open={modalOpen}
        onOpenChange={(o) => { setModalOpen(o); if (!o) setEditTarget(null); }}
        template={editTarget}
        onSaved={handleSaved}
      />

      {/* Delete confirm */}
      <DeleteConfirmationModal
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Eliminar cláusula"
        description={`¿Confirmás que querés eliminar "${deleteTarget?.name}"? Esta acción no se puede deshacer.`}
      />
    </div>
  );
}
