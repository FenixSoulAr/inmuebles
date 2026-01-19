import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

interface Property {
  id: string;
  internal_identifier: string;
  full_address: string;
}

interface Tenant {
  id: string;
  full_name: string;
}

const contractSchema = z.object({
  property_id: z.string().min(1, "Property is required."),
  tenant_id: z.string().min(1, "Tenant is required."),
  start_date: z.string().min(1, "Start date is required."),
  end_date: z.string().min(1, "End date is required."),
  initial_rent: z.number().min(0.01, "Enter a valid amount greater than 0."),
  deposit: z.number().optional(),
  clauses_text: z.string().optional(),
  adjustment_type: z.string().min(1),
  adjustment_frequency: z.number().optional(),
}).refine((data) => new Date(data.end_date) > new Date(data.start_date), {
  message: "End date must be after start date.",
  path: ["end_date"],
});

type ContractFormData = z.infer<typeof contractSchema>;

export default function ContractNew() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
    watch,
  } = useForm<ContractFormData>({
    resolver: zodResolver(contractSchema),
    defaultValues: {
      adjustment_type: "manual",
      adjustment_frequency: 12,
    },
  });

  useEffect(() => {
    if (user) fetchData();
  }, [user]);

  const fetchData = async () => {
    try {
      const [propertiesRes, tenantsRes] = await Promise.all([
        supabase.from("properties").select("id, internal_identifier, full_address"),
        supabase.from("tenants").select("id, full_name").eq("status", "active"),
      ]);

      if (propertiesRes.error) throw propertiesRes.error;
      if (tenantsRes.error) throw tenantsRes.error;

      setProperties(propertiesRes.data || []);
      setTenants(tenantsRes.data || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast({
        title: "Error",
        description: "Something went wrong. Please refresh.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data: ContractFormData) => {
    setIsSubmitting(true);

    try {
      // Check for overlapping contracts
      const { data: existingContracts, error: checkError } = await supabase
        .from("contracts")
        .select("id, start_date, end_date")
        .eq("property_id", data.property_id)
        .eq("is_active", true);

      if (checkError) throw checkError;

      const newStart = new Date(data.start_date);
      const newEnd = new Date(data.end_date);

      const hasOverlap = existingContracts?.some((contract) => {
        const existingStart = new Date(contract.start_date);
        const existingEnd = new Date(contract.end_date);
        return newStart <= existingEnd && newEnd >= existingStart;
      });

      if (hasOverlap) {
        toast({
          title: "Conflict",
          description: "This property already has an active contract for the selected dates.",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }

      // Create contract
      const { error } = await supabase.from("contracts").insert({
        property_id: data.property_id,
        tenant_id: data.tenant_id,
        start_date: data.start_date,
        end_date: data.end_date,
        initial_rent: data.initial_rent,
        current_rent: data.initial_rent,
        deposit: data.deposit || null,
        clauses_text: data.clauses_text || null,
        adjustment_type: data.adjustment_type,
        adjustment_frequency: data.adjustment_frequency || 12,
        is_active: true,
      });

      if (error) throw error;

      // Create tenancy link
      await supabase.from("tenancy_links").insert({
        property_id: data.property_id,
        tenant_id: data.tenant_id,
        start_date: data.start_date,
        end_date: data.end_date,
      });

      // Update property status
      await supabase
        .from("properties")
        .update({ status: "occupied" })
        .eq("id", data.property_id);

      toast({
        title: "Contract created",
        description: "The rental contract has been created successfully.",
      });
      navigate("/contracts");
    } catch (error) {
      console.error("Error creating contract:", error);
      toast({
        title: "Error",
        description: "Something went wrong. Please refresh.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <Button
        variant="ghost"
        size="sm"
        className="mb-4"
        onClick={() => navigate("/contracts")}
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Contracts
      </Button>

      <PageHeader
        title="New Contract"
        description="Create a new rental contract"
      />

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Contract Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Property Selection */}
            <div className="space-y-2">
              <Label>Property *</Label>
              <Controller
                name="property_id"
                control={control}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select property" />
                    </SelectTrigger>
                    <SelectContent>
                      {properties.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.internal_identifier} - {p.full_address}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.property_id && (
                <p className="text-sm text-destructive">{errors.property_id.message}</p>
              )}
            </div>

            {/* Tenant Selection */}
            <div className="space-y-2">
              <Label>Tenant *</Label>
              <Controller
                name="tenant_id"
                control={control}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select tenant" />
                    </SelectTrigger>
                    <SelectContent>
                      {tenants.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.tenant_id && (
                <p className="text-sm text-destructive">{errors.tenant_id.message}</p>
              )}
            </div>

            {/* Dates */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="start_date">Start Date *</Label>
                <Input type="date" id="start_date" {...register("start_date")} />
                {errors.start_date && (
                  <p className="text-sm text-destructive">{errors.start_date.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="end_date">End Date *</Label>
                <Input type="date" id="end_date" {...register("end_date")} />
                {errors.end_date && (
                  <p className="text-sm text-destructive">{errors.end_date.message}</p>
                )}
              </div>
            </div>

            {/* Financial */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="initial_rent">Monthly Rent *</Label>
                <Input
                  type="number"
                  id="initial_rent"
                  step="0.01"
                  placeholder="0.00"
                  {...register("initial_rent", { valueAsNumber: true })}
                />
                {errors.initial_rent && (
                  <p className="text-sm text-destructive">{errors.initial_rent.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="deposit">Deposit</Label>
                <Input
                  type="number"
                  id="deposit"
                  step="0.01"
                  placeholder="0.00"
                  {...register("deposit", { valueAsNumber: true })}
                />
              </div>
            </div>

            {/* Adjustment */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Adjustment Type</Label>
                <Controller
                  name="adjustment_type"
                  control={control}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ipc">IPC (Consumer Price Index)</SelectItem>
                        <SelectItem value="icl">ICL (Construction Index)</SelectItem>
                        <SelectItem value="fixed">Fixed Percentage</SelectItem>
                        <SelectItem value="manual">Manual Adjustment</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="adjustment_frequency">Frequency (months)</Label>
                <Input
                  type="number"
                  id="adjustment_frequency"
                  {...register("adjustment_frequency", { valueAsNumber: true })}
                />
              </div>
            </div>

            {/* Clauses */}
            <div className="space-y-2">
              <Label htmlFor="clauses_text">Additional Clauses</Label>
              <Textarea
                id="clauses_text"
                placeholder="Enter any special terms or conditions..."
                rows={4}
                {...register("clauses_text")}
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => navigate("/contracts")}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Add contract"
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
