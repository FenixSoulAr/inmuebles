import { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Upload, X, CheckCircle2, AlertTriangle, Building2, User, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

interface ContractInfo {
  contract_id: string;
  property: { internal_identifier: string; full_address: string };
  tenant: { full_name: string };
}

const SERVICE_TYPES = [
  { value: "expensas", labelEs: "Expensas", labelEn: "Building Fees" },
  { value: "abl", labelEs: "ABL", labelEn: "ABL" },
  { value: "luz", labelEs: "Luz", labelEn: "Electricity" },
  { value: "agua", labelEs: "Agua", labelEn: "Water" },
  { value: "gas", labelEs: "Gas", labelEn: "Gas" },
  { value: "internet", labelEs: "Internet", labelEn: "Internet" },
  { value: "seguro", labelEs: "Seguro", labelEn: "Insurance" },
  { value: "otro", labelEs: "Otro", labelEn: "Other" },
];

export default function PublicSubmit() {
  const { token } = useParams<{ token: string }>();
  const { t, i18n } = useTranslation();
  const isEs = i18n.language?.startsWith("es");

  const [contractInfo, setContractInfo] = useState<ContractInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [invalid, setInvalid] = useState(false);

  // Form state
  const [type, setType] = useState<"rent" | "service">("rent");
  const [serviceType, setServiceType] = useState("");
  const now = new Date();
  const [period, setPeriod] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
  const [amount, setAmount] = useState("");
  const [paidAt, setPaidAt] = useState(now.toISOString().split("T")[0]);
  const [comment, setComment] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [proofId, setProofId] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Duplicate state
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [existingProofId, setExistingProofId] = useState("");

  useEffect(() => {
    if (token) fetchContract();
  }, [token]);

  const fetchContract = async () => {
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-public-contract?token=${token}`;
      const response = await fetch(url, {
        headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
      });
      
      if (!response.ok) {
        setInvalid(true);
        return;
      }

      const data = await response.json();
      if (data.error) {
        setInvalid(true);
        return;
      }

      setContractInfo(data);
    } catch {
      setInvalid(true);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    const allowed = ["application/pdf", "image/jpeg", "image/png"];
    const valid = selected.filter((f) => allowed.includes(f.type) && f.size <= 10 * 1024 * 1024);
    setFiles((prev) => [...prev, ...valid].slice(0, 3));
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const uploadFiles = async (): Promise<string[]> => {
    const urls: string[] = [];
    for (const file of files) {
      const ext = file.name.split(".").pop();
      const path = `${contractInfo!.contract_id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from("proof-files").upload(path, file);
      if (error) throw error;
      const { data } = supabase.storage.from("proof-files").getPublicUrl(path);
      urls.push(data.publicUrl);
    }
    return urls;
  };

  const submitProof = async (action?: "replace" | "additional", replacesId?: string) => {
    if (!contractInfo || !amount || !files.length) return;

    setSubmitting(true);
    try {
      const fileUrls = await uploadFiles();

      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/submit-payment-proof`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          token,
          type,
          service_type: type === "service" ? serviceType : null,
          period,
          amount: parseFloat(amount),
          paid_at: paidAt,
          comment: comment || null,
          files: fileUrls,
          action: action || null,
          replaces_proof_id: replacesId || null,
        }),
      });

      const data = await response.json();

      if (data.duplicate) {
        setExistingProofId(data.existing_proof_id);
        setDuplicateDialogOpen(true);
        return;
      }

      if (data.success) {
        setProofId(data.proof_id);
        setSubmitted(true);
      }
    } catch (err) {
      console.error("Submit error:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitProof();
  };

  const handleReplace = () => {
    setDuplicateDialogOpen(false);
    submitProof("replace", existingProofId);
  };

  const handleAdditional = () => {
    setDuplicateDialogOpen(false);
    submitProof("additional");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (invalid || !contractInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-4">
            <AlertTriangle className="w-12 h-12 text-warning mx-auto" />
            <h2 className="text-xl font-semibold">
              {isEs ? "Link inválido o vencido" : "Invalid or expired link"}
            </h2>
            <p className="text-muted-foreground">
              {isEs
                ? "Este enlace ya no está disponible. Contactá a tu propietario para obtener uno nuevo."
                : "This link is no longer available. Contact your landlord for a new one."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-4">
            <CheckCircle2 className="w-12 h-12 text-success mx-auto" />
            <h2 className="text-xl font-semibold">
              {isEs ? "¡Comprobante enviado!" : "Proof submitted!"}
            </h2>
            <p className="text-muted-foreground text-sm">
              {isEs ? `Número de comprobante: ${proofId.slice(0, 8)}` : `Proof number: ${proofId.slice(0, 8)}`}
            </p>
            <Button onClick={() => { setSubmitted(false); setFiles([]); setAmount(""); setComment(""); }}>
              {isEs ? "Enviar otro comprobante" : "Submit another proof"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-6 px-4">
      <div className="max-w-lg mx-auto space-y-6">
        {/* Header */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 mb-3">
              <Building2 className="w-5 h-5 text-primary" />
              <div>
                <p className="font-semibold">{contractInfo.property.internal_identifier}</p>
                <p className="text-sm text-muted-foreground">{contractInfo.property.full_address}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <User className="w-5 h-5 text-primary" />
              <p className="font-medium">{contractInfo.tenant.full_name}</p>
            </div>
          </CardContent>
        </Card>

        {/* Form */}
        <Card>
          <CardHeader>
            <CardTitle>{isEs ? "Enviar comprobante de pago" : "Submit payment proof"}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Payment type */}
              <div className="space-y-2">
                <Label>{isEs ? "Tipo de pago" : "Payment type"}</Label>
                <Select value={type} onValueChange={(v) => setType(v as "rent" | "service")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rent">{isEs ? "Alquiler" : "Rent"}</SelectItem>
                    <SelectItem value="service">{isEs ? "Servicio" : "Service"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Service type */}
              {type === "service" && (
                <div className="space-y-2">
                  <Label>{isEs ? "Tipo de servicio" : "Service type"}</Label>
                  <Select value={serviceType} onValueChange={setServiceType}>
                    <SelectTrigger><SelectValue placeholder={isEs ? "Seleccionar..." : "Select..."} /></SelectTrigger>
                    <SelectContent>
                      {SERVICE_TYPES.map((st) => (
                        <SelectItem key={st.value} value={st.value}>
                          {isEs ? st.labelEs : st.labelEn}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Period */}
              <div className="space-y-2">
                <Label>{isEs ? "Período (Mes/Año)" : "Period (Month/Year)"}</Label>
                <Input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} required />
              </div>

              {/* Amount */}
              <div className="space-y-2">
                <Label>{isEs ? "Monto" : "Amount"}</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  required
                />
              </div>

              {/* Payment date */}
              <div className="space-y-2">
                <Label>{isEs ? "Fecha de pago" : "Payment date"}</Label>
                <Input type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} required />
              </div>

              {/* Files */}
              <div className="space-y-2">
                <Label>{isEs ? "Adjuntos (1-3 archivos)" : "Attachments (1-3 files)"}</Label>
                <p className="text-xs text-muted-foreground">JPG, PNG, PDF — {isEs ? "máx 10MB" : "max 10MB"}</p>
                {files.length < 3 && (
                  <div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".jpg,.jpeg,.png,.pdf"
                      onChange={handleFileChange}
                      className="hidden"
                      multiple
                    />
                    <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                      <Upload className="w-4 h-4 mr-2" />
                      {isEs ? "Subir archivo" : "Upload file"}
                    </Button>
                  </div>
                )}
                {files.length > 0 && (
                  <div className="space-y-2 mt-2">
                    {files.map((f, i) => (
                      <div key={i} className="flex items-center justify-between bg-muted rounded-md px-3 py-2 text-sm">
                        <span className="truncate">{f.name}</span>
                        <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeFile(i)}>
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Comment */}
              <div className="space-y-2">
                <Label>{isEs ? "Comentario (opcional)" : "Comment (optional)"}</Label>
                <Textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder={isEs ? "Alguna nota adicional..." : "Any additional notes..."}
                  rows={2}
                />
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={submitting || !files.length || !amount}
              >
                {submitting ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{isEs ? "Enviando..." : "Submitting..."}</>
                ) : (
                  isEs ? "Enviar comprobante" : "Submit proof"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Duplicate dialog */}
      <Dialog open={duplicateDialogOpen} onOpenChange={setDuplicateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isEs ? "Comprobante existente" : "Existing proof"}</DialogTitle>
            <DialogDescription>
              {isEs
                ? "Ya existe un comprobante para este período y concepto. ¿Qué querés hacer?"
                : "A proof already exists for this period and type. What would you like to do?"}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={handleAdditional}>
              {isEs ? "Crear adicional" : "Create additional"}
            </Button>
            <Button onClick={handleReplace}>
              {isEs ? "Reemplazar" : "Replace"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
