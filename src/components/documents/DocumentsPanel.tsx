import { useEffect, useState, useRef } from "react";
import { Upload, FileText, Download, Trash2, Loader2, FolderOpen, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { openFileViaProxy, downloadFileViaProxy } from "@/lib/fileProxy";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export type DocScope = "property" | "contract";

const PROPERTY_DOC_TYPES: Record<string, string> = {
  titulo: "Título de propiedad",
  escritura: "Escritura",
  planos: "Planos",
  reglamento: "Reglamento de copropiedad",
  abl: "ABL / Impuesto inmobiliario",
  expensas: "Liquidación de expensas",
  seguro_prop: "Seguro de la propiedad",
  foto: "Fotos",
  otros: "Otros",
};

const CONTRACT_DOC_TYPES: Record<string, string> = {
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

interface Document {
  id: string;
  scope: DocScope;
  property_id: string | null;
  contract_id: string | null;
  doc_type: string;
  title: string;
  file_url: string;
  file_name: string | null;
  mime_type: string | null;
  file_size: number | null;
  notes: string | null;
  created_at: string;
}

interface DocumentsPanelProps {
  scope: DocScope;
  propertyId?: string;
  contractId?: string;
  /** storage bucket to use for direct uploads */
  bucket?: string;
}

const STORAGE_BUCKET = "documents";
const CONTRACT_BUCKET = "contract-documents";

const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15 MB
const ALLOWED_MIME = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getDocTypeLabels(scope: DocScope) {
  return scope === "property" ? PROPERTY_DOC_TYPES : CONTRACT_DOC_TYPES;
}

export function DocumentsPanel({ scope, propertyId, contractId }: DocumentsPanelProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [docs, setDocs] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [filterType, setFilterType] = useState("all");

  // Upload form state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [docType, setDocType] = useState("");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");

  const typeLabels = getDocTypeLabels(scope);

  useEffect(() => {
    if (user && (propertyId || contractId)) fetchDocs();
  }, [user, propertyId, contractId]);

  const fetchDocs = async () => {
    setLoading(true);
    try {
      let q = supabase
        .from("documents" as any)
        .select("*")
        .eq("scope", scope)
        .order("created_at", { ascending: false });

      if (scope === "property" && propertyId) q = q.eq("property_id", propertyId);
      if (scope === "contract" && contractId) q = q.eq("contract_id", contractId);

      const { data, error } = await q;
      if (error) throw error;
      setDocs(((data as unknown) as Document[]) || []);
    } catch (err) {
      console.error("fetchDocs error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) {
      toast({ title: "Archivo demasiado grande", description: "El máximo es 15 MB.", variant: "destructive" });
      return;
    }
    if (!ALLOWED_MIME.includes(file.type)) {
      toast({ title: "Formato no soportado", description: "Solo PDF, imágenes y documentos Word.", variant: "destructive" });
      return;
    }
    setSelectedFile(file);
    if (!title) setTitle(file.name.replace(/\.[^.]+$/, ""));
  };

  const handleUpload = async () => {
    if (!selectedFile || !docType || !title.trim()) {
      toast({ title: "Campos incompletos", description: "Seleccioná archivo, tipo y título.", variant: "destructive" });
      return;
    }
    if (!user) return;
    setUploading(true);
    try {
      // Build path and upload to storage
      const bucket = scope === "property" ? STORAGE_BUCKET : CONTRACT_BUCKET;
      const folder = scope === "property" ? propertyId : contractId;
      const ext = selectedFile.name.split(".").pop() ?? "bin";
      const timestamp = Date.now();
      const filePath = `${folder}/${timestamp}_${docType}.${ext}`;

      const { error: storageErr } = await supabase.storage
        .from(bucket)
        .upload(filePath, selectedFile, { upsert: false });
      if (storageErr) throw storageErr;

      // Insert record — store storage path, not public URL
      const insertPayload: Record<string, unknown> = {
        scope,
        doc_type: docType,
        title: title.trim(),
        file_url: filePath,
        file_name: selectedFile.name,
        mime_type: selectedFile.type,
        file_size: selectedFile.size,
        notes: notes.trim() || null,
        created_by: user.id,
      };
      if (scope === "property") insertPayload.property_id = propertyId;
      if (scope === "contract") insertPayload.contract_id = contractId;

      const { error: dbErr } = await supabase.from("documents" as any).insert(insertPayload as any);
      if (dbErr) throw dbErr;

      toast({ title: "Documento subido correctamente" });
      resetForm();
      setUploadOpen(false);
      fetchDocs();
    } catch (err: any) {
      console.error("upload error:", err);
      toast({ title: "Error al subir", description: err?.message || "Intentá de nuevo.", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (doc: Document) => {
    try {
      const bucket = scope === "property" ? STORAGE_BUCKET : CONTRACT_BUCKET;
      // file_url is stored as a plain storage path (not a full URL)
      const storagePath = doc.file_url.startsWith("http")
        ? (() => {
            const u = new URL(doc.file_url);
            const parts = u.pathname.split(`/${bucket}/`);
            return parts.length > 1 ? parts[1] : null;
          })()
        : doc.file_url;
      if (storagePath) {
        await supabase.storage.from(bucket).remove([storagePath]);
      }
      const { error } = await supabase.from("documents" as any).delete().eq("id", doc.id);
      if (error) throw error;
      toast({ title: "Documento eliminado" });
      setDocs((prev) => prev.filter((d) => d.id !== doc.id));
    } catch (err: any) {
      toast({ title: "Error al eliminar", description: err?.message, variant: "destructive" });
    }
  };

  const resetForm = () => {
    setSelectedFile(null);
    setDocType("");
    setTitle("");
    setNotes("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const filtered = filterType === "all" ? docs : docs.filter((d) => d.doc_type === filterType);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-44 h-8 text-sm">
            <SelectValue placeholder="Todos los tipos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los tipos</SelectItem>
            {Object.entries(typeLabels).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="ml-auto">
          <Dialog open={uploadOpen} onOpenChange={(o) => { setUploadOpen(o); if (!o) resetForm(); }}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Upload className="w-3.5 h-3.5 mr-1.5" />
                Subir documento
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Subir documento</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                {/* File */}
                <div className="space-y-1">
                  <Label>Archivo *</Label>
                  <Input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.webp,.gif,.doc,.docx"
                    onChange={handleFileChange}
                    className="cursor-pointer"
                  />
                  {selectedFile && (
                    <p className="text-xs text-muted-foreground">
                      {selectedFile.name} — {formatBytes(selectedFile.size)}
                    </p>
                  )}
                </div>

                {/* Type */}
                <div className="space-y-1">
                  <Label>Tipo de documento *</Label>
                  <Select value={docType} onValueChange={setDocType}>
                    <SelectTrigger><SelectValue placeholder="Seleccioná el tipo…" /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(typeLabels).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Title */}
                <div className="space-y-1">
                  <Label>Título *</Label>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Ej: Contrato firmado Oct 2024"
                  />
                </div>

                {/* Notes */}
                <div className="space-y-1">
                  <Label>Notas (opcional)</Label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Cualquier observación relevante…"
                    rows={2}
                  />
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <Button variant="outline" onClick={() => setUploadOpen(false)}>Cancelar</Button>
                  <Button onClick={handleUpload} disabled={uploading || !selectedFile || !docType || !title.trim()}>
                    {uploading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Subiendo…</> : "Subir"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title="Sin documentos"
          description={filterType === "all"
            ? "Todavía no hay documentos en esta sección. Subí el primero."
            : "No hay documentos de este tipo. Probá con otro filtro o subí uno nuevo."}
          compact
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center gap-3 p-3 rounded-lg border border-border/60 bg-card hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-center justify-center w-9 h-9 rounded-md bg-primary/10 text-primary shrink-0">
                <FileText className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{doc.title}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <Badge variant="outline" className="text-xs py-0">
                    {typeLabels[doc.doc_type] || doc.doc_type}
                  </Badge>
                  {doc.file_size && (
                    <span className="text-xs text-muted-foreground">{formatBytes(doc.file_size)}</span>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {new Date(doc.created_at).toLocaleDateString("es-AR")}
                  </span>
                </div>
                {doc.notes && (
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{doc.notes}</p>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  title="Ver / Abrir"
                  onClick={() => {
                    const bucket = scope === "property" ? "documents" : "contract-documents";
                    openFileViaProxy(bucket, doc.file_url);
                  }}
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  title="Descargar"
                  onClick={() => {
                    const bucket = scope === "property" ? "documents" : "contract-documents";
                    downloadFileViaProxy(bucket, doc.file_url, doc.file_name ?? doc.title);
                  }}
                >
                  <Download className="w-3.5 h-3.5" />
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>¿Eliminar documento?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Se eliminará "<strong>{doc.title}</strong>" de forma permanente. Esta acción no se puede deshacer.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        onClick={() => handleDelete(doc)}
                      >
                        Eliminar
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
