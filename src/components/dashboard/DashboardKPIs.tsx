import { DollarSign, Zap, Receipt, Wrench } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { StatCard } from "@/components/ui/stat-card";

interface DashboardKPIsProps {
  rentCollectedThisMonth: number;
  rentOutstandingThisMonth: number;
  missingUtilityProofs: number;
  taxesDueSoon: number;
  openMaintenance: number;
}

export function DashboardKPIs({ rentCollectedThisMonth, rentOutstandingThisMonth, missingUtilityProofs, taxesDueSoon, openMaintenance }: DashboardKPIsProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const formatCurrency = (amount: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  return (
    <div className="grid gap-4 grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 mb-6">
      <StatCard
        title={t("dashboard.collectedMonth")}
        value={formatCurrency(rentCollectedThisMonth)}
        icon={DollarSign}
        variant="success"
        className="cursor-pointer hover:shadow-md transition-shadow"
        onClick={() => navigate("/rent", { state: { tab: "confirmed", period: currentMonth, type: "rent" } })}
      />
      <StatCard
        title={t("dashboard.outstandingMonth")}
        value={formatCurrency(rentOutstandingThisMonth)}
        icon={DollarSign}
        variant={rentOutstandingThisMonth > 0 ? "destructive" : "default"}
        className="cursor-pointer hover:shadow-md transition-shadow"
        onClick={() => navigate("/rent", { state: { tab: "pending", period: currentMonth, type: "rent" } })}
      />
      <StatCard
        title={t("dashboard.missingProofs")}
        value={missingUtilityProofs}
        icon={Zap}
        variant={missingUtilityProofs > 0 ? "warning" : "default"}
        className="cursor-pointer hover:shadow-md transition-shadow"
        onClick={() => navigate("/utilities", { state: { tab: "pending", type: "services" } })}
      />
      <StatCard
        title={t("dashboard.taxesDueSoon")}
        value={taxesDueSoon}
        icon={Receipt}
        variant={taxesDueSoon > 0 ? "warning" : "default"}
        className="cursor-pointer hover:shadow-md transition-shadow"
        onClick={() => navigate("/taxes", { state: { filter: "upcoming" } })}
      />
      <StatCard
        title={t("dashboard.openMaintenance")}
        value={openMaintenance}
        icon={Wrench}
        variant={openMaintenance > 0 ? "warning" : "default"}
        className="cursor-pointer hover:shadow-md transition-shadow"
        onClick={() => navigate("/maintenance", { state: { filter: "open" } })}
      />
    </div>
  );
}

