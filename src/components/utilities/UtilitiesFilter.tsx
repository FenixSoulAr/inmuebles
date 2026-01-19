import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type UtilityFilterStatus = "all" | "overdue" | "not_submitted" | "paid_with_proof";

interface UtilitiesFilterProps {
  activeFilter: UtilityFilterStatus;
  onFilterChange: (filter: UtilityFilterStatus) => void;
  counts: {
    all: number;
    overdue: number;
    not_submitted: number;
    paid_with_proof: number;
  };
}

export function UtilitiesFilter({ activeFilter, onFilterChange, counts }: UtilitiesFilterProps) {
  const filters: { value: UtilityFilterStatus; label: string }[] = [
    { value: "all", label: "All" },
    { value: "overdue", label: "Overdue" },
    { value: "not_submitted", label: "Not submitted" },
    { value: "paid_with_proof", label: "Paid" },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {filters.map((filter) => {
        const count = counts[filter.value];
        const isActive = activeFilter === filter.value;
        const isWarning = filter.value === "overdue" && count > 0;

        return (
          <button
            key={filter.value}
            onClick={() => onFilterChange(filter.value)}
            className={cn(
              "inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors",
              "border",
              isActive
                ? isWarning
                  ? "bg-destructive text-destructive-foreground border-destructive"
                  : "bg-primary text-primary-foreground border-primary"
                : isWarning
                ? "bg-destructive/10 text-destructive border-destructive/20 hover:bg-destructive/20"
                : "bg-muted text-muted-foreground border-transparent hover:bg-muted/80"
            )}
          >
            {filter.label}
            {count > 0 && (
              <Badge
                variant="secondary"
                className={cn(
                  "ml-1 px-1.5 py-0.5 text-xs",
                  isActive ? "bg-background/20 text-inherit" : ""
                )}
              >
                {count}
              </Badge>
            )}
          </button>
        );
      })}
    </div>
  );
}
