import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Loader2, Building2, User, Calendar, DollarSign,
  TrendingUp, Shield, CheckSquare, Home, AlertTriangle,
  UserCircle2, ChevronDown, ChevronRight, Package
} from "lucide-react";
import { GuarantorsSection, type GuarantorEntry } from "@/components/contracts/GuarantorsSection";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useProject } from "@/contexts/ProjectContext";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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

interface PropertyOwner {
  id: string;
  owner_id: string;
  ownership_percent: number | null;
  role: string | null;
  owners: {
    id: string;
    full_name: string;
    dni_cuit: string | null;
    address: string | null;
    email: string | null;
    phone: string | null;
  };
}

const CONTRACT_TYPES = [
  { value: "permanente", label: "🏠 Permanente / Habitacional", description: "Contrato de alquiler permanente" },
  { value: "temporario", label: "⏱ Temporario / Turístico", description: "Contrato de alquiler temporario" },
  { value: "comercial", label: "🏢 Comercial", description: "Contrato de alquiler comercial" },
];

const INCLUDED_SERVICES = [
  { value: "luz", label: "Luz / Electricidad" },
  { value: "gas", label: "Gas" },
  { value: "agua", label: "Agua" },
  { value: "internet", label: "Internet / WiFi" },
  { value: "expensas", label: "Expensas" },
  { value: "cable", label: "Cable / TV" },
  { value: "limpieza", label: "Limpieza" },
];

const BOOKING_CHANNELS = [
  { value: "directo", label: "Directo" },
  { value: "airbnb", label: "Airbnb" },
  { value: "booking", label: "Booking.com" },
  { value: "otro", label: "Otro" },
];

const DEPOSIT_MODES = [
  { value: "required", label: "Depósito en garantía" },
  { value: "not_required", label: "No se requiere depósito" },
  { value: "platform_covered", label: "Cubierto por plataforma" },
];

const schema = z.object({
  property_id: z.string().min(1, "Propiedad requerida."),
  tenant_id: z.string().min(1, "Inquilino requerido."),
  tipo_contrato: z.string().default("permanente"),
  start_date: z.string().min(1, "Fecha de inicio requerida."),
  end_date: z.string().min(1, "Fecha de fin requerida."),
  // Precio
  currency: z.string().default("ARS"),
  price_mode: z.string().default("mensual"),
  initial_rent: z.number({ invalid_type_error: "Monto requerido." }).min(0.01),
  rent_due_day: z.number().min(1).max(28).default(5),
  // Canal / plataforma (solo temporario)
  booking_channel: z.string().default("directo"),
  // Depósito
  deposit_mode: z.string().default("required"),
  currency_deposit: z.string().default("ARS"),
  deposit: z.number().optional().nullable(),
  deposit_type: z.string().default("monto_fijo"),
  // Actualización de precio
  has_price_update: z.boolean().default(false),
  adjustment_type: z.string().default("ipc"),
  adjustment_frequency: z.number().default(4),
  update_percentage: z.number().optional().nullable(),
  index_notes: z.string().optional().nullable(),
  // Seguro
  usa_seguro: z.boolean().default(true),
  seguro_tipo: z.string().default("caucion"),
  seguro_obligatorio: z.boolean().default(true),
  tenant_insurance_notes: z.string().optional().nullable(),
  // Condiciones
  expensas_ordinarias: z.boolean().default(true),
  expensas_extraordinarias: z.boolean().default(false),
  impuestos_a_cargo_locatario: z.boolean().default(false),
  permite_subalquiler: z.boolean().default(false),
  permite_mascotas: z.boolean().default(false),
  // Otros
  clauses_text: z.string().optional().nullable(),
  submission_language: z.string().default("es"),
}).refine((d) => new Date(d.end_date) > new Date(d.start_date), {
  message: "La fecha de fin debe ser posterior a la de inicio.",
  path: ["end_date"],
});

type FormData = z.infer<typeof schema>;

