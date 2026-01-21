import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
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

const propertySchema = z.object({
  type: z.string().min(1, "Property type is required."),
  full_address: z.string().min(1, "Address is required."),
  internal_identifier: z.string().min(1, "Internal ID is required."),
  status: z.string().min(1, "Status is required."),
});

type PropertyFormData = z.infer<typeof propertySchema>;

interface Property {
  id: string;
  type: string;
  full_address: string;
  internal_identifier: string;
  status: string;
}

interface EditPropertyModalProps {
  property: Property | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function EditPropertyModal({
  property,
  open,
  onOpenChange,
  onSuccess,
}: EditPropertyModalProps) {
  const { toast } = useToast();
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<PropertyFormData>({
    resolver: zodResolver(propertySchema),
  });

  const selectedType = watch("type");
  const selectedStatus = watch("status");

  useEffect(() => {
    if (property && open) {
      reset({
        type: property.type,
        full_address: property.full_address,
        internal_identifier: property.internal_identifier,
        status: property.status,
      });
    }
  }, [property, open, reset]);

  const onSubmit = async (data: PropertyFormData) => {
    if (!property) return;

    try {
      const { error } = await supabase
        .from("properties")
        .update({
          type: data.type,
          full_address: data.full_address,
          internal_identifier: data.internal_identifier,
          status: data.status,
        })
        .eq("id", property.id);

      if (error) throw error;

      toast({
        title: "Property updated",
        description: "The property has been updated successfully.",
      });
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error("Error updating property:", error);
      toast({
        title: "Error",
        description: "Failed to update property. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Property</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label>Property Type</Label>
            <Select
              value={selectedType}
              onValueChange={(value) => setValue("type", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="apartment">Apartment</SelectItem>
                <SelectItem value="house">House</SelectItem>
                <SelectItem value="commercial">Commercial</SelectItem>
                <SelectItem value="land">Land</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
            {errors.type && (
              <p className="text-sm text-destructive">{errors.type.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="full_address">Full Address</Label>
            <Input
              id="full_address"
              placeholder="123 Main St, City, Country"
              {...register("full_address")}
            />
            {errors.full_address && (
              <p className="text-sm text-destructive">{errors.full_address.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="internal_identifier">Internal Identifier</Label>
            <Input
              id="internal_identifier"
              placeholder="APT-001"
              {...register("internal_identifier")}
            />
            {errors.internal_identifier && (
              <p className="text-sm text-destructive">{errors.internal_identifier.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Status</Label>
            <Select
              value={selectedStatus}
              onValueChange={(value) => setValue("status", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="vacant">Vacant</SelectItem>
                <SelectItem value="occupied">Occupied</SelectItem>
                <SelectItem value="under_repair">Under Repair</SelectItem>
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
