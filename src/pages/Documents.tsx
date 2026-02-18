import { useEffect, useState } from "react";
import { FolderOpen, FileText, Download, Building2, FileCheck2, ExternalLink, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

const ALL_DOC_TYPES: Record<string, string> = {
  // property
  titulo: "Título de propiedad",
  escritura: "Escritura",
  planos: "Planos",
  reglamento: "Reglamento de copropiedad",
  abl: "ABL / Impuesto inmobiliario",
  expensas: "Liquidación de expensas",
  seguro_prop: "Seguro de la propiedad",
  foto: "Fotos",
  // contract
  contrato_pdf: "Contrato firmado",
  poliza_caucion: "Póliza de caución",
  dni_inquilino: "DNI del inquilino",
  dni_garante: "DNI del garante",
  inventario: "Inventario",
  acta_entrega: "Acta de entrega",
  acta_restitucion: "Acta de restitución",
  fotos_inicio: "Fotos de inicio",
  fotos_fin: "Fotos de fin de contrato",
  otros: "Otros",
};

interface Doc {
  id: string;
  scope: "property" | "contract";
  property_id: string | null;
  contract_id: string | null;
  doc_type: string;
  title: string;
  file_url: string;
  file_name: string | null;
  file_size: number | null;
  notes: string | null;
  created_at: string;
  // joined
  properties?: { internal_identifier: string; full_address: string } | null;
  contracts?: { id: string; start_date: string; end_date: string } | null;
}

function formatBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

export default function Documents() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [scopeFilter, setScopeFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  useEffect(() => {
    if (user) fetchDocs();
  }, [user]);

  const fetchDocs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("documents" as any)
        .select(`
          *,
          properties(internal_identifier, full_address),
          contracts(id, start_date, end_date)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setDocs(((data as unknown) as Doc[]) || []);
    } catch (err) {
      console.error("fetchDocs error:", err);
      toast({ title: "Error", description: "No se pudieron cargar los documentos.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const filtered = docs.filter((d) => {
    if (scopeFilter !== "all" && d.scope !== scopeFilter) return false;
    if (typeFilter !== "all" && d.doc_type !== typeFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const inTitle = d.title.toLowerCase().includes(q);
      const inProp = d.properties?.internal_identifier?.toLowerCase().includes(q) ?? false;
      const inAddr = d.properties?.full_address?.toLowerCase().includes(q) ?? false;
      if (!inTitle && !inProp && !inAddr) return false;
    }
    return true;
  });

  const scopeStats = {
    property: docs.filter((d) => d.scope === "property").length,
    contract: docs.filter((d) => d.scope === "contract").length,
  };

  return (
    <div>
      <PageHeader
        title="Documentos"
        description="Buscador global de documentos de propiedades y contratos."
      />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 mb-6 max-w-sm">
        <button
          onClick={() => setScopeFilter(scopeFilter === "property" ? "all" : "property")}
          className={`flex flex-col items-start p-3 rounded-xl border transition-colors text-left ${
            scopeFilter === "property"
              ? "border-primary bg-primary/5"
              : "border-border bg-card hover:bg-muted/40"
          }`}
        >
          <Building2 className="w-4 h-4 text-muted-foreground mb-1" />
          <span className="text-lg font-bold">{scopeStats.property}</span>
          <span className="text-xs text-muted-foreground">Propiedades</span>
        </button>
        <button
          onClick={() => setScopeFilter(scopeFilter === "contract" ? "all" : "contract")}
          className={`flex flex-col items-start p-3 rounded-xl border transition-colors text-left ${
            scopeFilter === "contract"
              ? "border-primary bg-primary/5"
              : "border-border bg-card hover:bg-muted/40"
          }`}
        >
          <FileCheck2 className="w-4 h-4 text-muted-foreground mb-1" />
          <span className="text-lg font-bold">{scopeStats.contract}</span>
          <span className="text-xs text-muted-foreground">Contratos</span>
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por título, propiedad…"
            className="pl-9"
          />
        </div>
        <Select value={scopeFilter} onValueChange={setScopeFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Ámbito" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los ámbitos</SelectItem>
            <SelectItem value="property">Propiedad</SelectItem>
            <SelectItem value="contract">Contrato</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-52">
            <SelectValue placeholder="Tipo de documento" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los tipos</SelectItem>
            {Object.entries(ALL_DOC_TYPES).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Results */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title="Sin resultados"
          description={
            docs.length === 0
              ? "No hay documentos todavía. Subí documentos desde la ficha de cada propiedad o contrato."
              : "No se encontraron documentos con los filtros aplicados."
          }
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((doc) => (
            <Card key={doc.id} className="hover:shadow-sm transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 text-primary shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm truncate">{doc.title}</p>
                      <Badge
                        variant={doc.scope === "property" ? "secondary" : "outline"}
                        className="text-xs shrink-0"
                      >
                        {doc.scope === "property" ? "Propiedad" : "Contrato"}
                      </Badge>
                      <Badge variant="outline" className="text-xs shrink-0">
                        {ALL_DOC_TYPES[doc.doc_type] || doc.doc_type}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground flex-wrap">
                      {doc.scope === "property" && doc.properties && (
                        <span className="flex items-center gap-1">
                          <Building2 className="w-3 h-3" />
                          {doc.properties.internal_identifier}
                        </span>
                      )}
                      {doc.scope === "contract" && doc.contracts && (
                        <span className="flex items-center gap-1">
                          <FileCheck2 className="w-3 h-3" />
                          Contrato {new Date(doc.contracts.start_date + "T00:00:00").toLocaleDateString("es-AR", { month: "short", year: "numeric" })}
                          {" → "}
                          {new Date(doc.contracts.end_date + "T00:00:00").toLocaleDateString("es-AR", { month: "short", year: "numeric" })}
                        </span>
                      )}
                      {doc.file_size && <span>{formatBytes(doc.file_size)}</span>}
                      <span>{new Date(doc.created_at).toLocaleDateString("es-AR")}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {doc.scope === "property" && doc.property_id && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-xs h-8"
                        onClick={() => navigate(`/properties/${doc.property_id}`)}
                      >
                        Ver propiedad
                      </Button>
                    )}
                    {doc.scope === "contract" && doc.contract_id && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-xs h-8"
                        onClick={() => navigate(`/contracts/${doc.contract_id}`)}
                      >
                        Ver contrato
                      </Button>
                    )}
                    <Button size="icon" variant="ghost" className="h-8 w-8" asChild>
                      <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8" asChild>
                      <a href={doc.file_url} download={doc.file_name ?? undefined}>
                        <Download className="w-3.5 h-3.5" />
                      </a>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
