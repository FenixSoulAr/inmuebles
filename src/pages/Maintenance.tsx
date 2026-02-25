import { useEffect, useState } from "react";
import { Plus, Wrench, Building2 } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

interface MaintenanceIssue {
  id: string; reported_at: string; description: string; requested_by: string;
  payer: string; estimate_amount: number | null; status: string;
  properties: { internal_identifier: string };
}
interface Property { id: string; internal_identifier: string; }

export default function Maintenance() {
  const { t } = useTranslation();

  const issueSchema = z.object({
    property_id: z.string().min(1, t("contracts.propertyRequired")),
    description: z.string().min(1, t("maintenance.descriptionLabel")),
    requested_by: z.string().min(1),
    payer: z.string().min(1),
    estimate_amount: z.number().optional(),
  });
  type IssueFormData = z.infer<typeof issueSchema>;

  const [issues, setIssues] = useState<MaintenanceIssue[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user } = useAuth();
  const { activeProjectId } = useProject();
  const { toast } = useToast();

  const { register, handleSubmit, control, reset, formState: { errors } } = useForm<IssueFormData>({
    resolver: zodResolver(issueSchema), defaultValues: { requested_by: "owner", payer: "owner" },
  });

  useEffect(() => { if (user) fetchData(); }, [user]);

  const fetchData = async () => {
    try {
      const [issuesRes, propertiesRes] = await Promise.all([
        supabase.from("maintenance_issues").select("*, properties(internal_identifier)").order("reported_at", { ascending: false }),
        supabase.from("properties").select("id, internal_identifier"),
      ]);
      if (issuesRes.error) throw issuesRes.error;
      if (propertiesRes.error) throw propertiesRes.error;
      setIssues(issuesRes.data || []);
      setProperties(propertiesRes.data || []);
    } catch (error) {
      console.error("Error fetching maintenance:", error);
      toast({ title: t("common.error"), description: t("common.errorGeneric"), variant: "destructive" });
    } finally { setLoading(false); }
  };

  const onSubmit = async (data: IssueFormData) => {
    setIsSubmitting(true);
    try {
      const { error } = await supabase.from("maintenance_issues").insert({
        project_id: activeProjectId!,
        property_id: data.property_id, description: data.description,
        requested_by: data.requested_by, payer: data.payer,
        estimate_amount: data.estimate_amount || null, status: "pending",
      });
      if (error) throw error;
      toast({ title: t("maintenance.issueReported"), description: t("maintenance.issueReportedDesc") });
      setDialogOpen(false); reset(); fetchData();
    } catch (error) {
      console.error("Error creating issue:", error);
      toast({ title: t("common.error"), description: t("common.errorGeneric"), variant: "destructive" });
    } finally { setIsSubmitting(false); }
  };

  const updateStatus = async (id: string, newStatus: string) => {
    try {
      const { error } = await supabase.from("maintenance_issues").update({ status: newStatus }).eq("id", id);
      if (error) throw error;
      toast({ title: t("maintenance.statusUpdated"), description: t("maintenance.statusUpdatedDesc", { status: newStatus }) });
      fetchData();
    } catch (error) {
      console.error("Error updating status:", error);
      toast({ title: t("common.error"), description: t("common.errorGeneric"), variant: "destructive" });
    }
  };

  const filteredIssues = issues.filter((issue) => {
    const matchesSearch = issue.properties.internal_identifier.toLowerCase().includes(search.toLowerCase()) ||
      issue.description.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || issue.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const formatCurrency = (amount: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);

  if (loading) {
    return (<div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>);
  }

  return (
    <div>
      <PageHeader title={t("maintenance.title")} description={t("maintenance.description")}>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />{t("maintenance.reportIssue")}</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{t("maintenance.reportTitle")}</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>{t("contracts.property")} *</Label>
                <Controller name="property_id" control={control} render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger><SelectValue placeholder={t("contracts.selectProperty")} /></SelectTrigger>
                    <SelectContent>{properties.map((p) => (<SelectItem key={p.id} value={p.id}>{p.internal_identifier}</SelectItem>))}</SelectContent>
                  </Select>
                )} />
                {errors.property_id && <p className="text-sm text-destructive">{errors.property_id.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">{t("maintenance.descriptionLabel")} *</Label>
                <Textarea id="description" placeholder={t("maintenance.describePlaceholder")} {...register("description")} />
                {errors.description && <p className="text-sm text-destructive">{errors.description.message}</p>}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>{t("maintenance.requestedBy")}</Label>
                  <Controller name="requested_by" control={control} render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="owner">{t("maintenance.owner")}</SelectItem>
                        <SelectItem value="tenant">{t("maintenance.tenantPayer")}</SelectItem>
                      </SelectContent>
                    </Select>
                  )} />
                </div>
                <div className="space-y-2">
                  <Label>{t("maintenance.payer")}</Label>
                  <Controller name="payer" control={control} render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="owner">{t("maintenance.owner")}</SelectItem>
                        <SelectItem value="tenant">{t("maintenance.tenantPayer")}</SelectItem>
                      </SelectContent>
                    </Select>
                  )} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="estimate_amount">{t("maintenance.estimateAmount")}</Label>
                <Input id="estimate_amount" type="number" step="0.01" placeholder="0.00" {...register("estimate_amount", { valueAsNumber: true })} />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>{t("common.cancel")}</Button>
                <Button type="submit" disabled={isSubmitting}>{isSubmitting ? t("common.submitting") : t("maintenance.reportIssue")}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </PageHeader>

      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <SearchBar value={search} onChange={setSearch} placeholder={t("maintenance.searchPlaceholder")} className="flex-1 max-w-md" />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder={t("common.status")} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("common.allStatus")}</SelectItem>
            <SelectItem value="pending">{t("maintenance.pending")}</SelectItem>
            <SelectItem value="in_progress">{t("maintenance.inProgress")}</SelectItem>
            <SelectItem value="resolved">{t("maintenance.resolved")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filteredIssues.length === 0 ? (
        <EmptyState icon={Wrench} title={t("maintenance.noIssues")} description={t("maintenance.noIssuesDesc")}
          action={{ label: t("maintenance.reportIssue"), onClick: () => setDialogOpen(true) }} />
      ) : (
        <div className="space-y-4">
          {filteredIssues.map((issue) => (
            <Card key={issue.id} className="hover:shadow-medium transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-warning/10 text-warning mt-1"><Wrench className="w-5 h-5" /></div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium">{issue.properties.internal_identifier}</p>
                        <StatusBadge variant={issue.status as any} />
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{issue.description}</p>
                      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                        <span>{t("maintenance.reported")}: {new Date(issue.reported_at).toLocaleDateString()}</span>
                        <span className="capitalize">{t("maintenance.by")}: {issue.requested_by}</span>
                        <span className="capitalize">{t("maintenance.payer")}: {issue.payer}</span>
                        {issue.estimate_amount && <span>{t("maintenance.est")}: {formatCurrency(issue.estimate_amount)}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {issue.status === "pending" && (
                      <Button size="sm" variant="outline" onClick={() => updateStatus(issue.id, "in_progress")}>{t("maintenance.startWork")}</Button>
                    )}
                    {issue.status !== "resolved" && (
                      <Button size="sm" onClick={() => updateStatus(issue.id, "resolved")}>{t("maintenance.markResolved")}</Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
