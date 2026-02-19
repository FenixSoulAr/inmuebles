import { useEffect, useState, useRef } from "react";
import {
  FolderOpen, Upload, Eye, Download, Archive, Trash2,
  FileText, FileImage, File, Loader2, Plus,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { openFileViaProxy, downloadFileViaProxy } from "@/lib/fileProxy";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

const DOC_TYPE_OPTIONS = [
  { value: "signed_contract", label: "Contrato firmado" },
  { value: "annex", label: "Anexo" },
  { value: "inventory", label: "Inventario" },
  { value: "guarantee", label: "Garantía" },
  { value: "id_docs", label: "Documentación personal" },
  { value: "payment_agreement", label: "Acuerdo de pago" },
  { value: "other", label: "Otro" },
];

const DOC_TYPE_COLORS: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  signed_contract: "default",
  annex: "secondary",
  inventory: "secondary",
  guarantee: "outline",
  id_docs: "outline",
  payment_agreement: "secondary",
  other: "outline",
};

interface ContractDoc {
  id: string;
  contract_id: string;
  title: string;
  doc_type: string;
  file_url: string;
  file_name: string | null;
  file_size: number | null;
  mime_type: string | null;
  uploaded_at: string;
  notes: string | null;
  status: string;
  version: number | null;
  is_primary: boolean | null;
}

interface ContractDocumentsProps {
  contractId: string;
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function DocTypeIcon({ mimeType }: { mimeType: string | null }) {
  if (!mimeType) return <File className="w-4 h-4 text-muted-foreground" />;
  if (mimeType.startsWith("image/")) return <FileImage className="w-4 h-4 text-primary" />;
  if (mimeType === "application/pdf") return <FileText className="w-4 h-4 text-destructive" />;
  return <File className="w-4 h-4 text-muted-foreground" />;
}

export function ContractDocuments({ contractId }: ContractDocumentsProps) {
  const { toast } = useToast();
  const { user } = useAuth();

  const [docs, setDocs] = useState<ContractDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ContractDoc | null>(null);
  const [uploading, setUploading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    title: "",
    doc_type: "other",
    notes: "",
    file: null as File | null,
  });

  const fetchDocs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("contract_documents" as any)
        .select("*")
        .eq("contract_id", contractId)
        .eq("status", "active")
        .order("uploaded_at", { ascending: false });

