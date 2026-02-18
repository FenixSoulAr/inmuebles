import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary] Caught:", error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="flex flex-col items-center justify-center min-h-[300px] p-8 text-center">
          <div className="flex items-center justify-center w-14 h-14 rounded-full bg-destructive/10 mb-4">
            <AlertTriangle className="w-7 h-7 text-destructive" />
          </div>
          <h2 className="text-lg font-semibold mb-2">Algo salió mal</h2>
          <p className="text-sm text-muted-foreground mb-1 max-w-sm">
            {this.state.error?.message || "Se produjo un error inesperado."}
          </p>
          <p className="text-xs text-muted-foreground mb-6 max-w-sm">
            Intentá recargar la página. Si el error persiste, contactá soporte.
          </p>
          <div className="flex gap-3">
            <Button variant="outline" size="sm" onClick={this.handleReset}>
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              Reintentar
            </Button>
            <Button size="sm" onClick={() => window.location.reload()}>
              Recargar página
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
