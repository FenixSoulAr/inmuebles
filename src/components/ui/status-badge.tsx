import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const statusBadgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        // Property status
        occupied: "bg-success/10 text-success border border-success/20",
        vacant: "bg-warning/10 text-warning border border-warning/20",
        under_repair: "bg-muted text-muted-foreground border border-border",
        
        // Payment status
        paid: "bg-success/10 text-success border border-success/20",
        partial: "bg-warning/10 text-warning border border-warning/20",
        overdue: "bg-destructive/10 text-destructive border border-destructive/20",
        
        // Utility proof status
        paid_with_proof: "bg-success/10 text-success border border-success/20",
        not_submitted: "bg-muted text-muted-foreground border border-border",
        
        // Tax/Fiscal status
        ok: "bg-success/10 text-success border border-success/20",
        pending: "bg-warning/10 text-warning border border-warning/20",
        
        // Tenant status
        active: "bg-success/10 text-success border border-success/20",
        ended: "bg-muted text-muted-foreground border border-border",
        
        // Maintenance status
        in_progress: "bg-primary/10 text-primary border border-primary/20",
        resolved: "bg-success/10 text-success border border-success/20",
        
        // Alert status
        open: "bg-warning/10 text-warning border border-warning/20",
        done: "bg-success/10 text-success border border-success/20",
        
        // Document checklist
        complete: "bg-success/10 text-success border border-success/20",
        incomplete: "bg-warning/10 text-warning border border-warning/20",

        // Obligation statuses
        pending_send: "bg-warning/10 text-warning border border-warning/20",
        awaiting_review: "bg-primary/10 text-primary border border-primary/20",
        approved: "bg-success/10 text-success border border-success/20",
        rejected: "bg-destructive/10 text-destructive border border-destructive/20",
        replaced: "bg-muted text-muted-foreground border border-border",
        
        // Default
        default: "bg-secondary text-secondary-foreground border border-border",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface StatusBadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof statusBadgeVariants> {
  label?: string;
}

const statusLabels: Record<string, string> = {
  occupied: "Occupied",
  vacant: "Vacant",
  under_repair: "Under Repair",
  paid: "Paid",
  partial: "Partial",
  overdue: "Overdue",
  paid_with_proof: "Paid with Proof",
  not_submitted: "Not Submitted",
  ok: "OK",
  pending: "Pending",
  active: "Active",
  ended: "Ended",
  in_progress: "In Progress",
  resolved: "Resolved",
  open: "Open",
  done: "Done",
  complete: "Complete",
  incomplete: "Incomplete",
  pending_send: "Pending",
  awaiting_review: "Received",
  approved: "Approved",
  rejected: "Rejected",
  replaced: "Replaced",
};

export function StatusBadge({ className, variant, label, ...props }: StatusBadgeProps) {
  const displayLabel = label || (variant ? statusLabels[variant] : "Unknown");
  
  return (
    <div className={cn(statusBadgeVariants({ variant }), className)} {...props}>
      {displayLabel}
    </div>
  );
}