      if (error) throw error;
      setDocs((data as unknown as ContractDoc[]) || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (contractId) fetchDocs();
  }, [contractId]);

  const handleUpload = async () => {
    if (!form.file || !form.title.trim()) {
      toast({ title: "Campos requeridos", description: "Título y archivo son obligatorios.", variant: "destructive" });
      return;
    }

    setUploading(true);
    try {
      const ext = form.file.name.split(".").pop();
      const path = `${contractId}/${Date.now()}_${form.file.name}`;

      const { error: storageError } = await supabase.storage
        .from("contract-documents")
        .upload(path, form.file, { upsert: false });

      if (storageError) throw storageError;

      const { error: dbError } = await supabase
        .from("contract_documents" as any)
        .insert({
          contract_id: contractId,
          title: form.title.trim(),
          doc_type: form.doc_type,
          file_url: path,
          file_name: form.file.name,
          file_size: form.file.size,
          mime_type: form.file.type,
          notes: form.notes || null,
          uploaded_by: user?.id || null,
          is_primary: form.doc_type === "signed_contract",
        });

      if (dbError) throw dbError;

      toast({ title: "Documento subido", description: `"${form.title}" agregado al contrato.` });
      setUploadOpen(false);
      setForm({ title: "", doc_type: "other", notes: "", file: null });
      if (fileInputRef.current) fileInputRef.current.value = "";
      fetchDocs();
    } catch (err: any) {
      console.error(err);
      toast({ title: "Error al subir", description: err.message || "Error desconocido.", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleArchive = async (doc: ContractDoc) => {
    try {
      const { error } = await supabase
        .from("contract_documents" as any)
        .update({ status: "archived" })
        .eq("id", doc.id);

      if (error) throw error;
      toast({ title: "Archivado", description: `"${doc.title}" fue archivado.` });
      fetchDocs();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const { error } = await supabase
        .from("contract_documents" as any)
        .delete()
        .eq("id", deleteTarget.id);

      if (error) throw error;
      toast({ title: "Eliminado", description: `"${deleteTarget.title}" fue eliminado.` });
      setDeleteTarget(null);
      fetchDocs();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const getDocTypeLabel = (type: string) =>
    DOC_TYPE_OPTIONS.find((o) => o.value === type)?.label || type;

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <FolderOpen className="w-4 h-4" />
              Documentación del contrato
            </CardTitle>
            <Button size="sm" onClick={() => setUploadOpen(true)}>
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              Subir documento
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : docs.length === 0 ? (
            <div className="text-center py-10 space-y-3">
              <FolderOpen className="w-10 h-10 mx-auto text-muted-foreground/40" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Sin documentos adjuntos</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Sube el contrato firmado, anexos, inventarios y más.
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={() => setUploadOpen(true)}>
                <Upload className="w-3.5 h-3.5 mr-1.5" />
                Subir primer documento
              </Button>
            </div>
          ) : (
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="w-8 py-2"></TableHead>
                    <TableHead className="py-2">Tipo</TableHead>
                    <TableHead className="py-2">Título</TableHead>
                    <TableHead className="py-2 hidden sm:table-cell">Fecha</TableHead>
                    <TableHead className="py-2 hidden md:table-cell">Tamaño</TableHead>
                    <TableHead className="py-2 text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {docs.map((doc) => (
                    <TableRow key={doc.id}>
                      <TableCell className="py-2 pr-0">
                        <DocTypeIcon mimeType={doc.mime_type} />
                      </TableCell>
                      <TableCell className="py-2">
                        <Badge variant={DOC_TYPE_COLORS[doc.doc_type] || "outline"} className="text-xs whitespace-nowrap">
                          {getDocTypeLabel(doc.doc_type)}
                        </Badge>
                        {doc.is_primary && (
                          <Badge variant="secondary" className="text-xs ml-1">Principal</Badge>
                        )}
                      </TableCell>
                      <TableCell className="py-2">
                        <p className="text-sm font-medium truncate max-w-[180px]">{doc.title}</p>
                        {doc.notes && (
                          <p className="text-xs text-muted-foreground truncate max-w-[180px]">{doc.notes}</p>
                        )}
                      </TableCell>
                      <TableCell className="py-2 hidden sm:table-cell text-sm text-muted-foreground whitespace-nowrap">
                        {new Date(doc.uploaded_at).toLocaleDateString("es-AR")}
                      </TableCell>
                      <TableCell className="py-2 hidden md:table-cell text-sm text-muted-foreground">
                        {formatFileSize(doc.file_size)}
                      </TableCell>
                      <TableCell className="py-2">
                        <div className="flex items-center gap-1 justify-end">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            title="Ver / Abrir"
                            onClick={() => openFileViaProxy("contract-documents", doc.file_url)}
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            title="Descargar"
                            onClick={() => downloadFileViaProxy("contract-documents", doc.file_url, doc.file_name || doc.title)}
                          >
                            <Download className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-muted-foreground"
                            title="Archivar"
                            onClick={() => handleArchive(doc)}
                          >
                            <Archive className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            title="Eliminar"
                            onClick={() => setDeleteTarget(doc)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upload Modal */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Subir documento del contrato</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Tipo de documento *</Label>
              <Select
                value={form.doc_type}
                onValueChange={(v) => setForm((p) => ({ ...p, doc_type: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DOC_TYPE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="doc-title">Título *</Label>
              <Input
                id="doc-title"
                placeholder="Ej: Contrato firmado Feb 2025"
                value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="doc-file">Archivo *</Label>
              <Input
                id="doc-file"
                type="file"
                ref={fileInputRef}
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp"
                onChange={(e) => setForm((p) => ({ ...p, file: e.target.files?.[0] || null }))}
              />
              <p className="text-xs text-muted-foreground">PDF, Word, imágenes (máx. 20MB)</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="doc-notes">Notas (opcional)</Label>
              <Textarea
                id="doc-notes"
                rows={2}
                placeholder="Notas o descripción adicional..."
                value={form.notes}
                onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadOpen(false)}>Cancelar</Button>
            <Button onClick={handleUpload} disabled={uploading}>
              {uploading ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Subiendo...</>
              ) : (
                <><Upload className="w-4 h-4 mr-2" />Subir</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar documento?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará <strong>"{deleteTarget?.title}"</strong> permanentemente. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