// ── Section wrapper with collapse ──
function Section({
  icon: Icon,
  title,
  badge,
  children,
  defaultOpen = true,
}: {
  icon: React.ElementType;
  title: string;
  badge?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="pb-3 cursor-pointer select-none hover:bg-muted/30 transition-colors rounded-t-lg">
            <CardTitle className="flex items-center justify-between text-base">
              <span className="flex items-center gap-2">
                <Icon className="w-4 h-4 text-primary" />
                {title}
                {badge && <Badge variant="secondary" className="text-xs">{badge}</Badge>}
              </span>
              {open ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
            </CardTitle>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-4 pt-0">
            {children}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

export default function ContractNew() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [guarantors, setGuarantors] = useState<GuarantorEntry[]>([]);
  const [propertyOwners, setPropertyOwners] = useState<PropertyOwner[]>([]);
  const [ownersLoading, setOwnersLoading] = useState(false);
  const [includedServices, setIncludedServices] = useState<string[]>([]);
  const { user } = useAuth();
  const { activeProjectId } = useProject();
  const navigate = useNavigate();
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    trigger,
    formState: { errors, isSubmitted },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    mode: "onBlur",
    reValidateMode: "onChange",
    defaultValues: {
      tipo_contrato: "permanente",
      currency: "ARS",
      currency_deposit: "ARS",
      price_mode: "mensual",
      booking_channel: "directo",
      deposit_mode: "required",
      deposit_type: "monto_fijo",
      has_price_update: false,
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

  const watchTipoContrato = watch("tipo_contrato");
  const watchUsaSeguro = watch("usa_seguro");
  const watchPropertyId = watch("property_id");
  const watchHasPriceUpdate = watch("has_price_update");
  const watchAdjustmentType = watch("adjustment_type");
  const watchDepositType = watch("deposit_type");
  const watchPriceMode = watch("price_mode");
  const watchDepositMode = watch("deposit_mode");
  const watchBookingChannel = watch("booking_channel");

  const isTemporario = watchTipoContrato === "temporario";
  const isPermanente = watchTipoContrato === "permanente";
  const isComercial = watchTipoContrato === "comercial";

  // Reset fields when contract type changes
  useEffect(() => {
    if (isTemporario) {
      setValue("has_price_update", false);
      setValue("adjustment_type", "manual");
    } else {
      setValue("price_mode", "mensual");
      setValue("booking_channel", "directo");
      setValue("deposit_mode", "required");
    }
  }, [watchTipoContrato, setValue, isTemporario]);

  // Auto-set deposit_mode when booking_channel = airbnb (for temporario)
  useEffect(() => {
    if (!isTemporario) return;
    if (watchBookingChannel === "airbnb") {
      setValue("deposit_mode", "platform_covered");
    } else if (watchDepositMode === "platform_covered") {
      setValue("deposit_mode", "required");
    }
  }, [watchBookingChannel, isTemporario, setValue, watchDepositMode]);

  const contractTitle = isTemporario
    ? "Contrato de alquiler temporario"
    : isComercial
    ? "Contrato de alquiler comercial"
    : "Contrato de alquiler";

  const priceModeOptions = isTemporario
    ? [
        { value: "diario", label: "Precio por día" },
        { value: "semanal", label: "Precio por semana" },
        { value: "mensual", label: "Precio mensual" },
        { value: "total_estadia", label: "Precio total de estadía" },
      ]
    : [{ value: "mensual", label: "Precio mensual" }];

  const priceModeLabel = {
    diario: "Precio por día",
    semanal: "Precio por semana",
    mensual: "Monto mensual",
    total_estadia: "Precio total de estadía",
  }[watchPriceMode] ?? "Monto de alquiler";

  // Fetch property owners
  const fetchPropertyOwners = useCallback(async (propertyId: string) => {
    if (!propertyId) { setPropertyOwners([]); return; }
    setOwnersLoading(true);
    try {
      const { data, error } = await supabase
        .from("property_owners")
        .select("id, owner_id, ownership_percent, role, owners(id, full_name, dni_cuit, address, email, phone)")
        .eq("property_id", propertyId)
        .order("created_at");
      if (error) {
        console.error("fetchPropertyOwners error for property", propertyId, error);
        throw error;
      }
      console.log("fetchPropertyOwners result for", propertyId, "→", data?.length, "owners");
      setPropertyOwners((data as any[]) || []);
    } catch (err) {
      console.error("Error loading property owners:", err);
      setPropertyOwners([]);
    } finally {
      setOwnersLoading(false);
    }
  }, []);

  useEffect(() => { fetchPropertyOwners(watchPropertyId || ""); }, [watchPropertyId, fetchPropertyOwners]);

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

  const toggleService = (val: string) => {
    setIncludedServices((prev) =>
      prev.includes(val) ? prev.filter((s) => s !== val) : [...prev, val]
    );
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
        const s = new Date(c.start_date); const e = new Date(c.end_date);
        return newStart <= e && newEnd >= s;
      });

      if (hasOverlap) {
        toast({ title: "Conflicto de fechas", description: "La propiedad ya tiene un contrato activo para ese período.", variant: "destructive" });
        setIsSubmitting(false);
        return;
      }

      // Token will be generated server-side after contract creation

      // For temporario: no price updates
      const effectiveHasPriceUpdate = isTemporario ? false : data.has_price_update;
      const effectiveAdjustmentType = effectiveHasPriceUpdate ? data.adjustment_type : "manual";
      const effectiveAdjustmentFrequency = effectiveHasPriceUpdate ? data.adjustment_frequency : null;

      const { data: created, error } = await supabase
        .from("contracts")
        .insert({
          project_id: activeProjectId!,
          property_id: data.property_id,
          tenant_id: data.tenant_id,
          tipo_contrato: data.tipo_contrato,
          start_date: data.start_date,
          end_date: data.end_date,
          currency: data.currency,
          price_mode: data.price_mode,
          initial_rent: data.initial_rent,
          current_rent: data.initial_rent,
          rent_due_day: data.rent_due_day,
          currency_deposit: data.deposit_mode === "required" ? data.currency_deposit : null,
          deposit: data.deposit_mode === "required" ? (data.deposit ?? null) : null,
          deposit_type: data.deposit_type,
          booking_channel: isTemporario ? data.booking_channel : null,
          deposit_mode: data.deposit_mode,
          has_price_update: effectiveHasPriceUpdate,
          adjustment_type: effectiveAdjustmentType,
          adjustment_frequency: effectiveAdjustmentFrequency,
          update_percentage: data.update_percentage ?? null,
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
          // Token generated server-side below
          token_status: "active",
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

      // Save included services (for temporario)
      if (isTemporario && includedServices.length > 0) {
        const serviceRows = includedServices.map((svc) => ({
          contract_id: created.id,
          service_type: svc,
          active: true,
          due_day: null,
          expected_amount: null,
        }));
        await supabase.from("contract_services").insert(serviceRows as any);
      }

      // Fire-and-forget helpers
      await Promise.allSettled([
        supabase.functions.invoke("generate-rent-dues", { body: { contract_id: created.id } }),
        supabase.from("tenancy_links").insert({
          property_id: data.property_id,
          tenant_id: data.tenant_id,
          start_date: data.start_date,
          end_date: data.end_date,
        } as any),
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

  const missingOwners = !!(watchPropertyId && !ownersLoading && propertyOwners.length === 0);
  const hasFormErrors = Object.keys(errors).length > 0;
  const canSubmit = !isSubmitting && !missingOwners;

  // Human-readable error labels
  const errorLabels: Record<string, string> = {
    property_id: "Propiedad",
    tenant_id: "Inquilino",
    start_date: "Fecha de inicio",
    end_date: "Fecha de fin",
    initial_rent: "Monto de alquiler",
    price_mode: "Modalidad de precio",
    currency: "Moneda",
    rent_due_day: "Día de vencimiento",
    tipo_contrato: "Tipo de contrato",
    deposit_mode: "Modalidad de depósito",
    adjustment_type: "Índice de actualización",
    adjustment_frequency: "Frecuencia de ajuste",
  };

  const scrollToFirstError = () => {
    setTimeout(() => {
      const firstErrorEl = document.querySelector("[data-field-error='true']");
      if (firstErrorEl) {
        firstErrorEl.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 100);
  };

  return (
    <div>
      <Button variant="ghost" size="sm" className="mb-4" onClick={() => navigate("/contracts")}>
        <ArrowLeft className="w-4 h-4 mr-2" />
        Volver a contratos
      </Button>

      <PageHeader
        title={contractTitle}
        description="Complete los datos para registrar el contrato de locación"
      />

      <form onSubmit={handleSubmit(onSubmit, (validationErrors) => {
        console.error("Form validation errors:", validationErrors);
        const errorCount = Object.keys(validationErrors).length;
        toast({
          title: "Revisá los campos marcados",
          description: `Hay ${errorCount} campo${errorCount > 1 ? "s" : ""} con errores que debés corregir.`,
          variant: "destructive",
        });
        scrollToFirstError();
      })} className="space-y-4 max-w-3xl">

        {/* ── SECCIÓN 1: Tipo de contrato ── */}
        <Section icon={Building2} title="Tipo de contrato">
          <div className="space-y-3">
            <Label>Tipo de contrato *</Label>
            <div className="grid gap-3 sm:grid-cols-3">
              {CONTRACT_TYPES.map((ct) => (
                <label
                  key={ct.value}
                  className={`flex flex-col gap-1 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                    watchTipoContrato === ct.value
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/40"
                  }`}
                >
                  <Controller
                    name="tipo_contrato"
                    control={control}
                    render={({ field }) => (
                      <input
                        type="radio"
                        className="sr-only"
                        value={ct.value}
                        checked={field.value === ct.value}
                        onChange={() => field.onChange(ct.value)}
                      />
                    )}
                  />
                  <span className="font-medium text-sm">{ct.label}</span>
                  <span className="text-xs text-muted-foreground">{ct.description}</span>
                </label>
              ))}
            </div>
          </div>
        </Section>

        {/* ── SECCIÓN 2: Partes ── */}
        <Section icon={User} title="Partes del contrato">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2" data-field-error={!!errors.property_id || undefined}>
              <Label>Propiedad *</Label>
              <Controller
                name="property_id"
                control={control}
                render={({ field }) => (
                  <Select onValueChange={(v) => { field.onChange(v); trigger("property_id"); }} value={field.value ?? ""}>
                    <SelectTrigger className={errors.property_id ? "border-destructive" : ""}>
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
              {errors.property_id && <p className="text-xs text-destructive">{errors.property_id.message || "Seleccioná una propiedad."}</p>}
            </div>
            <div className="space-y-2" data-field-error={!!errors.tenant_id || undefined}>
              <Label>Inquilino *</Label>
              <Controller
                name="tenant_id"
                control={control}
                render={({ field }) => (
                  <Select onValueChange={(v) => { field.onChange(v); trigger("tenant_id"); }} value={field.value ?? ""}>
                    <SelectTrigger className={errors.tenant_id ? "border-destructive" : ""}>
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
              {errors.tenant_id && <p className="text-xs text-destructive">{errors.tenant_id.message || "Seleccioná un inquilino."}</p>}
            </div>
          </div>

          {/* Propietarios auto-cargados */}
          {watchPropertyId && (
            <>
              <Separator />
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <UserCircle2 className="w-4 h-4 text-primary" />
                  <Label className="text-sm font-semibold">
                    {propertyOwners.length > 1 ? "Propietarios (Locadores)" : "Propietario (Locador)"}
                  </Label>
                  {ownersLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
                </div>

                {!ownersLoading && propertyOwners.length === 0 && (
                  <Alert variant="destructive" className="py-2">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription className="text-xs">
                      Esta propiedad no tiene propietarios asignados. Asigná al menos 1 en la ficha de la propiedad → pestaña <strong>Propietarios</strong>.
                    </AlertDescription>
                  </Alert>
                )}

                {!ownersLoading && propertyOwners.length > 0 && (
                  <div className="space-y-2">
                    {propertyOwners.map((link, idx) => (
                      <div key={link.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/40 border border-border/50">
                        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0 mt-0.5">
                          {idx + 1}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm">{link.owners?.full_name}</span>
                            {link.role && <Badge variant="outline" className="text-xs capitalize">{link.role}</Badge>}
                            {link.ownership_percent != null && (
                              <Badge variant="secondary" className="text-xs">{link.ownership_percent}%</Badge>
                            )}
                          </div>
                          {link.owners?.dni_cuit && (
                            <p className="text-xs text-muted-foreground">DNI/CUIT: {link.owners.dni_cuit}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </Section>

        {/* ── SECCIÓN 3: Fechas ── */}
        <Section icon={Calendar} title="Plazo del contrato">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2" data-field-error={!!errors.start_date || undefined}>
              <Label htmlFor="start_date">Fecha de inicio *</Label>
              <Input type="date" id="start_date" className={errors.start_date ? "border-destructive" : ""} {...register("start_date")} />
              {errors.start_date && <p className="text-xs text-destructive">{errors.start_date.message || "Fecha de inicio requerida."}</p>}
            </div>
            <div className="space-y-2" data-field-error={!!errors.end_date || undefined}>
              <Label htmlFor="end_date">
                {isTemporario ? "Fecha de fin (check-out) *" : "Fecha de vencimiento *"}
              </Label>
              <Input type="date" id="end_date" className={errors.end_date ? "border-destructive" : ""} {...register("end_date")} />
              {errors.end_date && <p className="text-xs text-destructive">{errors.end_date.message || "Fecha de fin requerida."}</p>}
            </div>
          </div>
        </Section>

        {/* ── SECCIÓN 4: Precio ── */}
        <Section icon={DollarSign} title="Precio">
          {/* Modalidad solo para temporario */}
          {isTemporario && (
            <div className="space-y-2">
              <Label>Modalidad de precio</Label>
              <Controller
                name="price_mode"
                control={control}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {priceModeOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          )}

          {/* Canal / Plataforma — solo temporario */}
          {isTemporario && (
            <div className="space-y-2">
              <Label>Canal / Plataforma de reserva</Label>
              <Controller
                name="booking_channel"
                control={control}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {BOOKING_CHANNELS.map((ch) => (
                        <SelectItem key={ch.value} value={ch.value}>{ch.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          )}

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
            <div className="space-y-2 sm:col-span-2" data-field-error={!!errors.initial_rent || undefined}>
              <Label htmlFor="initial_rent">{priceModeLabel} *</Label>
              <Input
                type="number"
                id="initial_rent"
                step="0.01"
                min="0"
                placeholder="0,00"
                className={errors.initial_rent ? "border-destructive" : ""}
                {...register("initial_rent", { valueAsNumber: true })}
              />
              {errors.initial_rent && <p className="text-xs text-destructive">{errors.initial_rent.message || "Ingresá un monto válido mayor a 0."}</p>}
            </div>
          </div>

          {/* Día de vencimiento solo si es mensual */}
          {watchPriceMode === "mensual" && (
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
          )}

          <Separator />

          {/* Depósito */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold">Depósito / Garantía</Label>

            {/* Selector deposit_mode */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Modalidad</Label>
              <Controller
                name="deposit_mode"
                control={control}
                render={({ field }) => (
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                    disabled={isTemporario && watchBookingChannel === "airbnb"}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DEPOSIT_MODES.map((dm) => (
                        <SelectItem key={dm.value} value={dm.value}>{dm.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            {/* Mensaje informativo cuando está cubierto por plataforma */}
            {watchDepositMode === "platform_covered" && (
              <Alert>
                <AlertDescription className="text-sm">
                  La garantía está cubierta por la plataforma de reserva
                  {watchBookingChannel === "airbnb" ? " (Airbnb)" : watchBookingChannel === "booking" ? " (Booking.com)" : ""}.
                  No se requiere depósito en efectivo del inquilino.
                </AlertDescription>
              </Alert>
            )}

            {/* Campos de monto/moneda solo si deposit_mode = required */}
            {watchDepositMode === "required" && (
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Tipo de depósito</Label>
                  <Controller
                    name="deposit_type"
                    control={control}
                    render={({ field }) => (
                      <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="monto_fijo">Monto fijo</SelectItem>
                          <SelectItem value="equivalente_meses">Equivalente en meses</SelectItem>
                          <SelectItem value="equivalente_dias">Equivalente en días</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Moneda</Label>
                  <Controller
                    name="currency_deposit"
                    control={control}
                    render={({ field }) => (
                      <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ARS">🇦🇷 ARS</SelectItem>
                          <SelectItem value="USD">🇺🇸 USD</SelectItem>
                          <SelectItem value="EUR">🇪🇺 EUR</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">
                    {watchDepositType === "monto_fijo"
                      ? "Monto"
                      : watchDepositType === "equivalente_meses"
                      ? "Cantidad de meses"
                      : "Cantidad de días"}
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0,00"
                    {...register("deposit", { valueAsNumber: true })}
                  />
                </div>
              </div>
            )}
          </div>
        </Section>

        {/* ── SECCIÓN 5: Actualización de precio ── */}
        {isTemporario ? (
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-start gap-3 text-muted-foreground">
                <TrendingUp className="w-4 h-4 mt-0.5 shrink-0" />
                <p className="text-sm">
                  Los contratos temporarios no contemplan actualización periódica de precio.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Section icon={TrendingUp} title="Actualización de precio" defaultOpen={false}>
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium">¿El contrato tiene actualización de precio?</Label>
                <p className="text-xs text-muted-foreground mt-0.5">Activá si el alquiler se actualiza según un índice o porcentaje fijo.</p>
              </div>
              <Controller
                name="has_price_update"
                control={control}
                render={({ field }) => (
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                )}
              />
            </div>

            {watchHasPriceUpdate && (
              <>
                <Separator />
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

                {watchAdjustmentType === "fixed" && (
                  <div className="space-y-2 max-w-xs">
                    <Label htmlFor="update_percentage">Porcentaje de actualización (%)</Label>
                    <Input
                      type="number"
                      id="update_percentage"
                      step="0.01"
                      min="0"
                      placeholder="ej: 5.5"
                      {...register("update_percentage", { valueAsNumber: true })}
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="index_notes">Notas sobre actualización</Label>
                  <Input
                    id="index_notes"
                    placeholder="Ej: aplicar según publicación INDEC del mes anterior"
                    {...register("index_notes")}
                  />
                </div>
              </>
            )}
          </Section>
        )}

        {/* ── SECCIÓN 6: Servicios incluidos (solo temporario) ── */}
        {isTemporario && (
          <Section icon={Package} title="Servicios incluidos" badge="Temporario" defaultOpen={true}>
            <p className="text-xs text-muted-foreground">Seleccioná los servicios que están incluidos en el precio.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {INCLUDED_SERVICES.map((svc) => (
                <div key={svc.value} className="flex items-center gap-3">
                  <Checkbox
                    id={`svc_${svc.value}`}
                    checked={includedServices.includes(svc.value)}
                    onCheckedChange={() => toggleService(svc.value)}
                  />
                  <Label htmlFor={`svc_${svc.value}`} className="cursor-pointer text-sm">{svc.label}</Label>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* ── SECCIÓN 7: Seguro ── */}
        <Section icon={Shield} title="Seguro del inquilino" defaultOpen={false}>
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Requiere seguro por parte del inquilino</Label>
              <p className="text-xs text-muted-foreground mt-0.5">Puede ser caución, incendio o integral.</p>
            </div>
            <Controller
              name="usa_seguro"
              control={control}
              render={({ field }) => (
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              )}
            />
          </div>

          {watchUsaSeguro && (
            <>
              <Separator />
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
                <div className="flex items-center gap-3 pt-6">
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
        </Section>

        {/* ── SECCIÓN 8: Condiciones ── */}
        <Section icon={CheckSquare} title="Condiciones del contrato" defaultOpen={false}>
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
        </Section>

        {/* ── SECCIÓN 9: Cláusulas y configuración ── */}
        <Section icon={Home} title="Cláusulas y configuración" defaultOpen={false}>
          <div className="space-y-2">
            <Label htmlFor="clauses_text">Condiciones especiales / notas</Label>
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
        </Section>

        {/* ── SECCIÓN 10: Garantías ── */}
        <GuarantorsSection value={guarantors} onChange={setGuarantors} />

        {/* ── Bloque de problemas a corregir ── */}
        {(missingOwners || (isSubmitted && hasFormErrors)) && (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardContent className="pt-4 pb-4 space-y-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-destructive" />
                <span className="text-sm font-semibold text-destructive">
                  Problemas a corregir
                  {(isSubmitted && hasFormErrors) && (
                    <span className="font-normal text-muted-foreground ml-1">
                      ({Object.keys(errors).length + (missingOwners ? 1 : 0)})
                    </span>
                  )}
                </span>
              </div>
              <ul className="space-y-1 text-sm text-destructive/90">
                {missingOwners && (
                  <li className="flex items-center justify-between gap-2">
                    <span>• La propiedad seleccionada no tiene propietarios asignados.</span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="shrink-0 text-xs h-7"
                      onClick={() => navigate(`/properties/${watchPropertyId}`)}
                    >
                      Asignar propietario →
                    </Button>
                  </li>
                )}
                {isSubmitted && Object.entries(errors).map(([key, err]) => (
                  <li key={key}>• {errorLabels[key] || key}: {err?.message || "campo inválido"}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        <div className="flex items-center justify-between gap-3 pb-8 flex-wrap">
          <div className="text-sm text-muted-foreground">
            {!canSubmit && !isSubmitting && (
              <span className="text-destructive">
                No podés crear el contrato: {missingOwners ? "falta asignar propietario a la propiedad." : "corregí los errores marcados."}
              </span>
            )}
          </div>
          <div className="flex gap-3">
            <Button type="button" variant="outline" onClick={() => navigate("/contracts")}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!canSubmit}>
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
        </div>
      </form>
    </div>
  );
}
