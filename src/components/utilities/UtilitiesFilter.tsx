import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export type UtilityFilterStatus = "action_needed" | "all" | "overdue" | "not_submitted" | "paid_with_proof";

interface UtilitiesFilterProps {
  activeFilter: UtilityFilterStatus;
  onFilterChange: (filter: UtilityFilterStatus) => void;
  counts: {
    all: number;
    pending: number;
    overdue: number;
    not_submitted: number;
    paid_with_proof: number;
  };
}

export function UtilitiesFilter({ activeFilter, onFilterChange, counts }: UtilitiesFilterProps) {
  // Selectable filters only - "Action needed" is NOT a filter
  const filters: { value: UtilityFilterStatus; label: string }[] = [
    { value: "overdue", label: "Overdue" },
    { value: "not_submitted", label: "Not submitted" },
    { value: "paid_with_proof", label: "Paid" },
    { value: "all", label: "All" },
  ];

  const actionNeededCount = counts.pending;
  const hasUrgentItems = actionNeededCount > 0;

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Action needed badge - informational only, not clickable */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className={cn(
                "inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium",
                "border cursor-default select-none",
                hasUrgentItems
                  ? "bg-destructive/10 text-destructive border-destructive/30"
                  : "bg-muted/50 text-muted-foreground border-transparent"
              )}
            >
              <AlertCircle className="w-4 h-4" />
              Action needed
              <Badge
                variant="secondary"
                className={cn(
                  "ml-1 px-1.5 py-0.5 text-xs",
                  hasUrgentItems ? "bg-destructive/20 text-destructive" : ""
                )}
              >
                {actionNeededCount}
              </Badge>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>Items that require your attention (overdue or missing proof).</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* Separator */}
      <div className="h-6 w-px bg-border" />

      {/* Selectable filters */}
      {filters.map((filter) => {
        const count = counts[filter.value === "all" ? "all" : filter.value];
        const isActive = activeFilter === filter.value;
        const isWarning = filter.value === "overdue" && counts.overdue > 0;

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
