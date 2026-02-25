import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Mail,
  Phone,
  FileText,
  Users,
  Building2,
  Plus,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

interface Tenant {
  id: string;
  full_name: string;
  doc_id: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  created_at: string;
}

interface Guarantor {
  id: string;
  full_name: string;
  contact_info: string | null;
  notes: string | null;
}

interface TenancyLink {
  id: string;
  property_id: string;
  start_date: string;
  end_date: string | null;
  notes: string | null;
  properties: {
    internal_identifier: string;
    full_address: string;
  };
}

const guarantorSchema = z.object({
  full_name: z.string().min(1, "Name is required."),
  contact_info: z.string().optional(),
  notes: z.string().optional(),
});

type GuarantorFormData = z.infer<typeof guarantorSchema>;

export default function TenantDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [guarantors, setGuarantors] = useState<Guarantor[]>([]);
  const [tenancyLinks, setTenancyLinks] = useState<TenancyLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<GuarantorFormData>({
    resolver: zodResolver(guarantorSchema),
  });

  useEffect(() => {
    if (id) fetchTenantData();
  }, [id]);

  const fetchTenantData = async () => {
    try {
      const [tenantRes, guarantorsRes, linksRes] = await Promise.all([
        supabase.from("tenants").select("*").eq("id", id).maybeSingle(),
        supabase.from("guarantors").select("*").eq("tenant_id", id),
        supabase
          .from("tenancy_links")
          .select("*, properties(internal_identifier, full_address)")
          .eq("tenant_id", id)
          .order("start_date", { ascending: false }),
      ]);

      if (tenantRes.error) throw tenantRes.error;
      if (!tenantRes.data) {
        navigate("/tenants");
        return;
      }

      setTenant(tenantRes.data);
      setGuarantors(guarantorsRes.data || []);
      setTenancyLinks(linksRes.data || []);
    } catch (error) {
      console.error("Error fetching tenant:", error);
      toast({
        title: "Error",
        description: "Something went wrong. Please refresh.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const onSubmitGuarantor = async (data: GuarantorFormData) => {
    if (!tenant) return;
    setIsSubmitting(true);

    try {
      const { error } = await supabase.from("guarantors").insert({
        tenant_id: tenant.id,
        full_name: data.full_name,
        contact_info: data.contact_info || null,
        notes: data.notes || null,
      } as any);

      if (error) throw error;

      toast({
        title: "Guarantor added",
        description: "Guarantor has been added successfully.",
      });
      setDialogOpen(false);
      reset();
      fetchTenantData();
    } catch (error) {
      console.error("Error adding guarantor:", error);
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

  if (!tenant) return null;

  return (
    <div>
      <Button
        variant="ghost"
        size="sm"
        className="mb-4"
        onClick={() => navigate("/tenants")}
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Tenants
      </Button>

      <PageHeader title={tenant.full_name}>
        <StatusBadge variant={tenant.status as any} />
      </PageHeader>

      {/* Tenant Info Card */}
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex items-center justify-center w-16 h-16 rounded-full bg-accent/10 text-accent text-2xl font-semibold">
                  {tenant.full_name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-semibold text-lg">{tenant.full_name}</p>
                  {tenant.doc_id && (
                    <p className="text-muted-foreground">ID: {tenant.doc_id}</p>
                  )}
                </div>
              </div>
            </div>
            <div className="space-y-3">
              {tenant.email && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="w-4 h-4" />
                  <a href={`mailto:${tenant.email}`} className="hover:underline">
                    {tenant.email}
                  </a>
                </div>
              )}
              {tenant.phone && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="w-4 h-4" />
                  <span>{tenant.phone}</span>
                </div>
              )}
              <div>
                <p className="text-sm text-muted-foreground">Member since</p>
                <p className="font-medium">
                  {new Date(tenant.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="guarantors" className="space-y-4">
        <TabsList>
          <TabsTrigger value="guarantors">Guarantors</TabsTrigger>
          <TabsTrigger value="history">Tenancy History</TabsTrigger>
        </TabsList>

        <TabsContent value="guarantors">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Guarantors</CardTitle>
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="w-4 h-4 mr-2" />
                    Add guarantor
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Guarantor</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleSubmit(onSubmitGuarantor)} className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label htmlFor="full_name">Full Name *</Label>
                      <Input
                        id="full_name"
                        placeholder="Guarantor name"
                        {...register("full_name")}
                      />
                      {errors.full_name && (
                        <p className="text-sm text-destructive">{errors.full_name.message}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="contact_info">Contact Info</Label>
                      <Input
                        id="contact_info"
                        placeholder="Phone or email"
                        {...register("contact_info")}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="notes">Notes</Label>
                      <Textarea
                        id="notes"
                        placeholder="Additional notes..."
                        {...register("notes")}
                      />
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                      <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting ? "Adding..." : "Add guarantor"}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {guarantors.length === 0 ? (
                <EmptyState
                  icon={Users}
                  title="No guarantors"
                  description="Add guarantors for this tenant."
                  className="py-8"
                />
              ) : (
                <div className="space-y-3">
                  {guarantors.map((g) => (
                    <div
                      key={g.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                    >
                      <div>
                        <p className="font-medium">{g.full_name}</p>
                        {g.contact_info && (
                          <p className="text-sm text-muted-foreground">{g.contact_info}</p>
                        )}
                        {g.notes && (
                          <p className="text-xs text-muted-foreground mt-1">{g.notes}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Tenancy History</CardTitle>
            </CardHeader>
            <CardContent>
              {tenancyLinks.length === 0 ? (
                <EmptyState
                  icon={Building2}
                  title="No tenancy history"
                  description="This tenant has no property history yet."
                  className="py-8"
                />
              ) : (
                <div className="space-y-3">
                  {tenancyLinks.map((link) => (
                    <div
                      key={link.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                    >
                      <div>
                        <p className="font-medium">{link.properties.internal_identifier}</p>
                        <p className="text-sm text-muted-foreground">{link.properties.full_address}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(link.start_date).toLocaleDateString()} -{" "}
                          {link.end_date
                            ? new Date(link.end_date).toLocaleDateString()
                            : "Present"}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
