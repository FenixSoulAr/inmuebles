import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Building2,
  LayoutDashboard,
  Users,
  FileText,
  Wrench,
  Receipt,
  FileCheck,
  Calendar,
  FolderOpen,
  LogOut,
  ChevronLeft,
  ChevronRight,
  UserSquare,
  Shield,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { LanguageSelector } from "./LanguageSelector";
import logoLockup from "@/assets/logo-lockup-transparent.png";

interface AppSidebarProps {
  /** Called after a nav item is clicked — used to close mobile drawer */
  onNavigate?: () => void;
  /** When true the sidebar is rendered inside a mobile drawer overlay */
  isMobileDrawer?: boolean;
}

export function AppSidebar({ onNavigate, isMobileDrawer = false }: AppSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [personasOpen, setPersonasOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { t } = useTranslation();

  const mainNavItems = [
    { title: t("nav.dashboard"), url: "/dashboard", icon: LayoutDashboard },
    { title: t("nav.properties"), url: "/properties", icon: Building2 },
    { title: t("nav.contracts"), url: "/contracts", icon: FileText },
    { title: t("nav.paymentProofs"), url: "/payment-proofs", icon: FileCheck },
    { title: t("nav.maintenance"), url: "/maintenance", icon: Wrench },
    { title: t("nav.taxes"), url: "/taxes", icon: Receipt },
    { title: t("nav.agenda"), url: "/agenda", icon: Calendar },
    { title: t("nav.documents"), url: "/documents", icon: FolderOpen },
  ];

  const personasItems = [
    { title: "Propietarios", url: "/owners", icon: Building2 },
    { title: t("nav.tenants"), url: "/tenants", icon: Users },
    { title: "Garantes", url: "/guarantors", icon: Shield },
  ];

  const isPersonasActive = personasItems.some((item) =>
    location.pathname.startsWith(item.url)
  );

  const isActive = (path: string) => {
    if (path === "/dashboard") return location.pathname === "/dashboard";
    return location.pathname.startsWith(path);
  };

  const handleNavigate = (url: string) => {
    navigate(url);
    onNavigate?.();
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/signin");
    onNavigate?.();
  };

  // In mobile drawer: never collapse, always show full labels
  const effectiveCollapsed = isMobileDrawer ? false : collapsed;

  // When sidebar collapses, auto-close the pessoas group
  const showPersonasOpen = !effectiveCollapsed && (personasOpen || isPersonasActive);

  const renderNavButton = (item: { title: string; url: string; icon: React.ElementType }) => {
    const active = isActive(item.url);
    const btn = (
      <button
        onClick={() => handleNavigate(item.url)}
        className={cn(
          "flex items-center w-full gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
          active
            ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-md"
            : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        )}
      >
        <item.icon className="w-5 h-5 shrink-0" />
        {!effectiveCollapsed && <span>{item.title}</span>}
      </button>
    );
    return effectiveCollapsed ? (
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>{btn}</TooltipTrigger>
        <TooltipContent side="right" className="font-medium">{item.title}</TooltipContent>
      </Tooltip>
    ) : btn;
  };

  return (
    <aside
      className="flex flex-col bg-sidebar text-sidebar-foreground h-full transition-[width] duration-300 ease-in-out overflow-hidden"
      style={{ width: effectiveCollapsed ? 64 : 280 }}
    >
      {/* ── Branding header — white block ── */}
      <div
        className={cn(
          "shrink-0 border-b flex items-center",
          effectiveCollapsed ? "justify-center px-2 py-4" : "px-4 py-4"
        )}
        style={{ background: "#FFFFFF", borderBottomColor: "#E5E7EB", minHeight: 88 }}
      >
        <button
          onClick={() => handleNavigate("/dashboard")}
          className="focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg"
          aria-label="Ir al panel principal"
        >
          {effectiveCollapsed ? (
            <img src="/android-chrome-192x192.png" alt="MyRentaHub" className="object-contain rounded-md" style={{ height: 40, width: 40 }} />
          ) : (
            <img src={logoLockup} alt="MyRentaHub" className="object-contain object-left" style={{ height: 44, width: "auto", maxWidth: 220 }} />
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-2">
        <ul className="space-y-1">
          {/* Main nav items */}
          {mainNavItems.map((item) => (
            <li key={item.url}>{renderNavButton(item)}</li>
          ))}

          {/* ── Personas group ── */}
          <li className="pt-2">
            {effectiveCollapsed ? (
              /* Collapsed: show a single Personas icon that goes to /owners */
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => handleNavigate("/owners")}
                    className={cn(
                      "flex items-center w-full gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                      isPersonasActive
                        ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-md"
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    )}
                  >
                    <UserSquare className="w-5 h-5 shrink-0" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="font-medium">Personas</TooltipContent>
              </Tooltip>
            ) : (
              <>
                {/* Group header — collapsible */}
                <button
                  onClick={() => setPersonasOpen(!showPersonasOpen)}
                  className={cn(
                    "flex items-center w-full gap-3 px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors",
                    isPersonasActive
                      ? "text-sidebar-primary"
                      : "text-sidebar-foreground/50 hover:text-sidebar-foreground/80"
                  )}
                >
                  <UserSquare className="w-4 h-4 shrink-0" />
                  <span className="flex-1 text-left">Personas</span>
                  <ChevronDown
                    className={cn("w-3.5 h-3.5 transition-transform", showPersonasOpen && "rotate-180")}
                  />
                </button>

                {/* Sub-items */}
                {showPersonasOpen && (
                  <ul className="mt-1 ml-4 space-y-1 border-l border-sidebar-border pl-3">
                    {personasItems.map((item) => (
                      <li key={item.url}>{renderNavButton(item)}</li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </li>
        </ul>
      </nav>

      {/* Footer */}
      <div className="p-2 border-t border-sidebar-border">
        <Separator className="mb-2 bg-sidebar-border" />

        <LanguageSelector collapsed={effectiveCollapsed} />

        {effectiveCollapsed ? (
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleSignOut}
                className="w-full text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground mt-1"
              >
                <LogOut className="w-5 h-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">{t("common.signOut")}</TooltipContent>
          </Tooltip>
        ) : (
          <Button
            variant="ghost"
            onClick={handleSignOut}
            className="w-full justify-start gap-3 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground mt-1"
          >
            <LogOut className="w-5 h-5" />
            <span>{t("common.signOut")}</span>
          </Button>
        )}

        {/* Collapse Toggle — only on desktop */}
        {!isMobileDrawer && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCollapsed(!collapsed)}
            className="w-full mt-2 text-sidebar-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            {effectiveCollapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </Button>
        )}
      </div>
    </aside>
  );
}
