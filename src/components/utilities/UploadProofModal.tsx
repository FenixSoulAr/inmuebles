import { useState, useRef } from "react";
import { Upload, X, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

interface UploadProofModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  proofId: string | null;
  proofDetails: {
    property: string;
    utilityType: string;
    period: string;
  } | null;
  onSuccess: () => void;
}

export function UploadProofModal({
  open,
  onOpenChange,
  proofId,
  proofDetails,
  onSuccess,
}: UploadProofModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (selectedFile.size > 10 * 1024 * 1024) {
      toast({
        title: "Error",
        description: "File is too large. Maximum size is 10MB.",
        variant: "destructive",
      });
      return;
    }

    const allowedTypes = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(selectedFile.type)) {
      toast({
        title: "Error",
        description: "File type not supported. Please upload PDF, JPG, PNG, or WebP.",
        variant: "destructive",
      });
      return;
    }

    setFile(selectedFile);
  };

  const removeFile = () => {
    setFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async () => {
    if (!proofId || !file || !user) {
      toast({
        title: "Error",
        description: "Please select a file to upload.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Upload file to storage
      const fileExt = file.name.split(".").pop();
      const fileName = `utility-proofs/${user.id}/${proofId}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Get the utility proof to find obligation details
      const { data: proofData, error: fetchError } = await supabase
        .from("utility_proofs")
        .select("utility_obligation_id, period_month")
        .eq("id", proofId)
        .single();

      if (fetchError) throw fetchError;

      // Update the utility proof record — store storage path, not public URL
      const { error: updateError } = await supabase
        .from("utility_proofs")
        .update({
          file_url: fileName,
          status: "paid_with_proof",
          submitted_at: new Date().toISOString(),
        })
        .eq("id", proofId);

      if (updateError) throw updateError;

      // Rolling generation: create next future period if needed
      if (proofData) {
        // Get obligation frequency
        const { data: obligation } = await supabase
          .from("utility_obligations")
          .select("frequency")
          .eq("id", proofData.utility_obligation_id)
          .single();

        if (obligation) {
          // Calculate month increment based on frequency
          const getMonthIncrement = (freq: string): number => {
            switch (freq) {
              case "bimonthly": return 2;
              case "quarterly": return 3;
              case "annual": return 12;
              default: return 1;
            }
          };

          const monthIncrement = getMonthIncrement(obligation.frequency);
          const [year, month] = proofData.period_month.split("-").map(Number);
          
          // Find the furthest existing period for this obligation
          const { data: existingProofs } = await supabase
            .from("utility_proofs")
            .select("period_month")
            .eq("utility_obligation_id", proofData.utility_obligation_id)
            .order("period_month", { ascending: false })
            .limit(1);

          if (existingProofs && existingProofs.length > 0) {
            const [latestYear, latestMonth] = existingProofs[0].period_month.split("-").map(Number);
            const latestDate = new Date(latestYear, latestMonth - 1);
            latestDate.setMonth(latestDate.getMonth() + monthIncrement);
            
            const nextPeriod = `${latestDate.getFullYear()}-${String(latestDate.getMonth() + 1).padStart(2, "0")}`;

            // Check if this period already exists
            const { data: existingPeriod } = await supabase
              .from("utility_proofs")
              .select("id")
              .eq("utility_obligation_id", proofData.utility_obligation_id)
              .eq("period_month", nextPeriod)
              .maybeSingle();

            if (!existingPeriod) {
              // Create the next period proof
              await supabase
                .from("utility_proofs")
                .insert({
                  utility_obligation_id: proofData.utility_obligation_id,
                  period_month: nextPeriod,
                  status: "not_submitted",
                });
            }
          }
        }
      }

      toast({
        title: "Proof uploaded",
        description: "Utility proof uploaded successfully.",
      });

      // Reset and close
      setFile(null);
      setNotes("");
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error("Error uploading proof:", error);
      toast({
        title: "Error",
        description: "Could not upload proof. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setNotes("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Upload proof of payment</DialogTitle>
          <DialogDescription>
            {proofDetails && (
              <>
                {proofDetails.property} • {proofDetails.utilityType} • {proofDetails.period}
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="proof-file">Proof file</Label>
            <p className="text-sm text-muted-foreground">
              Upload a PDF or image of the payment receipt.
            </p>
            <Input
              id="proof-file"
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              className="cursor-pointer"
            />
            {file && (
              <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                <FileText className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm flex-1 truncate">{file.name}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={removeFile}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="proof-notes">Notes (optional)</Label>
            <Textarea
              id="proof-notes"
              placeholder="Add any notes about this payment..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter className="border-t pt-4">
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || !file}>
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                Upload proof
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
