import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link2, Copy, MessageCircle, RefreshCw, Ban, Loader2, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

interface Props {
  contractId: string;
  token: string | null;
  tokenStatus: string;
  propertyName: string;
  tenantName: string;
  onUpdate: () => void;
}

export function ContractPublicLink({ contractId, token, tokenStatus, propertyName, tenantName, onUpdate }: Props) {
  const { i18n } = useTranslation();
  const isEs = i18n.language?.startsWith("es");
  const { toast } = useToast();
  const [rotating, setRotating] = useState(false);

  const publicLink = token ? `${window.location.origin}/submit/${token}` : null;
  const isActive = tokenStatus === "active" && !!token;

  const copyLink = () => {
    if (!publicLink) return;
    navigator.clipboard.writeText(publicLink);
    toast({ title: isEs ? "Link copiado" : "Link copied" });
  };

  const copyWhatsApp = () => {
    if (!publicLink) return;
    const msg = isEs
      ? `Hola ${tenantName},\n\nte comparto el link para enviar tu comprobante de pago correspondiente a ${propertyName}:\n\n${publicLink}\n\nPodés subir el comprobante de forma simple y segura desde tu celular o computadora.\n\nGracias.`
      : `Hi ${tenantName},\n\nhere's the link to submit your payment proof for ${propertyName}:\n\n${publicLink}\n\nYou can upload your proof easily and securely from your phone or computer.\n\nThank you.`;
    navigator.clipboard.writeText(msg);
    toast({ title: isEs ? "Mensaje copiado" : "Message copied" });
  };

  const rotateToken = async () => {
    setRotating(true);
    try {
      const newToken = Array.from(crypto.getRandomValues(new Uint8Array(32)))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      const { error } = await supabase
        .from("contracts")
        .update({
          public_submission_token: newToken,
          token_status: "active",
          token_rotated_at: new Date().toISOString(),
        })
        .eq("id", contractId);

      if (error) throw error;
      toast({ title: isEs ? "Link rotado" : "Link rotated", description: isEs ? "El link anterior ya no funciona." : "The previous link no longer works." });
      onUpdate();
    } catch {
      toast({ title: isEs ? "Error" : "Error", variant: "destructive" });
    } finally {
      setRotating(false);
    }
  };

  const disableToken = async () => {
    try {
      const { error } = await supabase
        .from("contracts")
        .update({ token_status: "disabled" })
        .eq("id", contractId);

      if (error) throw error;
      toast({ title: isEs ? "Link desactivado" : "Link disabled" });
      onUpdate();
    } catch {
      toast({ title: isEs ? "Error" : "Error", variant: "destructive" });
    }
  };

  const enableToken = async () => {
    try {
      // If no token exists, generate one
      const updates: Record<string, unknown> = { token_status: "active" };
      if (!token) {
        const newToken = Array.from(crypto.getRandomValues(new Uint8Array(32)))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");
        updates.public_submission_token = newToken;
        updates.token_created_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from("contracts")
        .update(updates)
        .eq("id", contractId);

      if (error) throw error;
      toast({ title: isEs ? "Link activado" : "Link enabled" });
      onUpdate();
    } catch {
      toast({ title: isEs ? "Error" : "Error", variant: "destructive" });
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Link2 className="w-4 h-4" />
          {isEs ? "Link de comprobantes" : "Proof submission link"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isActive && publicLink ? (
          <>
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle className="w-4 h-4 text-success shrink-0" />
              <span className="text-success font-medium">{isEs ? "Activo" : "Active"}</span>
            </div>
            <p className="text-xs text-muted-foreground break-all font-mono bg-muted rounded p-2">
              {publicLink}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" onClick={copyLink}>
                <Copy className="w-4 h-4 mr-1" />
                {isEs ? "Copiar link" : "Copy link"}
              </Button>
              <Button variant="outline" size="sm" onClick={copyWhatsApp}>
                <MessageCircle className="w-4 h-4 mr-1" />
                WhatsApp
              </Button>
              <Button variant="outline" size="sm" onClick={rotateToken} disabled={rotating}>
                {rotating ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-1" />}
                {isEs ? "Rotar" : "Rotate"}
              </Button>
              <Button variant="outline" size="sm" onClick={disableToken} className="text-destructive">
                <Ban className="w-4 h-4 mr-1" />
                {isEs ? "Desactivar" : "Disable"}
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 text-sm">
              <Ban className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground">{isEs ? "Desactivado" : "Disabled"}</span>
            </div>
            <Button size="sm" onClick={enableToken} className="w-full">
              <Link2 className="w-4 h-4 mr-2" />
              {isEs ? "Activar link" : "Enable link"}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
