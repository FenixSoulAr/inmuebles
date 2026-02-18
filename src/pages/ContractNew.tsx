import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Building2, User, Calendar, DollarSign, TrendingUp, Shield, CheckSquare, Home } from "lucide-react";
import { GuarantorsSection, type GuarantorEntry } from "@/components/contracts/GuarantorsSection";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

interface Property {
  id: string;
  internal_identifier: string;
  full_address: string;
}

interface Tenant {
  id: string;
  full_name: string;
}

const schema = z.object({
  property_id: z.string().min(1, "Propiedad requerida."),
  tenant_id: z.string().min(1, "Inquilino requerido."),
  tipo_contrato: z.string().default("vivienda"),
  start_date: z.string().min(1, "Fecha de inicio requerida."),
  end_date: z.string().min(1, "Fecha de fin requerida."),
  // Rent
  currency: z.string().default("ARS"),
  initial_rent: z.number({ invalid_type_error: "Monto requerido." }).min(0.01),
  rent_due_day: z.number().min(1).max(28).default(5),
  // Deposit
  currency_deposit: z.string().default("ARS"),
  deposit: z.number().optional().nullable(),
  // Indexation
  adjustment_type: z.string().default("ipc"),
  adjustment_frequency: z.number().default(4),
  index_notes: z.string().optional().nullable(),
  // Insurance
  usa_seguro: z.boolean().default(true),
  seguro_tipo: z.string().default("caucion"),
  seguro_obligatorio: z.boolean().default(true),
  tenant_insurance_notes: z.string().optional().nullable(),
  // Conditions
  expensas_ordinarias: z.boolean().default(true),
  expensas_extraordinarias: z.boolean().default(false),
  impuestos_a_cargo_locatario: z.boolean().default(false),
  permite_subalquiler: z.boolean().default(false),
  permite_mascotas: z.boolean().default(false),
  // Other
  clauses_text: z.string().optional().nullable(),
  submission_language: z.string().default("es"),
}).refine((d) => new Date(d.end_date) > new Date(d.start_date), {
  message: "La fecha de fin debe ser posterior a la de inicio.",
  path: ["end_date"],
});

type FormData = z.infer<typeof schema>;

function SectionTitle({ icon: Icon, children }: { icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-sm font-semibold text-foreground pt-2">
      <Icon className="w-4 h-4 text-primary" />
      {children}
    </div>
  );
}

