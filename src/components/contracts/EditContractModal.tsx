import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";

const contractSchema = z.object({
  end_date: z.string().min(1, "End date is required."),
  clauses_text: z.string().optional(),
  adjustment_type: z.string().min(1),
  adjustment_frequency: z.coerce.number().min(1).optional(),
  next_adjustment_date: z.string().optional(),
  submission_language: z.string().min(1),
});

type ContractFormData = z.infer<typeof contractSchema>;

interface Contract {
  id: string;
  start_date: string;
  end_date: string;
  current_rent: number;
  initial_rent: number;
  deposit: number | null;
  is_active: boolean;
  adjustment_type: string;
  adjustment_frequency: number | null;
  clauses_text: string | null;
  next_adjustment_date: string | null;
  property_id: string;
  tenant_id: string;
  public_submission_token: string | null;
  token_status: string;
  submission_language?: string;
}

interface EditContractModalProps {
  contract: Contract | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  hasRentDues: boolean;
}

export function EditContractModal({
  contract,
  open,
  onOpenChange,
  onSuccess,
  hasRentDues,
}: EditContractModalProps) {
  const { toast } = useToast();
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ContractFormData>({
    resolver: zodResolver(contractSchema),
  });

  const selectedAdjustmentType = watch("adjustment_type");

  useEffect(() => {
    if (contract && open) {
      reset({
        end_date: contract.end_date,
        clauses_text: contract.clauses_text || "",
        adjustment_type: contract.adjustment_type,
        adjustment_frequency: contract.adjustment_frequency || 12,
        next_adjustment_date: contract.next_adjustment_date || "",
        submission_language: contract.submission_language || "es",
      });
    }
  }, [contract, open, reset]);

  const onSubmit = async (data: ContractFormData) => {
    if (!contract) return;

    // Validate end_date >= start_date
    if (data.end_date < contract.start_date) {
      toast({
        title: "Error",
        description: "End date cannot be before the start date.",
        variant: "destructive",
      });
      return;
    }

    try {
      const today = new Date().toISOString().split("T")[0];
      const newEndDate = data.end_date;
      const wasInactive = !contract.is_active;
      const shouldBeActive = today <= newEndDate;
      const endDateReduced = newEndDate < contract.end_date;

      const updateData: Record<string, unknown> = {
        end_date: newEndDate,
        clauses_text: data.clauses_text || null,
        is_active: shouldBeActive,
        submission_language: data.submission_language,
      };

      // Only allow changing adjustment settings if no rent dues exist
      if (!hasRentDues) {
        updateData.adjustment_type = data.adjustment_type;
        updateData.adjustment_frequency = data.adjustment_frequency;
      }

      if (data.next_adjustment_date) {
        updateData.next_adjustment_date = data.next_adjustment_date;
      }

      // Handle token logic based on activation status
      if (shouldBeActive) {
        if (!contract.public_submission_token) {
          const newToken = Array.from(crypto.getRandomValues(new Uint8Array(32)))
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("");
          updateData.public_submission_token = newToken;
          updateData.token_status = "active";
          updateData.token_created_at = new Date().toISOString();
        } else if (contract.token_status === "disabled") {
          updateData.token_status = "active";
        }
      } else {
        updateData.token_status = "disabled";
      }

      const { error } = await supabase
        .from("contracts")
        .update(updateData)
        .eq("id", contract.id);

      if (error) throw error;

      // If endDate was reduced, clean up future obligations beyond new endDate
      if (endDateReduced) {
        const d = new Date(newEndDate);
        const cutoffPeriod = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

        const { data: toDelete } = await supabase
          .from("obligations")
          .select("id, status")
          .eq("contract_id", contract.id)
          .gt("period", cutoffPeriod);

        if (toDelete && toDelete.length > 0) {
          const deletableIds = toDelete
            .filter((o) => o.status !== "approved")
            .map((o) => o.id);

          if (deletableIds.length > 0) {
            await supabase.from("obligations").delete().in("id", deletableIds);
          }
        }
      }

      if (wasInactive && shouldBeActive) {
        toast({
          title: "Contract reactivated",
          description: "The contract has been reactivated. Submission link enabled.",
        });
      } else {
        toast({
          title: "Contract updated",
          description: "The contract has been updated successfully.",
        });
      }

      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error("Error updating contract:", error);
      toast({
        title: "Error",
        description: "Failed to update contract. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Contract</DialogTitle>
        </DialogHeader>

        {hasRentDues && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Some fields are locked because this contract already has rent history.
            </AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label htmlFor="end_date">End Date</Label>
            <Input
              id="end_date"
              type="date"
              {...register("end_date")}
            />
            {errors.end_date && (
              <p className="text-sm text-destructive">{errors.end_date.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Adjustment Type</Label>
            <Select
              value={selectedAdjustmentType}
              onValueChange={(value) => setValue("adjustment_type", value)}
              disabled={hasRentDues}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ipc">IPC (Consumer Price Index)</SelectItem>
                <SelectItem value="icl">ICL (Construction Index)</SelectItem>
                <SelectItem value="fixed">Fixed Percentage</SelectItem>
                <SelectItem value="manual">Manual Adjustment</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="adjustment_frequency">Adjustment Frequency (months)</Label>
            <Input
              id="adjustment_frequency"
              type="number"
              min="1"
              {...register("adjustment_frequency")}
              disabled={hasRentDues}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="next_adjustment_date">Next Adjustment Date</Label>
            <Input
              id="next_adjustment_date"
              type="date"
              {...register("next_adjustment_date")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="clauses_text">Additional Clauses</Label>
            <Textarea
              id="clauses_text"
              placeholder="Any additional terms..."
              rows={4}
              {...register("clauses_text")}
            />
          </div>

          <div className="space-y-2">
            <Label>Tenant Form Language</Label>
            <Select
              value={watch("submission_language")}
              onValueChange={(value) => setValue("submission_language", value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="es">Español</SelectItem>
                <SelectItem value="en">English</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save changes"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
