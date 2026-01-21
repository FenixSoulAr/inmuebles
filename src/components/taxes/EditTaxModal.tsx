import { useState, useEffect } from "react";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface EditTaxModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taxId: string | null;
  taxDetails: {
    property: string;
    taxType: string;
    dueDate: string;
    amount: number | null;
    notes: string | null;
  } | null;
  onSuccess: () => void;
}

export function EditTaxModal({
  open,
  onOpenChange,
  taxId,
  taxDetails,
  onSuccess,
}: EditTaxModalProps) {
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (taxDetails) {
      setDueDate(new Date(taxDetails.dueDate));
      setAmount(taxDetails.amount?.toString() || "");
      setNotes(taxDetails.notes || "");
    }
  }, [taxDetails]);

  const handleSubmit = async () => {
    if (!taxId || !dueDate) {
      toast({
        title: "Error",
        description: "Please select a due date.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from("tax_obligations")
        .update({
          due_date: format(dueDate, "yyyy-MM-dd"),
          amount: amount ? parseFloat(amount) : null,
          notes: notes || null,
        })
        .eq("id", taxId);

      if (error) throw error;

      toast({
        title: "Tax record updated",
        description: "Your changes have been saved.",
      });

      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error("Error updating tax:", error);
      toast({
        title: "Error",
        description: "Could not update tax record. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>Edit tax record</DialogTitle>
          <DialogDescription>
            {taxDetails && (
              <>
                {taxDetails.property} • {taxDetails.taxType}
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Due Date */}
          <div className="space-y-2">
            <Label>Due date *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !dueDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dueDate ? format(dueDate, "PPP") : "Select date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dueDate}
                  onSelect={setDueDate}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Amount */}
          <div className="space-y-2">
            <Label>Amount</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add notes about this tax record..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || !dueDate}>
            {isSubmitting ? "Saving..." : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