export default function ContractNew() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [guarantors, setGuarantors] = useState<GuarantorEntry[]>([]);
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      tipo_contrato: "vivienda",
      currency: "ARS",
      currency_deposit: "ARS",
      adjustment_type: "ipc",
      adjustment_frequency: 4,
      rent_due_day: 5,
      submission_language: "es",
      usa_seguro: true,
      seguro_tipo: "caucion",
      seguro_obligatorio: true,
      expensas_ordinarias: true,
      expensas_extraordinarias: false,
      impuestos_a_cargo_locatario: false,
      permite_subalquiler: false,
      permite_mascotas: false,
    },
  });

  const watchUsaSeguro = watch("usa_seguro");

  useEffect(() => {
    if (user) fetchData();
  }, [user]);

  const fetchData = async () => {
    try {
      const [propRes, tenRes] = await Promise.all([
        supabase.from("properties").select("id, internal_identifier, full_address").eq("active", true),
        supabase.from("tenants").select("id, full_name").eq("status", "active"),
      ]);
      setProperties(propRes.data || []);
      setTenants(tenRes.data || []);
    } catch (err) {
      console.error("Error loading data:", err);
      toast({ title: "Error", description: "No se pudieron cargar los datos.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    try {
      // Check for overlapping active contracts on the same property
      const { data: existing } = await supabase
        .from("contracts")
        .select("id, start_date, end_date")
        .eq("property_id", data.property_id)
        .eq("is_active", true);

      const newStart = new Date(data.start_date);
      const newEnd = new Date(data.end_date);
      const hasOverlap = (existing || []).some((c) => {
        const s = new Date(c.start_date);
        const e = new Date(c.end_date);
        return newStart <= e && newEnd >= s;
      });

      if (hasOverlap) {
        toast({
          title: "Conflicto de fechas",
          description: "La propiedad ya tiene un contrato activo para ese período.",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }

      const token = Array.from(crypto.getRandomValues(new Uint8Array(32)))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      const { data: created, error } = await supabase
        .from("contracts")
        .insert({
          property_id: data.property_id,
          tenant_id: data.tenant_id,
          tipo_contrato: data.tipo_contrato,
          start_date: data.start_date,
          end_date: data.end_date,
          currency: data.currency,
          initial_rent: data.initial_rent,
          current_rent: data.initial_rent,
          rent_due_day: data.rent_due_day,
          currency_deposit: data.currency_deposit,
          deposit: data.deposit ?? null,
          adjustment_type: data.adjustment_type,
          adjustment_frequency: data.adjustment_frequency,
          index_notes: data.index_notes ?? null,
          usa_seguro: data.usa_seguro,
          seguro_tipo: data.usa_seguro ? data.seguro_tipo : null,
          seguro_obligatorio: data.usa_seguro ? data.seguro_obligatorio : null,
          tenant_insurance_notes: data.tenant_insurance_notes ?? null,
          expensas_ordinarias: data.expensas_ordinarias,
          expensas_extraordinarias: data.expensas_extraordinarias,
          impuestos_a_cargo_locatario: data.impuestos_a_cargo_locatario,
          permite_subalquiler: data.permite_subalquiler,
          permite_mascotas: data.permite_mascotas,
          clauses_text: data.clauses_text ?? null,
          is_active: true,
          submission_language: data.submission_language,
          public_submission_token: token,
          token_status: "active",
          token_created_at: new Date().toISOString(),
        } as any)
        .select("id")
        .single();

      if (error) throw error;

      // Save guarantors
      if (guarantors.length > 0) {
        const guarantorRows = guarantors.map((g, idx) => ({
          contract_id: created.id,
          guarantee_type: g.guarantee_type,
          guarantor_type: g.guarantee_type === "seguro_caucion" ? "insurance" : "individual",
          full_name: g.full_name || g.company_name || "",
          company_name: g.company_name || null,
          document_or_cuit: g.document_or_cuit || null,
          address: g.address || null,
          phone: g.phone || null,
          email: g.email || null,
          notes: g.notes || null,
          insurance_policy_number: g.insurance_policy_number || null,
          coverage_amount: g.coverage_amount ? Number(g.coverage_amount) : null,
          insurance_valid_from: g.insurance_valid_from || null,
          insurance_valid_to: g.insurance_valid_to || null,
          sort_order: idx,
          details: g.matricula ? { matricula: g.matricula } : null,
        }));
        await supabase.from("contract_guarantors" as any).insert(guarantorRows as any);
      }

      // Fire-and-forget helpers
      await Promise.allSettled([
        supabase.functions.invoke("generate-rent-dues", { body: { contract_id: created.id } }),
        supabase.from("tenancy_links").insert({
          property_id: data.property_id,
          tenant_id: data.tenant_id,
          start_date: data.start_date,
          end_date: data.end_date,
        }),
        supabase.from("properties").update({ status: "occupied" }).eq("id", data.property_id),
      ]);

      toast({ title: "Contrato creado", description: "El contrato fue creado correctamente." });
      navigate(`/contracts/${created.id}`);
    } catch (err: any) {
      console.error("Error creating contract:", err);
      toast({ title: "Error", description: err?.message || "No se pudo crear el contrato.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
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
      <Button variant="ghost" size="sm" className="mb-4" onClick={() => navigate("/contracts")}>
        <ArrowLeft className="w-4 h-4 mr-2" />
        Volver a contratos
      </Button>

      <PageHeader title="Nuevo contrato de locación" description="Complete los datos para generar el contrato" />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-w-3xl">

        {/* ── SECCIÓN A: Partes ── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <User className="w-4 h-4" /> Partes del contrato
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Propiedad *</Label>
                <Controller
                  name="property_id"
                  control={control}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value ?? ""}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar propiedad…" />
                      </SelectTrigger>
                      <SelectContent>
                        {properties.length === 0 && (
                          <SelectItem value="_none" disabled>Sin propiedades activas</SelectItem>
                        )}
                        {properties.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.internal_identifier} — {p.full_address}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.property_id && <p className="text-xs text-destructive">{errors.property_id.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>Inquilino *</Label>
                <Controller
                  name="tenant_id"
                  control={control}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value ?? ""}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar inquilino…" />
                      </SelectTrigger>
                      <SelectContent>
                        {tenants.length === 0 && (
                          <SelectItem value="_none" disabled>Sin inquilinos activos</SelectItem>
                        )}
                        {tenants.map((t) => (
                          <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.tenant_id && <p className="text-xs text-destructive">{errors.tenant_id.message}</p>}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Tipo de contrato</Label>
              <Controller
                name="tipo_contrato"
                control={control}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="vivienda">🏠 Vivienda / Habitacional</SelectItem>
                      <SelectItem value="comercial">🏢 Comercial</SelectItem>
                      <SelectItem value="temporal">⏱ Temporal / Turístico</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </CardContent>
        </Card>

        {/* ── SECCIÓN B: Fechas ── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Calendar className="w-4 h-4" /> Plazo del contrato
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="start_date">Fecha de inicio *</Label>
                <Input type="date" id="start_date" {...register("start_date")} />
                {errors.start_date && <p className="text-xs text-destructive">{errors.start_date.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="end_date">Fecha de vencimiento *</Label>
                <Input type="date" id="end_date" {...register("end_date")} />
                {errors.end_date && <p className="text-xs text-destructive">{errors.end_date.message}</p>}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── SECCIÓN C: Alquiler ── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <DollarSign className="w-4 h-4" /> Alquiler y depósito
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <SectionTitle icon={Home}>Alquiler mensual</SectionTitle>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>Moneda</Label>
                <Controller
                  name="currency"
                  control={control}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ARS">🇦🇷 ARS — Peso argentino</SelectItem>
                        <SelectItem value="USD">🇺🇸 USD — Dólar</SelectItem>
                        <SelectItem value="EUR">🇪🇺 EUR — Euro</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="initial_rent">Monto de alquiler *</Label>
                <Input
                  type="number"
                  id="initial_rent"
                  step="0.01"
                  min="0"
                  placeholder="0,00"
                  {...register("initial_rent", { valueAsNumber: true })}
                />
                {errors.initial_rent && <p className="text-xs text-destructive">{errors.initial_rent.message}</p>}
              </div>
            </div>
            <div className="space-y-2 max-w-xs">
              <Label htmlFor="rent_due_day">Día de vencimiento del pago (1–28)</Label>
              <Input
                type="number"
                id="rent_due_day"
                min="1"
                max="28"
                {...register("rent_due_day", { valueAsNumber: true })}
              />
            </div>

            <Separator />

            <SectionTitle icon={DollarSign}>Depósito de garantía</SectionTitle>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>Moneda depósito</Label>
                <Controller
                  name="currency_deposit"
                  control={control}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ARS">🇦🇷 ARS — Peso argentino</SelectItem>
                        <SelectItem value="USD">🇺🇸 USD — Dólar</SelectItem>
                        <SelectItem value="EUR">🇪🇺 EUR — Euro</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="deposit">Monto depósito</Label>
                <Input
                  type="number"
                  id="deposit"
                  step="0.01"
                  min="0"
                  placeholder="0,00"
                  {...register("deposit", { valueAsNumber: true })}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── SECCIÓN D: Indexación ── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="w-4 h-4" /> Actualización del precio
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Índice de actualización</Label>
                <Controller
                  name="adjustment_type"
                  control={control}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ipc">IPC — Índice de Precios al Consumidor</SelectItem>
                        <SelectItem value="icl">ICL — Índice Casa Propia</SelectItem>
                        <SelectItem value="fixed">Porcentaje fijo</SelectItem>
                        <SelectItem value="manual">Ajuste manual</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div className="space-y-2">
                <Label>Frecuencia</Label>
                <Controller
                  name="adjustment_frequency"
                  control={control}
                  render={({ field }) => (
                    <Select
                      onValueChange={(v) => field.onChange(Number(v))}
                      value={String(field.value)}
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
                  )}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="index_notes">Notas sobre actualización</Label>
              <Input
                id="index_notes"
                placeholder="Ej: aplicar según publicación INDEC del mes anterior"
                {...register("index_notes")}
              />
            </div>
          </CardContent>
        </Card>

        {/* ── SECCIÓN E: Seguro ── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="w-4 h-4" /> Seguro del inquilino
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Controller
                name="usa_seguro"
                control={control}
                render={({ field }) => (
                  <Checkbox
                    id="usa_seguro"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                )}
              />
              <Label htmlFor="usa_seguro" className="cursor-pointer">
                El contrato requiere seguro por parte del inquilino
              </Label>
            </div>

            {watchUsaSeguro && (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Tipo de seguro</Label>
                    <Controller
                      name="seguro_tipo"
                      control={control}
                      render={({ field }) => (
                        <Select onValueChange={field.onChange} value={field.value}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="incendio">Seguro contra incendio</SelectItem>
                            <SelectItem value="caucion">Seguro de caución</SelectItem>
                            <SelectItem value="integral">Seguro integral de inquilinos</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>
                  <div className="flex items-center gap-3 pt-7">
                    <Controller
                      name="seguro_obligatorio"
                      control={control}
                      render={({ field }) => (
                        <Checkbox
                          id="seguro_obligatorio"
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      )}
                    />
                    <Label htmlFor="seguro_obligatorio" className="cursor-pointer">
                      Seguro obligatorio (condición esencial)
                    </Label>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tenant_insurance_notes">Observaciones del seguro</Label>
                  <Input
                    id="tenant_insurance_notes"
                    placeholder="Ej: renovar anualmente, endosar a favor del propietario"
                    {...register("tenant_insurance_notes")}
                  />
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* ── SECCIÓN F: Condiciones ── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckSquare className="w-4 h-4" /> Condiciones del contrato
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              {([
                ["expensas_ordinarias", "Expensas ordinarias a cargo del inquilino"],
                ["expensas_extraordinarias", "Expensas extraordinarias a cargo del inquilino"],
                ["impuestos_a_cargo_locatario", "Impuestos del inmueble a cargo del inquilino"],
                ["permite_subalquiler", "Permite subalquiler (con autorización escrita)"],
                ["permite_mascotas", "Permite mascotas"],
              ] as const).map(([name, label]) => (
                <div key={name} className="flex items-center gap-3">
                  <Controller
                    name={name}
                    control={control}
                    render={({ field }) => (
                      <Checkbox
                        id={name}
                        checked={!!field.value}
                        onCheckedChange={field.onChange}
                      />
                    )}
                  />
                  <Label htmlFor={name} className="cursor-pointer text-sm">{label}</Label>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* ── SECCIÓN G: Cláusulas adicionales ── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Cláusulas adicionales</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="clauses_text">Condiciones especiales</Label>
              <Textarea
                id="clauses_text"
                placeholder="Ingrese condiciones particulares no contempladas en las cláusulas estándar…"
                rows={4}
                {...register("clauses_text")}
              />
            </div>
            <div className="space-y-2 max-w-xs">
              <Label>Idioma del formulario de pago (inquilino)</Label>
              <Controller
                name="submission_language"
                control={control}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="es">Español</SelectItem>
                      <SelectItem value="en">English</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </CardContent>
        </Card>

        {/* ── SECCIÓN H: Garantías ── */}
        <GuarantorsSection value={guarantors} onChange={setGuarantors} />

        {/* ── Actions ── */}
        <div className="flex justify-end gap-3 pb-8">
          <Button type="button" variant="outline" onClick={() => navigate("/contracts")}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creando contrato…
              </>
            ) : (
              "Crear contrato"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
