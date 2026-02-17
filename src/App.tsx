import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import SignIn from "./pages/SignIn";
import Dashboard from "./pages/Dashboard";
import Properties from "./pages/Properties";
import PropertyDetail from "./pages/PropertyDetail";
import Tenants from "./pages/Tenants";
import TenantDetail from "./pages/TenantDetail";
import Contracts from "./pages/Contracts";
import ContractNew from "./pages/ContractNew";
import ContractDetail from "./pages/ContractDetail";
import PaymentProofs from "./pages/PaymentProofs";
import PublicSubmit from "./pages/PublicSubmit";
import Utilities from "./pages/Utilities";
import UtilityObligations from "./pages/UtilityObligations";
import Maintenance from "./pages/Maintenance";
import Taxes from "./pages/Taxes";
import Agenda from "./pages/Agenda";
import Documents from "./pages/Documents";
import NotFound from "./pages/NotFound";

// Create QueryClient as a module-level singleton
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
    },
  },
});

const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/signin" element={<SignIn />} />
              <Route path="/submit/:token" element={<PublicSubmit />} />
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route element={<AppLayout />}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/properties" element={<Properties />} />
                <Route path="/properties/:id" element={<PropertyDetail />} />
                <Route path="/tenants" element={<Tenants />} />
                <Route path="/tenants/:id" element={<TenantDetail />} />
                <Route path="/contracts" element={<Contracts />} />
                <Route path="/contracts/new" element={<ContractNew />} />
                <Route path="/contracts/:id" element={<ContractDetail />} />
                <Route path="/rent" element={<Navigate to="/payment-proofs" replace />} />
                <Route path="/payment-proofs" element={<PaymentProofs />} />
                <Route path="/utilities" element={<Utilities />} />
                <Route path="/utility-services" element={<UtilityObligations />} />
                <Route path="/maintenance" element={<Maintenance />} />
                <Route path="/taxes" element={<Taxes />} />
                <Route path="/agenda" element={<Agenda />} />
                <Route path="/documents" element={<Documents />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
