import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";

export default function AcceptInvite() {
  const { token } = useParams<{ token: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [status, setStatus] = useState<"loading" | "success" | "error" | "needsAuth">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      // Store token so we can resume after login
      if (token) sessionStorage.setItem("pending_invite_token", token);
      setStatus("needsAuth");
      return;
    }

    if (!token) {
      setStatus("error");
      setMessage("Token de invitación inválido.");
      return;
    }

    const accept = async () => {
      const { data, error } = await supabase.rpc("accept_invite", { _token: token });
      if (error) {
        setStatus("error");
        setMessage(error.message);
      } else {
        sessionStorage.removeItem("pending_invite_token");
        setStatus("success");
        setMessage("¡Te uniste al proyecto exitosamente!");
      }
    };

    accept();
  }, [user, authLoading, token]);

  const handleGoToLogin = () => {
    navigate("/signin");
  };

  const handleGoToDashboard = () => {
    navigate("/dashboard");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>Invitación al proyecto</CardTitle>
          <CardDescription>
            {status === "needsAuth"
              ? "Necesitás iniciar sesión para aceptar la invitación."
              : "Procesando tu invitación..."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          {status === "loading" && <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />}

          {status === "needsAuth" && (
            <Button onClick={handleGoToLogin} className="w-full">
              Iniciar sesión
            </Button>
          )}

          {status === "success" && (
            <>
              <CheckCircle2 className="w-12 h-12 text-primary" />
              <p className="text-sm text-center">{message}</p>
              <Button onClick={handleGoToDashboard} className="w-full">
                Ir al dashboard
              </Button>
            </>
          )}

          {status === "error" && (
            <>
              <XCircle className="w-12 h-12 text-destructive" />
              <p className="text-sm text-center text-destructive">{message}</p>
              <Button variant="outline" onClick={handleGoToDashboard} className="w-full">
                Volver
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
