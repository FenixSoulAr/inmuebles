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
}

const utilityTypeLabels: Record<string, string> = {
  electricity: "Electricity",
  gas: "Gas",
  water: "Water",
  hoa: "HOA Fees",
  insurance: "Insurance",
};

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

export function UtilitiesTable({ proofs, onUploadProof, onViewProof }: UtilitiesTableProps) {
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

  // Group by property for visual organization
  const groupedByProperty = proofs.reduce((acc, proof) => {
    if (!acc[proof.property]) {
      acc[proof.property] = [];
    }
    acc[proof.property].push(proof);
    return acc;
  }, {} as Record<string, UtilityProofRow[]>);

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
          {Object.entries(groupedByProperty).map(([property, propertyProofs]) =>
            propertyProofs.map((proof, index) => (
              <TableRow
                key={proof.id}
                className={proof.status === "overdue" ? "bg-destructive/5" : undefined}
              >
                <TableCell className="font-medium">
                  {index === 0 ? property : ""}
                </TableCell>
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
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
