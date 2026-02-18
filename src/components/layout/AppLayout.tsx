import { useState, useCallback } from "react";
import { Outlet, Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { AppSidebar } from "./AppSidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AppLayout() {
  const { user, loading } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const closeMobile = useCallback(() => setMobileOpen(false), []);

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
        {/* ── Desktop sidebar (always in flow, hidden on mobile) ── */}
        <div className="hidden lg:flex shrink-0">
          <AppSidebar onNavigate={closeMobile} />
        </div>

        {/* ── Mobile drawer overlay ── */}
        {mobileOpen && (
          <div
            className="fixed inset-0 z-40 lg:hidden"
            aria-hidden="true"
          >
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setMobileOpen(false)}
            />
            {/* Drawer panel */}
            <div className="absolute left-0 top-0 h-full z-50 shadow-2xl animate-slide-in-right">
              <AppSidebar onNavigate={closeMobile} isMobileDrawer />
            </div>
          </div>
        )}

        {/* ── Main content ── */}
        <main className="flex-1 min-w-0 overflow-y-auto flex flex-col">
          {/* Mobile header bar with hamburger */}
          <div className="flex items-center gap-3 h-14 px-4 border-b border-border bg-background lg:hidden shrink-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileOpen(true)}
              aria-label="Abrir menú"
              className="text-foreground"
            >
              <Menu className="w-5 h-5" />
            </Button>
            <span className="text-base font-semibold tracking-tight">MyRentaHub</span>
          </div>

          <div className="p-4 lg:p-6 xl:p-8 animate-fade-in flex-1">
            <Outlet />
          </div>
        </main>
      </div>
    </TooltipProvider>
  );
}
