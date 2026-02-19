import { useState, useRef } from "react";
import { Upload, X, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

interface UploadTaxReceiptModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taxId: string | null;
  taxDetails: {
    property: string;
    taxType: string;
    dueDate: string;
  } | null;
  onSuccess: () => void;
}

export function UploadTaxReceiptModal({
  open,
  onOpenChange,
  taxId,
  taxDetails,
  onSuccess,
}: UploadTaxReceiptModalProps) {
  const [file, setFile] = useState<File | null>(null);
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
    if (!taxId || !file || !user) {
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
      const fileName = `tax-receipts/${user.id}/${taxId}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Update the tax obligation record — store storage path, not public URL
      const { error: updateError } = await supabase
        .from("tax_obligations")
        .update({
          receipt_file_url: fileName,
          status: "ok",
        })
        .eq("id", taxId);

      if (updateError) throw updateError;

      toast({
        title: "Receipt uploaded",
        description: "Tax receipt uploaded successfully.",
      });

      // Reset and close
      setFile(null);
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error("Error uploading receipt:", error);
      toast({
        title: "Error",
        description: "Could not upload receipt. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Upload tax receipt</DialogTitle>
          <DialogDescription>
            {taxDetails && (
              <>
                {taxDetails.property} • {taxDetails.taxType} • Due: {new Date(taxDetails.dueDate).toLocaleDateString()}
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="receipt-file">Receipt file</Label>
            <p className="text-sm text-muted-foreground">
              Upload a PDF or image of the tax receipt.
            </p>
            <Input
              id="receipt-file"
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
        </div>

        <DialogFooter>
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
                Upload receipt
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
