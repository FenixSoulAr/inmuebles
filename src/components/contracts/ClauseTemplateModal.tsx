import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useProject } from "@/contexts/ProjectContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
import type { ClauseTemplate } from "@/pages/ClauseTemplates";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  template: ClauseTemplate | null;
  onSaved: () => void;
}

export function ClauseTemplateModal({ open, onOpenChange, template, onSaved }: Props) {
  const [name, setName] = useState("");
  const [appliesTo, setAppliesTo] = useState("todos");
  const [isOptional, setIsOptional] = useState(true);
  const [defaultEnabled, setDefaultEnabled] = useState(true);
  const [templateText, setTemplateText] = useState("");
  const [orderDefault, setOrderDefault] = useState(0);
  const [saving, setSaving] = useState(false);
  const { user } = useAuth();
  const { activeProjectId } = useProject();
  const { toast } = useToast();

  useEffect(() => {
    if (template) {
      setName(template.name);
      setAppliesTo(template.applies_to);
      setIsOptional(template.is_optional);
      setDefaultEnabled(template.default_enabled);
      setTemplateText(template.template_text);
      setOrderDefault(template.order_default);
    } else {
      setName("");
      setAppliesTo("todos");
      setIsOptional(true);
      setDefaultEnabled(true);
      setTemplateText("");
      setOrderDefault(0);
    }
  }, [template, open]);

  const handleSave = async () => {
    if (!name.trim() || !templateText.trim()) {
      toast({ title: "Campos requeridos", description: "Nombre y texto son obligatorios.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      if (template) {
        // Update: bump version
        const { error } = await (supabase as any)
          .from("clause_templates")
          .update({
            name,
            applies_to: appliesTo,
            is_optional: isOptional,
            default_enabled: defaultEnabled,
            template_text: templateText,
            order_default: orderDefault,
            version: template.version + 1,
          })
          .eq("id", template.id);
        if (error) throw error;
        toast({ title: "Cláusula actualizada", description: `Versión ${template.version + 1} guardada.` });
      } else {
        const { error } = await (supabase as any)
          .from("clause_templates")
          .insert({
            project_id: activeProjectId!,
            name,
            applies_to: appliesTo,
            is_optional: isOptional,
            default_enabled: defaultEnabled,
            template_text: templateText,
            order_default: orderDefault,
            version: 1,
            is_active: true,
          });
        if (error) throw error;
        toast({ title: "Cláusula creada" });
      }
      onSaved();
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "No se pudo guardar.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const VARIABLES = [
    "{{owner_name}}", "{{tenant_name}}", "{{property_address}}",
    "{{start_date}}", "{{end_date}}", "{{base_price}}", "{{currency}}",
    "{{price_mode}}", "{{deposit_value}}", "{{services_list}}",
  ];

  const insertVariable = (v: string) => {
    setTemplateText(prev => prev + v);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{template ? "Editar cláusula" : "Nueva cláusula"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="name">Nombre de la cláusula *</Label>
              <Input
                id="name"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Ej: Cláusula de destino"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Aplica a</Label>
              <Select value={appliesTo} onValueChange={setAppliesTo}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los tipos</SelectItem>
                  <SelectItem value="permanente">Permanente</SelectItem>
                  <SelectItem value="temporario">Temporario</SelectItem>
                  <SelectItem value="comercial">Comercial</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Orden</Label>
              <Input
                type="number"
                value={orderDefault}
                onChange={e => setOrderDefault(Number(e.target.value))}
                min={0}
              />
            </div>

            <div className="flex items-center gap-3 py-2">
              <Switch checked={isOptional} onCheckedChange={setIsOptional} id="optional" />
              <Label htmlFor="optional">Cláusula opcional</Label>
            </div>

            <div className="flex items-center gap-3 py-2">
              <Switch checked={defaultEnabled} onCheckedChange={setDefaultEnabled} id="default-enabled" />
              <Label htmlFor="default-enabled">Activada por defecto</Label>
            </div>
          </div>

          {/* Variables palette */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Variables rápidas (click para insertar)</Label>
            <div className="flex flex-wrap gap-1.5">
              {VARIABLES.map(v => (
                <button
                  key={v}
                  type="button"
                  onClick={() => insertVariable(v)}
                  className="text-xs font-mono px-2 py-1 rounded bg-muted hover:bg-primary hover:text-primary-foreground transition-colors"
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="template-text">Texto de la cláusula *</Label>
            <Textarea
              id="template-text"
              value={templateText}
              onChange={e => setTemplateText(e.target.value)}
              placeholder="Escribí el texto de la cláusula usando {{variables}} para datos dinámicos..."
              className="min-h-[200px] font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Los datos faltantes se reemplazarán por "__________" al generar el borrador.
            </p>
          </div>

          {template && (
            <p className="text-xs text-muted-foreground">
              Versión actual: v{template.version}. Al guardar se creará la v{template.version + 1}.
            </p>
          )}
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Guardando…" : template ? "Guardar cambios" : "Crear cláusula"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
