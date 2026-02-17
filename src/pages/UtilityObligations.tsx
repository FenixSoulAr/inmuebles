import { useEffect, useState } from "react";
import { Zap, MoreHorizontal, Power, PowerOff, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { AddUtilityModal } from "@/components/utilities/AddUtilityModal";
import { DeleteConfirmationModal } from "@/components/ui/delete-confirmation-modal";

interface UtilityObligation {
  id: string; type: string; payer: string; frequency: string; due_day_of_month: number | null;
  active: boolean; property: { id: string; internal_identifier: string }; proofCount: number; hasUploads: boolean;
}

export default function UtilityObligations() {
  const { t } = useTranslation();

  const utilityTypeLabels: Record<string, string> = {
    electricity: t("utilities.electricity"), gas: t("utilities.gas"), water: t("utilities.water"),
    hoa: t("utilities.hoa"), insurance: t("utilities.insuranceUtility"),
  };
  const frequencyLabels: Record<string, string> = {
    monthly: t("frequency.monthly"), bimonthly: t("frequency.bimonthly"),
    quarterly: t("frequency.quarterly"), annual: t("frequency.annual"),
  };

  const [utilities, setUtilities] = useState<UtilityObligation[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedUtility, setSelectedUtility] = useState<UtilityObligation | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => { if (user) fetchData(); }, [user]);

  const fetchData = async () => {
    try {
      const { data: obligations, error: obligationsError } = await supabase.from("utility_obligations")
        .select(`id, type, payer, frequency, due_day_of_month, active, properties (id, internal_identifier)`)
        .order("type", { ascending: true });
      if (obligationsError) throw obligationsError;
      const { data: proofs, error: proofsError } = await supabase.from("utility_proofs").select("utility_obligation_id, file_url");
      if (proofsError) throw proofsError;
      const proofsByObligation = (proofs || []).reduce((acc, proof) => {
        if (!acc[proof.utility_obligation_id]) acc[proof.utility_obligation_id] = { count: 0, hasUploads: false };
        acc[proof.utility_obligation_id].count++;
        if (proof.file_url) acc[proof.utility_obligation_id].hasUploads = true;
        return acc;
      }, {} as Record<string, { count: number; hasUploads: boolean }>);
      const processed: UtilityObligation[] = (obligations || []).map((ob: any) => ({
        id: ob.id, type: ob.type, payer: ob.payer, frequency: ob.frequency, due_day_of_month: ob.due_day_of_month,
        active: ob.active, property: { id: ob.properties.id, internal_identifier: ob.properties.internal_identifier },
        proofCount: proofsByObligation[ob.id]?.count || 0, hasUploads: proofsByObligation[ob.id]?.hasUploads || false,
      }));
      // Sort by property name asc
      processed.sort((a, b) => a.property.internal_identifier.localeCompare(b.property.internal_identifier));
      setUtilities(processed);
    } catch (error) {
      console.error("Error fetching utilities:", error);
      toast({ title: t("common.error"), description: t("common.errorGeneric"), variant: "destructive" });
    } finally { setLoading(false); }
  };

  const canDelete = (utility: UtilityObligation) => !utility.hasUploads;
  const handleToggleActive = async (utility: UtilityObligation) => {
    setActionLoading(true);
    try {
      const { error } = await supabase.from("utility_obligations").update({ active: !utility.active }).eq("id", utility.id);
      if (error) throw error;
      toast({ title: utility.active ? t("utilityServices.utilityDeactivated") : t("utilityServices.utilityReactivated") });
      fetchData();
    } catch (error) { toast({ title: t("common.error"), variant: "destructive" }); } finally { setActionLoading(false); }
  };
  const handleDeleteClick = (utility: UtilityObligation) => {
    if (!canDelete(utility)) { toast({ title: t("utilityServices.cannotDeleteUtility"), variant: "destructive" }); return; }
    setSelectedUtility(utility); setDeleteModalOpen(true);
  };
  const handleConfirmDelete = async () => {
    if (!selectedUtility) return;
    setActionLoading(true);
    try {
      await supabase.from("utility_proofs").delete().eq("utility_obligation_id", selectedUtility.id);
      const { error } = await supabase.from("utility_obligations").delete().eq("id", selectedUtility.id);
      if (error) throw error;
      toast({ title: t("utilityServices.utilityDeleted") });
      setDeleteModalOpen(false); setSelectedUtility(null); fetchData();
    } catch (error) { toast({ title: t("common.error"), variant: "destructive" }); } finally { setActionLoading(false); }
  };

  if (loading) {
    return (<div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>);
  }

  const activeUtilities = utilities.filter((u) => u.active);
  const inactiveUtilities = utilities.filter((u) => !u.active);

  return (
    <div className="space-y-6">
      <PageHeader title={t("utilityServices.title")} description={t("utilityServices.description")}>
        <AddUtilityModal onSuccess={fetchData} />
      </PageHeader>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2"><Zap className="w-5 h-5" />{t("utilityServices.activeUtilities")}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {activeUtilities.length === 0 ? (
            <EmptyState icon={Zap} title={t("utilityServices.noActive")} description={t("utilityServices.noActiveDesc")} className="py-12" />
          ) : (
            <UtilityTable utilities={activeUtilities} onToggleActive={handleToggleActive} onDelete={handleDeleteClick}
              canDelete={canDelete} actionLoading={actionLoading} t={t} utilityTypeLabels={utilityTypeLabels} frequencyLabels={frequencyLabels} />
          )}
        </CardContent>
      </Card>

      {inactiveUtilities.length > 0 && (
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-muted-foreground"><PowerOff className="w-5 h-5" />{t("utilityServices.inactiveUtilities")}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <UtilityTable utilities={inactiveUtilities} onToggleActive={handleToggleActive} onDelete={handleDeleteClick}
              canDelete={canDelete} actionLoading={actionLoading} t={t} utilityTypeLabels={utilityTypeLabels} frequencyLabels={frequencyLabels} />
          </CardContent>
        </Card>
      )}

      <DeleteConfirmationModal open={deleteModalOpen} onOpenChange={setDeleteModalOpen}
        title={t("utilityServices.deletePermanently")} description={t("utilityServices.deleteUtilityDesc")}
        onConfirm={handleConfirmDelete} loading={actionLoading} />
    </div>
  );
}

