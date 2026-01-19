import { Building2, DollarSign, Zap, Receipt, Wrench } from "lucide-react";
import { StatCard } from "@/components/ui/stat-card";

interface DashboardKPIsProps {
  occupiedCount: number;
  vacantCount: number;
  rentCollectedThisMonth: number;
  rentOutstandingThisMonth: number;
  missingUtilityProofs: number;
  taxesDueSoon: number;
  openMaintenance: number;
}

export function DashboardKPIs({
  occupiedCount,
  vacantCount,
  rentCollectedThisMonth,
  rentOutstandingThisMonth,
  missingUtilityProofs,
  taxesDueSoon,
  openMaintenance,
}: DashboardKPIsProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 mb-6">
      <StatCard
        title="Occupied / Vacant"
        value={`${occupiedCount} / ${vacantCount}`}
        icon={Building2}
        variant="primary"
      />
      <StatCard
        title="Collected (month)"
        value={formatCurrency(rentCollectedThisMonth)}
        icon={DollarSign}
        variant="success"
      />
      <StatCard
        title="Outstanding (month)"
        value={formatCurrency(rentOutstandingThisMonth)}
        icon={DollarSign}
        variant={rentOutstandingThisMonth > 0 ? "destructive" : "default"}
      />
      <StatCard
        title="Missing proofs"
        value={missingUtilityProofs}
        icon={Zap}
        variant={missingUtilityProofs > 0 ? "warning" : "default"}
      />
      <StatCard
        title="Taxes due soon"
        value={taxesDueSoon}
        icon={Receipt}
        variant={taxesDueSoon > 0 ? "warning" : "default"}
      />
      <StatCard
        title="Open maintenance"
        value={openMaintenance}
        icon={Wrench}
        variant={openMaintenance > 0 ? "warning" : "default"}
      />
    </div>
  );
}
