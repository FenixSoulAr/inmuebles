import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
    variant?: "default" | "outline" | "ghost";
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
  compact?: boolean;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  className,
  compact = false,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        compact ? "py-8 px-4" : "py-12 px-4",
        className
      )}
    >
      <div
        className={cn(
          "flex items-center justify-center rounded-full bg-muted mb-4",
          compact ? "w-10 h-10" : "w-16 h-16"
        )}
      >
        <Icon className={cn("text-muted-foreground", compact ? "w-5 h-5" : "w-8 h-8")} />
      </div>
      <h3 className={cn("font-semibold mb-1.5", compact ? "text-sm" : "text-lg")}>{title}</h3>
      <p className={cn("text-muted-foreground max-w-sm", compact ? "text-xs mb-4" : "text-sm mb-6")}>
        {description}
      </p>
      {(action || secondaryAction) && (
        <div className="flex flex-col items-center gap-2">
          {action && (
            <Button
              size={compact ? "sm" : "default"}
              variant={action.variant ?? "default"}
              onClick={action.onClick}
            >
              {action.label}
            </Button>
          )}
          {secondaryAction && (
            <button
              onClick={secondaryAction.onClick}
              className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
            >
              {secondaryAction.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
