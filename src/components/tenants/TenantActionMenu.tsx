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

interface Tenant {
  id: string;
  full_name: string;
  status: string;
}

interface TenantActionMenuProps {
  tenant: Tenant;
  onEdit: () => void;
  onRefresh: () => void;
}

export function TenantActionMenu({
  tenant,
  onEdit,
  onRefresh,
}: TenantActionMenuProps) {
  const { toast } = useToast();
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [canDelete, setCanDelete] = useState(false);
  const [checkingHistory, setCheckingHistory] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const isActive = tenant.status === "active";

  useEffect(() => {
    checkDeletionEligibility();
  }, [tenant.id]);

  const checkDeletionEligibility = async () => {
    setCheckingHistory(true);
    try {
      // Check for any linked records
      const [contracts, tenancyLinks, rentPayments] = await Promise.all([
        supabase.from("contracts").select("id").eq("tenant_id", tenant.id).limit(1),
        supabase.from("tenancy_links").select("id").eq("tenant_id", tenant.id).limit(1),
        supabase.from("rent_dues").select("id").eq("tenant_id", tenant.id).limit(1),
      ]);

      const hasHistory =
        (contracts.data?.length || 0) > 0 ||
        (tenancyLinks.data?.length || 0) > 0 ||
        (rentPayments.data?.length || 0) > 0;

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
        .from("tenants")
        .update({ status: "inactive" })
        .eq("id", tenant.id);

      if (error) throw error;

      toast({
        title: "Tenant deactivated",
        description: "The tenant has been deactivated.",
      });
      onRefresh();
    } catch (error) {
      console.error("Error deactivating tenant:", error);
      toast({
        title: "Error",
        description: "Failed to deactivate tenant.",
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
        .from("tenants")
        .update({ status: "active" })
        .eq("id", tenant.id);

      if (error) throw error;

      toast({
        title: "Tenant reactivated",
        description: "The tenant has been reactivated.",
      });
      onRefresh();
    } catch (error) {
      console.error("Error reactivating tenant:", error);
      toast({
        title: "Error",
        description: "Failed to reactivate tenant.",
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
        .from("tenants")
        .delete()
        .eq("id", tenant.id);

      if (error) throw error;

      toast({
        title: "Tenant deleted permanently",
        description: "The tenant has been removed.",
      });
      setDeleteModalOpen(false);
      onRefresh();
    } catch (error) {
      console.error("Error deleting tenant:", error);
      toast({
        title: "Error",
        description: "Failed to delete tenant.",
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
                  <p>Cannot delete because this tenant has history. Deactivate it instead.</p>
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
        title="Delete tenant permanently?"
        description="This will remove the tenant. This cannot be undone."
        loading={isProcessing}
      />
    </>
  );
}
