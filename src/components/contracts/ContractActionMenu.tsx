import { useState, useEffect } from "react";
import { MoreHorizontal, Pencil, XCircle, StopCircle, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { DeleteConfirmationModal } from "@/components/ui/delete-confirmation-modal";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Contract {
  id: string;
  is_active: boolean;
  signed_contract_file_url: string | null;
  property_id: string;
}

interface ContractActionMenuProps {
  contract: Contract;
  onEdit: () => void;
  onRefresh: () => void;
}

export function ContractActionMenu({
  contract,
  onEdit,
  onRefresh,
}: ContractActionMenuProps) {
  const { toast } = useToast();
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [endContractOpen, setEndContractOpen] = useState(false);
  const [cancelContractOpen, setCancelContractOpen] = useState(false);
  const [canDelete, setCanDelete] = useState(false);
  const [canCancel, setCanCancel] = useState(false);
  const [checkingHistory, setCheckingHistory] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    checkEligibility();
  }, [contract.id]);

  const checkEligibility = async () => {
    setCheckingHistory(true);
    try {
      const [rentDues, rentPayments] = await Promise.all([
        supabase.from("rent_dues").select("id").eq("contract_id", contract.id).limit(1),
        supabase
          .from("rent_payments")
          .select("id, rent_dues!inner(contract_id)")
          .eq("rent_dues.contract_id", contract.id)
          .limit(1),
      ]);

      const hasRentDues = (rentDues.data?.length || 0) > 0;
      const hasRentPayments = (rentPayments.data?.length || 0) > 0;
      const hasSignedFile = !!contract.signed_contract_file_url;

      setCanDelete(!hasRentDues && !hasRentPayments && !hasSignedFile);
      setCanCancel(!hasRentDues && !hasRentPayments);
    } catch (error) {
      console.error("Error checking eligibility:", error);
      setCanDelete(false);
      setCanCancel(false);
    } finally {
      setCheckingHistory(false);
    }
  };

  const handleEndContract = async () => {
    setIsProcessing(true);
    try {
      const { error } = await supabase
        .from("contracts")
        .update({
          is_active: false,
          end_date: new Date().toISOString().split("T")[0],
        })
        .eq("id", contract.id);

      if (error) throw error;

      // Update property status to vacant
      await supabase
        .from("properties")
        .update({ status: "vacant" })
        .eq("id", contract.property_id);

      toast({
        title: "Contract ended",
        description: "The contract has been ended.",
      });
      setEndContractOpen(false);
      onRefresh();
    } catch (error) {
      console.error("Error ending contract:", error);
      toast({
        title: "Error",
        description: "Failed to end contract.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancelContract = async () => {
    setIsProcessing(true);
    try {
      const { error } = await supabase
        .from("contracts")
        .update({ is_active: false })
        .eq("id", contract.id);

      if (error) throw error;

      // Update property status to vacant
      await supabase
        .from("properties")
        .update({ status: "vacant" })
        .eq("id", contract.property_id);

      toast({
        title: "Contract canceled",
        description: "The contract has been canceled.",
      });
      setCancelContractOpen(false);
      onRefresh();
    } catch (error) {
      console.error("Error canceling contract:", error);
      toast({
        title: "Error",
        description: "Failed to cancel contract.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDelete = async () => {
    setIsProcessing(true);
    try {
      // Delete tenancy links first
      await supabase
        .from("tenancy_links")
        .delete()
        .eq("property_id", contract.property_id);

      const { error } = await supabase
        .from("contracts")
        .delete()
        .eq("id", contract.id);

      if (error) throw error;

      // Update property status to vacant
      await supabase
        .from("properties")
        .update({ status: "vacant" })
        .eq("id", contract.property_id);

      toast({
        title: "Contract deleted permanently",
        description: "The contract has been removed.",
      });
      setDeleteModalOpen(false);
      onRefresh();
    } catch (error) {
      console.error("Error deleting contract:", error);
      toast({
        title: "Error",
        description: "Failed to delete contract.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
          <DropdownMenuItem onClick={onEdit}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {contract.is_active && (
            <>
              <DropdownMenuItem onClick={() => setEndContractOpen(true)} disabled={isProcessing}>
                <StopCircle className="mr-2 h-4 w-4" />
                End contract
              </DropdownMenuItem>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div>
                      <DropdownMenuItem
                        onClick={() => setCancelContractOpen(true)}
                        disabled={!canCancel || checkingHistory || isProcessing}
                      >
                        <XCircle className="mr-2 h-4 w-4" />
                        Cancel contract
                      </DropdownMenuItem>
                    </div>
                  </TooltipTrigger>
                  {!canCancel && !checkingHistory && (
                    <TooltipContent>
                      <p>Cannot cancel because this contract has rent history.</p>
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
            </>
          )}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <DropdownMenuItem
                    onClick={() => setDeleteModalOpen(true)}
                    disabled={!canDelete || checkingHistory || isProcessing}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete permanently
                  </DropdownMenuItem>
                </div>
              </TooltipTrigger>
              {!canDelete && !checkingHistory && (
                <TooltipContent>
                  <p>Cannot delete because this contract has rent history. End the contract instead.</p>
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* End Contract Dialog */}
      <AlertDialog open={endContractOpen} onOpenChange={setEndContractOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>End contract?</AlertDialogTitle>
            <AlertDialogDescription>
              This will mark the contract as ended and set the end date to today. 
              The property will be marked as vacant. Rent history will be preserved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleEndContract} disabled={isProcessing}>
              {isProcessing ? "Ending..." : "End contract"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel Contract Dialog */}
      <AlertDialog open={cancelContractOpen} onOpenChange={setCancelContractOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel contract?</AlertDialogTitle>
            <AlertDialogDescription>
              This will cancel the contract. The property will be marked as vacant.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancelContract} disabled={isProcessing}>
              {isProcessing ? "Canceling..." : "Cancel contract"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        open={deleteModalOpen}
        onOpenChange={setDeleteModalOpen}
        onConfirm={handleDelete}
        title="Delete contract permanently?"
        description="This will remove the contract. This cannot be undone."
        loading={isProcessing}
      />
    </>
  );
}
