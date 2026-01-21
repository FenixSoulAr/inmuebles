import { AlertTriangle, Eye, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export interface UtilityProofRow {
  id: string;
  property: string;
  propertyId: string;
  utilityType: string;
  period: string;
  periodMonth: string;
  responsible: string;
  dueDate: string;
  status: "paid_with_proof" | "not_submitted" | "overdue";
  fileUrl: string | null;
}

interface UtilitiesTableProps {
  proofs: UtilityProofRow[];
  onUploadProof: (proofId: string) => void;
  onViewProof: (fileUrl: string) => void;
  showSectionHeaders?: boolean;
}

const utilityTypeLabels: Record<string, string> = {
  electricity: "Electricity",
  gas: "Gas",
  water: "Water",
  hoa: "Building fees (HOA / Expensas)",
  insurance: "Insurance",
};

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const statusPriority: Record<string, number> = {
  overdue: 1,
  not_submitted: 2,
  paid_with_proof: 3,
};

const sectionLabels: Record<string, string> = {
  overdue: "Overdue utilities",
  not_submitted: "Upcoming utilities",
  paid_with_proof: "Paid utilities",
};

function sortProofs(proofs: UtilityProofRow[]): UtilityProofRow[] {
  return [...proofs].sort((a, b) => {
    // First sort by status priority
    const priorityDiff = statusPriority[a.status] - statusPriority[b.status];
    if (priorityDiff !== 0) return priorityDiff;
    
    // Within same status, sort by due date ascending
    return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
  });
}

function groupByStatus(proofs: UtilityProofRow[]): Record<string, UtilityProofRow[]> {
  const groups: Record<string, UtilityProofRow[]> = {
    overdue: [],
    not_submitted: [],
    paid_with_proof: [],
  };
  
  proofs.forEach(proof => {
    groups[proof.status].push(proof);
  });
  
  return groups;
}

export function UtilitiesTable({ proofs, onUploadProof, onViewProof, showSectionHeaders = true }: UtilitiesTableProps) {
  if (proofs.length === 0) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="No utilities yet"
        description="Add a utility to start tracking proofs."
        className="py-12"
      />
    );
  }

  const sortedProofs = sortProofs(proofs);
  const groupedProofs = groupByStatus(sortedProofs);
  const statusOrder: Array<"overdue" | "not_submitted" | "paid_with_proof"> = ["overdue", "not_submitted", "paid_with_proof"];

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="whitespace-nowrap">Property</TableHead>
            <TableHead className="whitespace-nowrap">Utility</TableHead>
            <TableHead className="whitespace-nowrap">Period</TableHead>
            <TableHead className="whitespace-nowrap">Responsible</TableHead>
            <TableHead className="whitespace-nowrap">Due date</TableHead>
            <TableHead className="whitespace-nowrap">Status</TableHead>
            <TableHead className="text-right whitespace-nowrap">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {statusOrder.map((status) => {
            const statusProofs = groupedProofs[status];
            if (statusProofs.length === 0) return null;

            return (
              <>
                {showSectionHeaders && (
                  <TableRow key={`header-${status}`} className="bg-muted/50 hover:bg-muted/50">
                    <TableCell colSpan={7} className="py-2">
                      <span className={`text-sm font-medium ${status === "overdue" ? "text-destructive" : "text-muted-foreground"}`}>
                        {sectionLabels[status]} ({statusProofs.length})
                      </span>
                    </TableCell>
                  </TableRow>
                )}
                {statusProofs.map((proof) => (
                  <TableRow
                    key={proof.id}
                    className={proof.status === "overdue" ? "bg-destructive/5 hover:bg-destructive/10" : undefined}
                  >
                    <TableCell className="font-medium">{proof.property}</TableCell>
                    <TableCell>
                      {utilityTypeLabels[proof.utilityType] || proof.utilityType}
                    </TableCell>
                    <TableCell>{proof.period}</TableCell>
                    <TableCell className="capitalize">{proof.responsible}</TableCell>
                    <TableCell>{formatDate(proof.dueDate)}</TableCell>
                    <TableCell>
                      <StatusBadge variant={proof.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      {proof.status === "paid_with_proof" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onViewProof(proof.fileUrl!)}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          View proof
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant={proof.status === "overdue" ? "default" : "outline"}
                          onClick={() => onUploadProof(proof.id)}
                        >
                          <Upload className="w-4 h-4 mr-1" />
                          Upload proof
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
