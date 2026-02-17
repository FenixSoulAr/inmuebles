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

const tenantSchema = z.object({
  full_name: z.string().min(1, "Name is required."),
  doc_id: z.string().optional(),
  email: z.string().email("Enter a valid email.").optional().or(z.literal("")),
  phone: z.string().optional(),
  status: z.string().min(1),
  preferred_language: z.string().min(1),
});

type TenantFormData = z.infer<typeof tenantSchema>;

interface Tenant {
  id: string;
  full_name: string;
  doc_id: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  preferred_language?: string;
}

interface EditTenantModalProps {
  tenant: Tenant | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function EditTenantModal({
  tenant,
  open,
  onOpenChange,
  onSuccess,
}: EditTenantModalProps) {
  const { toast } = useToast();
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<TenantFormData>({
    resolver: zodResolver(tenantSchema),
  });

  const selectedStatus = watch("status");

  useEffect(() => {
    if (tenant && open) {
      reset({
        full_name: tenant.full_name,
        doc_id: tenant.doc_id || "",
        email: tenant.email || "",
        phone: tenant.phone || "",
        status: tenant.status,
        preferred_language: tenant.preferred_language || "es",
      });
    }
  }, [tenant, open, reset]);

  const onSubmit = async (data: TenantFormData) => {
    if (!tenant) return;

    try {
      const { error } = await supabase
        .from("tenants")
        .update({
          full_name: data.full_name,
          doc_id: data.doc_id || null,
          email: data.email || null,
          phone: data.phone || null,
          status: data.status,
          preferred_language: data.preferred_language,
        })
        .eq("id", tenant.id);

      if (error) throw error;

      toast({
        title: "Tenant updated",
        description: "The tenant has been updated successfully.",
      });
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error("Error updating tenant:", error);
      toast({
        title: "Error",
        description: "Failed to update tenant. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Tenant</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="full_name">Full Name *</Label>
            <Input
              id="full_name"
              placeholder="John Doe"
              {...register("full_name")}
            />
            {errors.full_name && (
              <p className="text-sm text-destructive">{errors.full_name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="doc_id">Document ID</Label>
            <Input
              id="doc_id"
              placeholder="Optional"
              {...register("doc_id")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="tenant@email.com"
              {...register("email")}
            />
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              placeholder="+1 234 567 8900"
              {...register("phone")}
            />
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
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Preferred Language (public form)</Label>
            <Select
              value={watch("preferred_language")}
              onValueChange={(value) => setValue("preferred_language", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select language" />
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
