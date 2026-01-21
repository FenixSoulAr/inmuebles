import { useState, useEffect } from "react";
import { MoreHorizontal, Pencil, Power, PowerOff, Trash2 } from "lucide-react";
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

interface Property {
  id: string;
  type: string;
  full_address: string;
  internal_identifier: string;
  status: string;
  active?: boolean;
}

interface PropertyActionMenuProps {
  property: Property;
  onEdit: () => void;
  onRefresh: () => void;
}

export function PropertyActionMenu({
  property,
  onEdit,
  onRefresh,
}: PropertyActionMenuProps) {
  const { toast } = useToast();
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [canDelete, setCanDelete] = useState(false);
  const [checkingHistory, setCheckingHistory] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const isActive = property.active !== false;

  useEffect(() => {
    checkDeletionEligibility();
  }, [property.id]);

  const checkDeletionEligibility = async () => {
    setCheckingHistory(true);
    try {
      // Check for any linked records
      const [contracts, rentDues, utilities, taxes, maintenance, documents] = await Promise.all([
        supabase.from("contracts").select("id").eq("property_id", property.id).limit(1),
        supabase.from("rent_dues").select("id").eq("property_id", property.id).limit(1),
        supabase.from("utility_obligations").select("id").eq("property_id", property.id).limit(1),
        supabase.from("tax_obligations").select("id").eq("property_id", property.id).limit(1),
        supabase.from("maintenance_issues").select("id").eq("property_id", property.id).limit(1),
        supabase.from("property_documents").select("id").eq("property_id", property.id).limit(1),
      ]);

      const hasHistory =
        (contracts.data?.length || 0) > 0 ||
        (rentDues.data?.length || 0) > 0 ||
        (utilities.data?.length || 0) > 0 ||
        (taxes.data?.length || 0) > 0 ||
        (maintenance.data?.length || 0) > 0 ||
        (documents.data?.length || 0) > 0;

      setCanDelete(!hasHistory);
    } catch (error) {
      console.error("Error checking deletion eligibility:", error);
      setCanDelete(false);
    } finally {
      setCheckingHistory(false);
    }
  };

  const handleDeactivate = async () => {
    setIsProcessing(true);
    try {
      const { error } = await supabase
        .from("properties")
        .update({ active: false })
        .eq("id", property.id);

      if (error) throw error;

      toast({
        title: "Property deactivated",
        description: "The property has been deactivated.",
      });
      onRefresh();
    } catch (error) {
      console.error("Error deactivating property:", error);
      toast({
        title: "Error",
        description: "Failed to deactivate property.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReactivate = async () => {
    setIsProcessing(true);
    try {
      const { error } = await supabase
        .from("properties")
        .update({ active: true })
        .eq("id", property.id);

      if (error) throw error;

      toast({
        title: "Property reactivated",
        description: "The property has been reactivated.",
      });
      onRefresh();
    } catch (error) {
      console.error("Error reactivating property:", error);
      toast({
        title: "Error",
        description: "Failed to reactivate property.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDelete = async () => {
    setIsProcessing(true);
    try {
      const { error } = await supabase
        .from("properties")
        .delete()
        .eq("id", property.id);

      if (error) throw error;

      toast({
        title: "Property deleted permanently",
        description: "The property has been removed.",
      });
      setDeleteModalOpen(false);
      onRefresh();
    } catch (error) {
      console.error("Error deleting property:", error);
      toast({
        title: "Error",
        description: "Failed to delete property.",
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
          {isActive ? (
            <DropdownMenuItem onClick={handleDeactivate} disabled={isProcessing}>
              <PowerOff className="mr-2 h-4 w-4" />
              Deactivate
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onClick={handleReactivate} disabled={isProcessing}>
              <Power className="mr-2 h-4 w-4" />
              Reactivate
            </DropdownMenuItem>
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
                  <p>Cannot delete because this property has history. Deactivate it instead.</p>
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        </DropdownMenuContent>
      </DropdownMenu>

      <DeleteConfirmationModal
        open={deleteModalOpen}
        onOpenChange={setDeleteModalOpen}
        onConfirm={handleDelete}
        title="Delete property permanently?"
        description="This will remove the property. This cannot be undone."
        loading={isProcessing}
      />
    </>
  );
}
