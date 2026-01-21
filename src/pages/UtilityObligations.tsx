import { useEffect, useState } from "react";
import { Zap, MoreHorizontal, Power, PowerOff, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { AddUtilityModal } from "@/components/utilities/AddUtilityModal";
import { DeleteConfirmationModal } from "@/components/ui/delete-confirmation-modal";

interface UtilityObligation {
  id: string;
  type: string;
  payer: string;
  frequency: string;
  due_day_of_month: number | null;
  active: boolean;
  property: {
    id: string;
    internal_identifier: string;
  };
  proofCount: number;
  hasUploads: boolean;
}

const utilityTypeLabels: Record<string, string> = {
  electricity: "Electricity",
  gas: "Gas",
  water: "Water",
  hoa: "Building fees (HOA / Expensas)",
  insurance: "Insurance",
};

export default function UtilityObligations() {
  const [utilities, setUtilities] = useState<UtilityObligation[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedUtility, setSelectedUtility] = useState<UtilityObligation | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (user) fetchData();
  }, [user]);

  const fetchData = async () => {
    try {
      // Fetch utility obligations with their properties
      const { data: obligations, error: obligationsError } = await supabase
        .from("utility_obligations")
        .select(`
          id,
          type,
          payer,
          frequency,
          due_day_of_month,
          active,
          properties (
            id,
            internal_identifier
          )
        `)
        .order("created_at", { ascending: false });

      if (obligationsError) throw obligationsError;

      // Fetch proof counts and upload status for each obligation
      const { data: proofs, error: proofsError } = await supabase
        .from("utility_proofs")
        .select("utility_obligation_id, file_url");

      if (proofsError) throw proofsError;

      // Group proofs by obligation
      const proofsByObligation = (proofs || []).reduce((acc, proof) => {
        if (!acc[proof.utility_obligation_id]) {
          acc[proof.utility_obligation_id] = { count: 0, hasUploads: false };
        }
        acc[proof.utility_obligation_id].count++;
        if (proof.file_url) {
          acc[proof.utility_obligation_id].hasUploads = true;
        }
        return acc;
      }, {} as Record<string, { count: number; hasUploads: boolean }>);

      const processed: UtilityObligation[] = (obligations || []).map((ob: any) => ({
        id: ob.id,
        type: ob.type,
        payer: ob.payer,
        frequency: ob.frequency,
        due_day_of_month: ob.due_day_of_month,
        active: ob.active,
        property: {
          id: ob.properties.id,
          internal_identifier: ob.properties.internal_identifier,
        },
        proofCount: proofsByObligation[ob.id]?.count || 0,
        hasUploads: proofsByObligation[ob.id]?.hasUploads || false,
      }));

      setUtilities(processed);
    } catch (error) {
      console.error("Error fetching utilities:", error);
      toast({
        title: "Error",
        description: "Something went wrong. Please refresh.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const canDelete = (utility: UtilityObligation) => {
    // Can delete only if no proofs with uploads
    return !utility.hasUploads;
  };

  const handleToggleActive = async (utility: UtilityObligation) => {
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from("utility_obligations")
        .update({ active: !utility.active })
        .eq("id", utility.id);

      if (error) throw error;

      toast({
        title: utility.active ? "Utility deactivated." : "Utility reactivated.",
      });
      fetchData();
    } catch (error) {
      console.error("Error updating utility:", error);
      toast({
        title: "Error",
        description: "Failed to update utility status.",
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteClick = (utility: UtilityObligation) => {
    if (!canDelete(utility)) {
      toast({
        title: "Cannot delete",
        description: "This item cannot be deleted because it has history. Deactivate it instead.",
        variant: "destructive",
      });
      return;
    }
    setSelectedUtility(utility);
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!selectedUtility) return;

    setActionLoading(true);
    try {
      // First delete any proofs (only empty ones should exist)
      const { error: proofsError } = await supabase
        .from("utility_proofs")
        .delete()
        .eq("utility_obligation_id", selectedUtility.id);

      if (proofsError) throw proofsError;

      // Then delete the obligation
      const { error } = await supabase
        .from("utility_obligations")
        .delete()
        .eq("id", selectedUtility.id);

      if (error) throw error;

      toast({ title: "Utility deleted permanently." });
      setDeleteModalOpen(false);
      setSelectedUtility(null);
      fetchData();
    } catch (error) {
      console.error("Error deleting utility:", error);
      toast({
        title: "Error",
        description: "Failed to delete utility.",
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const activeUtilities = utilities.filter((u) => u.active);
  const inactiveUtilities = utilities.filter((u) => !u.active);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Utility Services"
        description="Manage utility obligations for your properties"
      >
        <AddUtilityModal onSuccess={fetchData} />
      </PageHeader>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5" />
            Active utilities
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {activeUtilities.length === 0 ? (
            <EmptyState
              icon={Zap}
              title="No active utilities"
              description="Add a utility to start tracking."
              className="py-12"
            />
          ) : (
            <UtilityTable
              utilities={activeUtilities}
              onToggleActive={handleToggleActive}
              onDelete={handleDeleteClick}
              canDelete={canDelete}
              actionLoading={actionLoading}
            />
          )}
        </CardContent>
      </Card>

      {inactiveUtilities.length > 0 && (
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-muted-foreground">
              <PowerOff className="w-5 h-5" />
              Inactive utilities
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <UtilityTable
              utilities={inactiveUtilities}
              onToggleActive={handleToggleActive}
              onDelete={handleDeleteClick}
              canDelete={canDelete}
              actionLoading={actionLoading}
            />
          </CardContent>
        </Card>
      )}

      <DeleteConfirmationModal
        open={deleteModalOpen}
        onOpenChange={setDeleteModalOpen}
        title="Delete utility permanently?"
        description="This will remove the utility and any empty future periods. This cannot be undone."
        onConfirm={handleConfirmDelete}
        loading={actionLoading}
      />
    </div>
  );
}

interface UtilityTableProps {
  utilities: UtilityObligation[];
  onToggleActive: (utility: UtilityObligation) => void;
  onDelete: (utility: UtilityObligation) => void;
  canDelete: (utility: UtilityObligation) => boolean;
  actionLoading: boolean;
}

function UtilityTable({
  utilities,
  onToggleActive,
  onDelete,
  canDelete,
  actionLoading,
}: UtilityTableProps) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Property</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Responsible</TableHead>
            <TableHead>Frequency</TableHead>
            <TableHead>Due day</TableHead>
            <TableHead>Proofs</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {utilities.map((utility) => (
            <TableRow key={utility.id} className={!utility.active ? "opacity-60" : undefined}>
              <TableCell className="font-medium">
                {utility.property.internal_identifier}
              </TableCell>
              <TableCell>
                {utilityTypeLabels[utility.type] || utility.type}
              </TableCell>
              <TableCell className="capitalize">{utility.payer}</TableCell>
              <TableCell className="capitalize">{utility.frequency}</TableCell>
              <TableCell>{utility.due_day_of_month || 10}</TableCell>
              <TableCell>
                <Badge variant={utility.hasUploads ? "default" : "secondary"}>
                  {utility.proofCount} {utility.proofCount === 1 ? "proof" : "proofs"}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <TooltipProvider>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" disabled={actionLoading}>
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onToggleActive(utility)}>
                        {utility.active ? (
                          <>
                            <PowerOff className="w-4 h-4 mr-2" />
                            Deactivate
                          </>
                        ) : (
                          <>
                            <Power className="w-4 h-4 mr-2" />
                            Reactivate
                          </>
                        )}
                      </DropdownMenuItem>
                      {canDelete(utility) ? (
                        <DropdownMenuItem
                          onClick={() => onDelete(utility)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete permanently
                        </DropdownMenuItem>
                      ) : (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="relative flex cursor-not-allowed select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none text-muted-foreground opacity-50">
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete permanently
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="left">
                            Cannot delete because this utility already has history. Use Deactivate instead.
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TooltipProvider>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
