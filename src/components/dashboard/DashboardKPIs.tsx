import { Building2, DollarSign, Zap, Receipt, Wrench } from "lucide-react";
import { useTranslation } from "react-i18next";
import { StatCard } from "@/components/ui/stat-card";

interface DashboardKPIsProps {
  occupiedCount: number; vacantCount: number; rentCollectedThisMonth: number;
  rentOutstandingThisMonth: number; missingUtilityProofs: number; taxesDueSoon: number; openMaintenance: number;
}

export function DashboardKPIs({ occupiedCount, vacantCount, rentCollectedThisMonth, rentOutstandingThisMonth, missingUtilityProofs, taxesDueSoon, openMaintenance }: DashboardKPIsProps) {
  const { t } = useTranslation();
  const formatCurrency = (amount: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);

  return (
    <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 mb-6">
      <StatCard title={t("dashboard.occupiedVacant")} value={`${occupiedCount} / ${vacantCount}`} icon={Building2} variant="primary" />
      <StatCard title={t("dashboard.collectedMonth")} value={formatCurrency(rentCollectedThisMonth)} icon={DollarSign} variant="success" />
      <StatCard title={t("dashboard.outstandingMonth")} value={formatCurrency(rentOutstandingThisMonth)} icon={DollarSign} variant={rentOutstandingThisMonth > 0 ? "destructive" : "default"} />
      <StatCard title={t("dashboard.missingProofs")} value={missingUtilityProofs} icon={Zap} variant={missingUtilityProofs > 0 ? "warning" : "default"} />
      <StatCard title={t("dashboard.taxesDueSoon")} value={taxesDueSoon} icon={Receipt} variant={taxesDueSoon > 0 ? "warning" : "default"} />
      <StatCard title={t("dashboard.openMaintenance")} value={openMaintenance} icon={Wrench} variant={openMaintenance > 0 ? "warning" : "default"} />
    </div>
  );
}
