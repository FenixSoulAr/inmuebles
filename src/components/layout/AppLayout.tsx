import { Outlet, Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { AppSidebar } from "./AppSidebar";
import { TooltipProvider } from "@/components/ui/tooltip";

export function AppLayout() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/signin" replace />;
  }

  return (
    <TooltipProvider>
      <div className="flex min-h-screen w-full bg-background overflow-hidden">
        <AppSidebar />
        <main className="flex-1 min-w-0 overflow-y-auto">
          <div className="p-6 lg:p-8 animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>
    </TooltipProvider>
  );
}
