import { useState, useCallback, useEffect } from "react";
import { Outlet, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { AppSidebar } from "./AppSidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";

const SIDEBAR_WIDTH = 280;
const HEADER_HEIGHT = 56;

export function AppLayout() {
  const { user, loading } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();

  // Close drawer on route change
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

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
      <div className="min-h-screen w-full bg-background overflow-x-hidden">

        {/* ═══════════════════════════════════════════════
            DESKTOP sidebar — in document flow, ≥ 1024px
        ═══════════════════════════════════════════════ */}
        <aside
          className="hidden lg:flex lg:flex-col"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            height: "100vh",
            width: SIDEBAR_WIDTH,
            zIndex: 30,
          }}
        >
          <AppSidebar />
        </aside>

        {/* ═══════════════════════════════════════════════
            MOBILE / TABLET drawer overlay — < 1024px
        ═══════════════════════════════════════════════ */}
        <div className="lg:hidden">
          {/* Backdrop */}
          <div
            onClick={closeDrawer}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 40,
              background: "rgba(0,0,0,0.35)",
              transition: "opacity 0.25s ease",
              opacity: drawerOpen ? 1 : 0,
              pointerEvents: drawerOpen ? "auto" : "none",
            }}
            aria-hidden="true"
          />

          {/* Drawer panel */}
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              height: "100vh",
              /* 85vw on mobile (<640px), fixed 280px on tablet */
              width: "min(85vw, 320px)",
              zIndex: 50,
              transform: drawerOpen ? "translateX(0)" : "translateX(-100%)",
              transition: "transform 0.28s cubic-bezier(0.4,0,0.2,1)",
              willChange: "transform",
            }}
          >
            <AppSidebar onNavigate={closeDrawer} isMobileDrawer />
          </div>
        </div>

        {/* ═══════════════════════════════════════════════
            MAIN content area
        ═══════════════════════════════════════════════ */}
        <div
          className="flex flex-col min-h-screen"
          style={{
            // On desktop: offset by sidebar width
            marginLeft: `var(--sidebar-offset, 0px)`,
          }}
        >
          {/* Inject CSS custom property for desktop offset */}
          <style>{`
            @media (min-width: 1024px) {
              :root { --sidebar-offset: ${SIDEBAR_WIDTH}px; }
            }
            @media (max-width: 1023px) {
              :root { --sidebar-offset: 0px; }
            }
          `}</style>

          {/* ── Fixed mobile/tablet header ── */}
          <header
            className="lg:hidden flex items-center gap-3 bg-background border-b border-border shrink-0"
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              height: HEADER_HEIGHT,
              zIndex: 35,
              paddingLeft: 16,
              paddingRight: 16,
            }}
          >
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setDrawerOpen(true)}
              aria-label="Abrir menú"
              className="text-foreground shrink-0"
            >
              <Menu className="w-5 h-5" />
            </Button>
            <span className="text-base font-semibold tracking-tight truncate">
              MyRentaHub
            </span>
          </header>

          {/* ── Page content ── */}
          <main
            className="flex-1 overflow-y-auto overflow-x-hidden animate-fade-in"
            style={{
              // On mobile/tablet: push content below fixed header
              paddingTop: `var(--content-top, 0px)`,
            }}
          >
            <style>{`
              @media (min-width: 1024px) {
                :root { --content-top: 0px; }
              }
              @media (max-width: 1023px) {
                :root { --content-top: ${HEADER_HEIGHT}px; }
              }
            `}</style>
            <div className="p-4 sm:p-5 lg:p-6 xl:p-8">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}
