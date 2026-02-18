import { BarChart2, CalendarDays, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { format, subMonths, startOfMonth } from "date-fns";
import { es } from "date-fns/locale";

export type DashboardViewMode = "monthly" | "cumulative";

export interface MonthOption {
  value: string; // "yyyy-MM"
  label: string;
}

function getMonthOptions(): MonthOption[] {
  const now = new Date();
  const opts: MonthOption[] = [];
  // Current month + previous 11 months
  for (let i = 0; i < 12; i++) {
    const d = subMonths(now, i);
    const value = format(d, "yyyy-MM");
    const label = format(startOfMonth(d), "MMMM yyyy", { locale: es });
    opts.push({ value, label: label.charAt(0).toUpperCase() + label.slice(1) });
  }
  return opts;
}

interface DashboardViewSelectorProps {
  mode: DashboardViewMode;
  onModeChange: (mode: DashboardViewMode) => void;
  selectedMonth: string; // "yyyy-MM"
  onMonthChange: (month: string) => void;
}

export function DashboardViewSelector({
  mode,
  onModeChange,
  selectedMonth,
  onMonthChange,
}: DashboardViewSelectorProps) {
  const [monthOpen, setMonthOpen] = useState(false);
  const monthOptions = getMonthOptions();
  const selectedLabel = monthOptions.find((m) => m.value === selectedMonth)?.label || selectedMonth;

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex items-center gap-2">
        {/* Segmented toggle */}
        <div className="inline-flex rounded-lg border border-border bg-muted/40 p-0.5 gap-0.5">
          <button
            onClick={() => onModeChange("monthly")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all duration-150",
              mode === "monthly"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <CalendarDays className="w-3.5 h-3.5" />
            Vista por mes
          </button>
          <button
            onClick={() => onModeChange("cumulative")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all duration-150",
              mode === "cumulative"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <BarChart2 className="w-3.5 h-3.5" />
            Vista acumulada
          </button>
        </div>

        {/* Month selector — only visible in monthly mode */}
        {mode === "monthly" && (
          <Popover open={monthOpen} onOpenChange={setMonthOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-sm font-normal gap-1.5 min-w-[160px] justify-between"
              >
                <span>{selectedLabel}</span>
                <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-52 p-1.5" align="end">
              <div className="space-y-0.5 max-h-64 overflow-y-auto">
                {monthOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => {
                      onMonthChange(opt.value);
                      setMonthOpen(false);
                    }}
                    className={cn(
                      "w-full text-left text-sm px-3 py-2 rounded-md transition-colors",
                      opt.value === selectedMonth
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>

      {/* Hint text */}
      <p className="text-xs text-muted-foreground">
        {mode === "monthly"
          ? "Análisis mensual basado en fecha de pago y vencimiento."
          : "Vista total histórica."}
      </p>
    </div>
  );
}
