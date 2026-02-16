import { useEffect, useState } from "react";
import { Receipt, Building2, MoreHorizontal, Pencil, Upload, ExternalLink, PowerOff, Power, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { AddTaxModal } from "@/components/taxes/AddTaxModal";
import { EditTaxModal } from "@/components/taxes/EditTaxModal";
import { UploadTaxReceiptModal } from "@/components/taxes/UploadTaxReceiptModal";
import { DeleteConfirmationModal } from "@/components/ui/delete-confirmation-modal";

interface TaxObligation {
  id: string; type: string; frequency: string; due_date: string; responsible: string;
  status: string; amount: number | null; notes: string | null; receipt_file_url: string | null; active: boolean;
  properties: { id: string; internal_identifier: string; full_address: string };
}
interface PropertyFiscalStatus {
  propertyId: string; propertyName: string; address: string; status: "ok" | "pending"; obligations: TaxObligation[];
}

export default function Taxes() {
  const { t } = useTranslation();

  const taxTypeLabels: Record<string, string> = {
    municipal: t("taxes.municipal"), property: t("taxes.property"), income: t("taxes.income"), other: t("taxes.otherTax"),
  };
  const frequencyLabels: Record<string, string> = {
    "one-time": t("taxes.oneTime"), monthly: t("taxes.monthly"), bimonthly: t("taxes.bimonthly"),
    quarterly: t("taxes.quarterly"), annual: t("taxes.annual"),
  };

  const [fiscalStatuses, setFiscalStatuses] = useState<PropertyFiscalStatus[]>([]);
  const [inactiveTaxes, setInactiveTaxes] = useState<TaxObligation[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedTaxId, setSelectedTaxId] = useState<string | null>(null);
  const [selectedTaxDetails, setSelectedTaxDetails] = useState<{ property: string; taxType: string; dueDate: string; amount: number | null; notes: string | null } | null>(null);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadTaxDetails, setUploadTaxDetails] = useState<{ property: string; taxType: string; dueDate: string } | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedTaxForDelete, setSelectedTaxForDelete] = useState<TaxObligation | null>(null);
  const [addModalOpen, setAddModalOpen] = useState(false);

  useEffect(() => { if (user) fetchTaxData(); }, [user]);

  const fetchTaxData = async () => {
    try {
      const { data: obligations, error } = await supabase.from("tax_obligations")
        .select("*, properties(id, internal_identifier, full_address)").order("due_date", { ascending: true });
      if (error) throw error;
      const activeTaxes = (obligations || []).filter((ob: TaxObligation) => ob.active !== false);
      const inactive = (obligations || []).filter((ob: TaxObligation) => ob.active === false);
      const propertyMap = new Map<string, PropertyFiscalStatus>();
      activeTaxes.forEach((ob: TaxObligation) => {
        const propertyId = ob.properties.id;
        if (!propertyMap.has(propertyId)) {
          propertyMap.set(propertyId, { propertyId, propertyName: ob.properties.internal_identifier, address: ob.properties.full_address, status: "ok", obligations: [] });
        }
        const entry = propertyMap.get(propertyId)!;
        entry.obligations.push(ob);
        if (ob.status === "pending") entry.status = "pending";
      });
      setFiscalStatuses(Array.from(propertyMap.values()));
      setInactiveTaxes(inactive);
    } catch (error) {
      console.error("Error fetching tax data:", error);
      toast({ title: t("common.error"), description: t("common.errorGeneric"), variant: "destructive" });
    } finally { setLoading(false); }
  };

  const canDelete = (tax: TaxObligation) => !tax.receipt_file_url;
  const handleEdit = (tax: TaxObligation) => {
    setSelectedTaxId(tax.id);
    setSelectedTaxDetails({ property: tax.properties.internal_identifier, taxType: taxTypeLabels[tax.type] || tax.type, dueDate: tax.due_date, amount: tax.amount, notes: tax.notes });
    setEditModalOpen(true);
  };
  const handleUpload = (tax: TaxObligation) => {
    setSelectedTaxId(tax.id);
    setUploadTaxDetails({ property: tax.properties.internal_identifier, taxType: taxTypeLabels[tax.type] || tax.type, dueDate: tax.due_date });
    setUploadModalOpen(true);
  };
  const handleToggleActive = async (tax: TaxObligation) => {
    setActionLoading(true);
    try {
      const { error } = await supabase.from("tax_obligations").update({ active: !tax.active }).eq("id", tax.id);
      if (error) throw error;
      toast({ title: tax.active ? t("taxes.taxDeactivated") : t("taxes.taxReactivated") });
      fetchTaxData();
    } catch (error) { toast({ title: t("common.error"), variant: "destructive" }); } finally { setActionLoading(false); }
  };
  const handleDeleteClick = (tax: TaxObligation) => {
    if (!canDelete(tax)) { toast({ title: t("taxes.cannotDelete"), variant: "destructive" }); return; }
    setSelectedTaxForDelete(tax); setDeleteModalOpen(true);
  };
  const handleConfirmDelete = async () => {
    if (!selectedTaxForDelete) return;
    setActionLoading(true);
    try {
      const { error } = await supabase.from("tax_obligations").delete().eq("id", selectedTaxForDelete.id);
      if (error) throw error;
      toast({ title: t("taxes.taxDeleted") });
      setDeleteModalOpen(false); setSelectedTaxForDelete(null); fetchTaxData();
    } catch (error) { toast({ title: t("common.error"), variant: "destructive" }); } finally { setActionLoading(false); }
  };

  const formatAmount = (amount: number | null) => {
    if (amount === null) return null;
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
  };

  if (loading) {
    return (<div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>);
  }

  const renderTaxRow = (ob: TaxObligation, isInactive = false) => (
    <div key={ob.id} className={`flex items-center justify-between p-3 rounded-lg ${isInactive ? "bg-muted/30 opacity-60" : "bg-muted/50"}`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-medium">{taxTypeLabels[ob.type] || ob.type}</p>
          {ob.amount !== null && <span className="text-sm text-muted-foreground">{formatAmount(ob.amount)}</span>}
          {isInactive && <Badge variant="secondary" className="text-xs">{t("common.inactive")}</Badge>}
        </div>
        <p className="text-xs text-muted-foreground">
          {t("taxes.due")}: {new Date(ob.due_date).toLocaleDateString()} • {frequencyLabels[ob.frequency] || ob.frequency}
        </p>
        {ob.notes && <p className="text-xs text-muted-foreground mt-1 truncate">{ob.notes}</p>}
      </div>
      <div className="flex items-center gap-2">
        <StatusBadge variant={ob.status as any} />
        <TooltipProvider>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" disabled={actionLoading}><MoreHorizontal className="w-4 h-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleEdit(ob)}><Pencil className="w-4 h-4 mr-2" />{t("taxes.editTaxRecord")}</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleUpload(ob)}><Upload className="w-4 h-4 mr-2" />{t("taxes.uploadReceipt")}</DropdownMenuItem>
              {ob.receipt_file_url && (
                <DropdownMenuItem asChild><a href={ob.receipt_file_url} target="_blank" rel="noopener noreferrer"><ExternalLink className="w-4 h-4 mr-2" />{t("taxes.viewReceipt")}</a></DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleToggleActive(ob)}>
                {ob.active !== false ? (<><PowerOff className="w-4 h-4 mr-2" />{t("common.deactivate")}</>) : (<><Power className="w-4 h-4 mr-2" />{t("common.reactivate")}</>)}
              </DropdownMenuItem>
              {canDelete(ob) ? (
                <DropdownMenuItem onClick={() => handleDeleteClick(ob)} className="text-destructive focus:text-destructive">
                  <Trash2 className="w-4 h-4 mr-2" />{t("common.deletePermanently")}
                </DropdownMenuItem>
              ) : (
                <Tooltip><TooltipTrigger asChild>
                  <div className="relative flex cursor-not-allowed select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none text-muted-foreground opacity-50">
                    <Trash2 className="w-4 h-4 mr-2" />{t("common.deletePermanently")}
                  </div>
                </TooltipTrigger><TooltipContent side="left">{t("taxes.cannotDelete")}</TooltipContent></Tooltip>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </TooltipProvider>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader title={t("taxes.title")} description={t("taxes.description")}><AddTaxModal onSuccess={fetchTaxData} /></PageHeader>

      {fiscalStatuses.length === 0 && inactiveTaxes.length === 0 ? (
        <EmptyState icon={Receipt} title={t("taxes.noTaxes")} description={t("taxes.noTaxesDesc")}
          action={{ label: t("taxes.addTax"), onClick: () => setAddModalOpen(true) }} />
      ) : (
        <>
          {fiscalStatuses.length > 0 && (
            <div className="grid gap-6 lg:grid-cols-2">
              {fiscalStatuses.map((property) => (
                <Card key={property.propertyId}>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 text-primary"><Building2 className="w-5 h-5" /></div>
                      <div><CardTitle className="text-base">{property.propertyName}</CardTitle><p className="text-xs text-muted-foreground">{property.address}</p></div>
                    </div>
                    <StatusBadge variant={property.status} />
                  </CardHeader>
                  <CardContent><div className="space-y-3">{property.obligations.map((ob) => renderTaxRow(ob))}</div></CardContent>
                </Card>
              ))}
            </div>
          )}
          {inactiveTaxes.length > 0 && (
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-muted-foreground"><PowerOff className="w-5 h-5" />{t("taxes.inactiveTaxes")}</CardTitle>
              </CardHeader>
              <CardContent><div className="space-y-3">{inactiveTaxes.map((ob) => renderTaxRow(ob, true))}</div></CardContent>
            </Card>
          )}
        </>
      )}

      <EditTaxModal open={editModalOpen} onOpenChange={setEditModalOpen} taxId={selectedTaxId} taxDetails={selectedTaxDetails} onSuccess={fetchTaxData} />
      <UploadTaxReceiptModal open={uploadModalOpen} onOpenChange={setUploadModalOpen} taxId={selectedTaxId} taxDetails={uploadTaxDetails} onSuccess={fetchTaxData} />
      <DeleteConfirmationModal open={deleteModalOpen} onOpenChange={setDeleteModalOpen} title={t("taxes.deleteTaxTitle")} description={t("taxes.deleteTaxDesc")} onConfirm={handleConfirmDelete} loading={actionLoading} />
    </div>
  );
}
