import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Shield, AlertCircle, Loader2, ExternalLink, User, Building2, FileCheck
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/ui/page-header";
import { SearchBar } from "@/components/ui/search-bar";
import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface Guarantor {
  id: string;
  full_name: string;
  company_name: string | null;
  guarantee_type: string | null;
  document_or_cuit: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  insurance_policy_number: string | null;
  coverage_amount: number | null;
  insurance_valid_from: string | null;
  insurance_valid_to: string | null;
  notes: string | null;
  contract_id: string;
  sort_order: number | null;
  // joined
  contract_property?: string;
  contract_tenant?: string;
}

const GUARANTEE_TYPE_LABELS: Record<string, { label: string; icon: typeof Shield; color: string }> = {
  fiador_solidario:    { label: "Fiador solidario",     icon: User,       color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
  garantia_propietaria:{ label: "Garantía propietaria", icon: Building2,  color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" },
  seguro_caucion:      { label: "Seguro de caución",    icon: FileCheck,  color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" },
};

export default function Guarantors() {
  const [guarantors, setGuarantors] = useState<Guarantor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) fetchGuarantors();
  }, [user]);

  const fetchGuarantors = async () => {
    setError(null);
    try {
      // Fetch contract_guarantors joined with contract → property + tenant
      const { data, error } = await supabase
        .from("contract_guarantors" as any)
        .select(`
          *,
          contracts(
            id,
            properties(internal_identifier, full_address),
            tenants(full_name)
          )
        `)
        .order("sort_order");

      if (error) throw error;

      const mapped: Guarantor[] = ((data as any[]) || []).map((g: any) => ({
        id: g.id,
        full_name: g.full_name ?? "",
        company_name: g.company_name ?? null,
        guarantee_type: g.guarantee_type ?? null,
        document_or_cuit: g.document_or_cuit ?? null,
        address: g.address ?? null,
        phone: g.phone ?? null,
        email: g.email ?? null,
        insurance_policy_number: g.insurance_policy_number ?? null,
        coverage_amount: g.coverage_amount ?? null,
        insurance_valid_from: g.insurance_valid_from ?? null,
        insurance_valid_to: g.insurance_valid_to ?? null,
        notes: g.notes ?? null,
        contract_id: g.contract_id,
        sort_order: g.sort_order ?? null,
        contract_property: g.contracts?.properties?.internal_identifier ?? null,
        contract_tenant: g.contracts?.tenants?.full_name ?? null,
      }));

      setGuarantors(mapped);
    } catch (err: any) {
      console.error("Error fetching guarantors:", err);
      setError("No se pudieron cargar los garantes.");
    } finally {
      setLoading(false);
    }
  };

  const filtered = guarantors.filter((g) => {
    const q = search.toLowerCase();
    const matchesSearch =
      (g.full_name || "").toLowerCase().includes(q) ||
      (g.company_name || "").toLowerCase().includes(q) ||
      (g.document_or_cuit || "").toLowerCase().includes(q) ||
      (g.contract_property || "").toLowerCase().includes(q) ||
      (g.contract_tenant || "").toLowerCase().includes(q);
    const matchesType = typeFilter === "all" || g.guarantee_type === typeFilter;
    return matchesSearch && matchesType;
  });

  const fmtCurrency = (amount: number) =>
    new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 0 }).format(amount);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Garantes"
        description="Vista consolidada de todos los garantes registrados en contratos. Para agregar un garante, hacelo desde el detalle del contrato correspondiente."
      />

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {error}{" "}
            <button onClick={fetchGuarantors} className="underline ml-1">Reintentar</button>
          </AlertDescription>
        </Alert>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Buscar por nombre, DNI/CUIT, propiedad…"
          className="flex-1 max-w-md"
        />
        <div className="flex gap-2 flex-wrap">
          {["all", "fiador_solidario", "garantia_propietaria", "seguro_caucion"].map((type) => (
            <button
              key={type}
              onClick={() => setTypeFilter(type)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                typeFilter === type
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-muted-foreground border-border hover:bg-muted"
              }`}
            >
              {type === "all" ? "Todos" : GUARANTEE_TYPE_LABELS[type]?.label ?? type}
            </button>
          ))}
        </div>
      </div>

      {/* Stats row */}
      {guarantors.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          {(["fiador_solidario", "garantia_propietaria", "seguro_caucion"] as const).map((type) => {
            const count = guarantors.filter((g) => g.guarantee_type === type).length;
            const meta = GUARANTEE_TYPE_LABELS[type];
            const Icon = meta.icon;
            return (
              <div key={type} className="flex items-center gap-2 p-3 rounded-lg border bg-card">
                <span className={`p-1.5 rounded-md ${meta.color}`}>
                  <Icon className="w-4 h-4" />
                </span>
                <div>
                  <p className="text-lg font-semibold leading-none">{count}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{meta.label}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState
          icon={Shield}
          title={search || typeFilter !== "all" ? "Sin resultados" : "No hay garantes registrados"}
          description={
            search || typeFilter !== "all"
              ? "Ningún garante coincide con los filtros aplicados."
              : "Los garantes se gestionan desde el detalle de cada contrato, en la sección 'Garantías'. Una vez creados, aparecen aquí consolidados."
          }
          action={
            !search && typeFilter === "all"
              ? { label: "Ir a Contratos", onClick: () => navigate("/contracts") }
              : undefined
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((g) => {
            const meta = g.guarantee_type
              ? GUARANTEE_TYPE_LABELS[g.guarantee_type]
              : null;
            const Icon = meta?.icon ?? Shield;
            const displayName =
              g.guarantee_type === "seguro_caucion"
                ? g.company_name || g.full_name || "—"
                : g.full_name || g.company_name || "—";

            return (
              <Card key={g.id} className="group hover:shadow-md transition-shadow">
                <CardContent className="p-5">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`flex items-center justify-center w-10 h-10 rounded-full shrink-0 ${meta?.color ?? "bg-muted text-muted-foreground"}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="font-semibold leading-tight">{displayName}</p>
                        {g.document_or_cuit && (
                          <p className="text-xs text-muted-foreground">DNI/CUIT: {g.document_or_cuit}</p>
                        )}
                      </div>
                    </div>
                    {meta && (
                      <Badge variant="outline" className={`text-xs shrink-0 ${meta.color}`}>
                        {meta.label}
                      </Badge>
                    )}
                  </div>

                  {/* Details */}
                  <div className="space-y-1 text-xs text-muted-foreground">
                    {g.address && <p>📍 {g.address}</p>}
                    {g.phone && <p>📞 {g.phone}</p>}
                    {g.email && <p>✉ {g.email}</p>}
                    {g.guarantee_type === "seguro_caucion" && (
                      <>
                        {g.insurance_policy_number && <p>Póliza: {g.insurance_policy_number}</p>}
                        {g.coverage_amount != null && <p>Cobertura: {fmtCurrency(g.coverage_amount)}</p>}
                        {g.insurance_valid_to && (
                          <p>Vence: {new Date(g.insurance_valid_to + "T00:00:00").toLocaleDateString("es-AR")}</p>
                        )}
                      </>
                    )}
                    {g.notes && <p className="line-clamp-2 mt-1">{g.notes}</p>}
                  </div>

                  {/* Contract link */}
                  {(g.contract_property || g.contract_tenant) && (
                    <div className="mt-3 pt-3 border-t flex items-center justify-between">
                      <div className="text-xs text-muted-foreground">
                        {g.contract_property && <span className="font-medium">{g.contract_property}</span>}
                        {g.contract_tenant && <span> · {g.contract_tenant}</span>}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => navigate(`/contracts/${g.contract_id}`)}
                      >
                        <ExternalLink className="w-3 h-3 mr-1" />
                        Contrato
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
