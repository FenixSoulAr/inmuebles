import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Users, Mail, Phone, Eye } from "lucide-react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useProject } from "@/contexts/ProjectContext";
import { PageHeader } from "@/components/ui/page-header";
import { SearchBar } from "@/components/ui/search-bar";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { EditTenantModal } from "@/components/tenants/EditTenantModal";
import { TenantActionMenu } from "@/components/tenants/TenantActionMenu";
import { Badge } from "@/components/ui/badge";

interface Tenant {
  id: string; full_name: string; doc_id: string | null; email: string | null;
  phone: string | null; status: string; created_at: string;
}

export default function Tenants() {
  const { t } = useTranslation();

  const tenantSchema = z.object({
    full_name: z.string().min(1, t("tenants.nameRequired")),
    doc_id: z.string().optional(),
    email: z.string().email(t("tenants.emailInvalid")).optional().or(z.literal("")),
    phone: z.string().optional(),
    status: z.string().min(1),
  });
  type TenantFormData = z.infer<typeof tenantSchema>;

  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const { user } = useAuth();
  const { activeProjectId } = useProject();
  const navigate = useNavigate();
  const { toast } = useToast();

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<TenantFormData>({
    resolver: zodResolver(tenantSchema), defaultValues: { status: "active" },
  });

  useEffect(() => { if (user) fetchTenants(); }, [user]);

  const fetchTenants = async () => {
    try {
      const { data, error } = await supabase.from("tenants").select("*").order("full_name", { ascending: true });
      if (error) throw error;
      setTenants(data || []);
    } catch (error) {
      console.error("Error fetching tenants:", error);
      toast({ title: t("common.error"), description: t("common.errorGeneric"), variant: "destructive" });
    } finally { setLoading(false); }
  };

  const onSubmit = async (data: TenantFormData) => {
    if (!user) return;
    setIsSubmitting(true);
    try {
      const { error } = await supabase.from("tenants").insert({
        project_id: activeProjectId!, full_name: data.full_name,
        doc_id: data.doc_id || null, email: data.email || null, phone: data.phone || null, status: data.status,
      });
      if (error) throw error;
      toast({ title: t("tenants.tenantAdded"), description: t("tenants.tenantAddedDesc") });
      setDialogOpen(false); reset(); fetchTenants();
    } catch (error) {
      console.error("Error creating tenant:", error);
      toast({ title: t("common.error"), description: t("common.errorGeneric"), variant: "destructive" });
    } finally { setIsSubmitting(false); }
  };

  const handleEdit = (tenant: Tenant) => { setSelectedTenant(tenant); setEditModalOpen(true); };

  const filteredTenants = tenants.filter((tenant) => {
    const matchesSearch = tenant.full_name.toLowerCase().includes(search.toLowerCase()) ||
      tenant.email?.toLowerCase().includes(search.toLowerCase()) || tenant.phone?.includes(search);
    const matchesStatus = statusFilter === "all" || tenant.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (<div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>);
  }

  return (
    <div>
      <PageHeader title={t("tenants.title")} description={t("tenants.description")}>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />{t("tenants.addTenant")}</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{t("tenants.addNewTenant")}</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="full_name">{t("tenants.fullName")} *</Label>
                <Input id="full_name" placeholder="John Doe" {...register("full_name")} />
                {errors.full_name && <p className="text-sm text-destructive">{errors.full_name.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="doc_id">{t("tenants.docId")}</Label>
                <Input id="doc_id" placeholder="Optional" {...register("doc_id")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">{t("auth.email")}</Label>
                <Input id="email" type="email" placeholder="tenant@email.com" {...register("email")} />
                {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">{t("tenants.phone")}</Label>
                <Input id="phone" placeholder="+1 234 567 8900" {...register("phone")} />
              </div>
              <div className="space-y-2">
                <Label>{t("common.status")}</Label>
                <Select defaultValue="active" onValueChange={(value) => setValue("status", value)}>
                  <SelectTrigger><SelectValue placeholder={t("common.status")} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">{t("common.active")}</SelectItem>
                    <SelectItem value="inactive">{t("common.inactive")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>{t("common.cancel")}</Button>
                <Button type="submit" disabled={isSubmitting}>{isSubmitting ? t("common.adding") : t("tenants.addTenant")}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </PageHeader>

      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <SearchBar value={search} onChange={setSearch} placeholder={t("tenants.searchPlaceholder")} className="flex-1 max-w-md" />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder={t("common.status")} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("common.allStatus")}</SelectItem>
            <SelectItem value="active">{t("common.active")}</SelectItem>
            <SelectItem value="inactive">{t("common.inactive")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filteredTenants.length === 0 ? (
        <EmptyState icon={Users} title={t("tenants.noTenants")} description={t("tenants.noTenantsDesc")}
          action={{ label: t("tenants.addTenant"), onClick: () => setDialogOpen(true) }} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredTenants.map((tenant) => (
            <Card key={tenant.id} className={`group hover:shadow-medium transition-shadow cursor-pointer ${tenant.status === "inactive" ? "opacity-60" : ""}`}
              onClick={() => navigate(`/tenants/${tenant.id}`)}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-accent/10 text-accent font-semibold">
                      {tenant.full_name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold">{tenant.full_name}</p>
                        {tenant.status === "inactive" && <Badge variant="secondary" className="text-xs">{t("common.inactive")}</Badge>}
                      </div>
                      {tenant.doc_id && <p className="text-xs text-muted-foreground">ID: {tenant.doc_id}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge variant={tenant.status as any} />
                    <TenantActionMenu tenant={tenant} onEdit={() => handleEdit(tenant)} onRefresh={fetchTenants} />
                  </div>
                </div>
                <div className="space-y-1 text-sm text-muted-foreground">
                  {tenant.email && <div className="flex items-center gap-2"><Mail className="w-4 h-4" /><span className="truncate">{tenant.email}</span></div>}
                  {tenant.phone && <div className="flex items-center gap-2"><Phone className="w-4 h-4" /><span>{tenant.phone}</span></div>}
                </div>
                <Button variant="ghost" size="sm" className="w-full mt-4 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Eye className="w-4 h-4 mr-2" />{t("common.viewDetails")}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <EditTenantModal tenant={selectedTenant} open={editModalOpen} onOpenChange={setEditModalOpen} onSuccess={fetchTenants} />
    </div>
  );
}