interface UtilityTableProps {
  utilities: UtilityObligation[]; onToggleActive: (u: UtilityObligation) => void;
  onDelete: (u: UtilityObligation) => void; canDelete: (u: UtilityObligation) => boolean;
  actionLoading: boolean; t: (key: string) => string;
  utilityTypeLabels: Record<string, string>; frequencyLabels: Record<string, string>;
}

function UtilityTable({ utilities, onToggleActive, onDelete, canDelete, actionLoading, t, utilityTypeLabels, frequencyLabels }: UtilityTableProps) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("contracts.property")}</TableHead>
            <TableHead>{t("common.status")}</TableHead>
            <TableHead>{t("utilityServices.responsible")}</TableHead>
            <TableHead>{t("utilityServices.frequency")}</TableHead>
            <TableHead>{t("utilityServices.dueDay")}</TableHead>
            <TableHead>{t("utilityServices.proofs")}</TableHead>
            <TableHead className="text-right">{t("common.actions")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {utilities.map((utility) => (
            <TableRow key={utility.id} className={!utility.active ? "opacity-60" : undefined}>
              <TableCell className="font-medium">{utility.property.internal_identifier}</TableCell>
              <TableCell>{utilityTypeLabels[utility.type] || utility.type}</TableCell>
              <TableCell className="capitalize">{utility.payer}</TableCell>
              <TableCell>{frequencyLabels[utility.frequency] || utility.frequency}</TableCell>
              <TableCell>{utility.due_day_of_month || 10}</TableCell>
              <TableCell>
                <Badge variant={utility.hasUploads ? "default" : "secondary"}>
                  {utility.proofCount} {utility.proofCount === 1 ? t("utilityServices.proof") : t("utilityServices.proofs")}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <TooltipProvider>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" disabled={actionLoading}><MoreHorizontal className="w-4 h-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onToggleActive(utility)}>
                        {utility.active ? (<><PowerOff className="w-4 h-4 mr-2" />{t("common.deactivate")}</>) : (<><Power className="w-4 h-4 mr-2" />{t("common.reactivate")}</>)}
                      </DropdownMenuItem>
                      {canDelete(utility) ? (
                        <DropdownMenuItem onClick={() => onDelete(utility)} className="text-destructive focus:text-destructive">
                          <Trash2 className="w-4 h-4 mr-2" />{t("common.deletePermanently")}
                        </DropdownMenuItem>
                      ) : (
                        <Tooltip><TooltipTrigger asChild>
                          <div className="relative flex cursor-not-allowed select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none text-muted-foreground opacity-50">
                            <Trash2 className="w-4 h-4 mr-2" />{t("common.deletePermanently")}
                          </div>
                        </TooltipTrigger><TooltipContent side="left">{t("utilityServices.cannotDeleteUtility")}</TooltipContent></Tooltip>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TooltipProvider>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
