import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export interface OverdueRentItem { id: string; property: string; tenant: string; dueDate: string; balanceDue: number; status: string; }
export interface DueSoonItem { id: string; property: string; tenant: string; dueDate: string; expectedAmount: number; }
export interface MissingProofItem { id: string; property: string; utilityType: string; period: string; status: string; dueDate?: string; }
export interface TaxDueItem { id: string; property: string; taxType: string; dueDate: string; status: string; }
export interface MaintenanceItem { id: string; property: string; issue: string; status: string; }

interface ActionCenterProps {
  overdueRent: OverdueRentItem[]; dueSoon: DueSoonItem[]; missingProofs: MissingProofItem[];
  taxesDueSoon: TaxDueItem[]; openMaintenance: MaintenanceItem[];
  onRecordPayment: (rentDueId: string) => void; onUploadProof?: (proofId: string) => void;
  onUploadTaxReceipt?: (taxId: string) => void; onViewMaintenance?: (issueId: string) => void;
}

const MAX_ROWS = 8;
const formatCurrency = (amount: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString("en-US", { month: "short", day: "numeric" });

export function ActionCenter({ overdueRent, dueSoon, missingProofs, taxesDueSoon, openMaintenance, onRecordPayment, onUploadProof, onUploadTaxReceipt }: ActionCenterProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("overdue");

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2"><AlertCircle className="w-5 h-5 text-destructive" />{t("dashboard.actionCenter")}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="px-6">
            <TabsList className="w-full justify-start flex-wrap h-auto gap-1 bg-transparent p-0 mb-4">
              <TabsTrigger value="overdue" className="data-[state=active]:bg-destructive data-[state=active]:text-destructive-foreground">
                {t("dashboard.overdue")} {overdueRent.length > 0 && `(${overdueRent.length})`}
              </TabsTrigger>
              <TabsTrigger value="due-soon">{t("dashboard.dueSoon")} {dueSoon.length > 0 && `(${dueSoon.length})`}</TabsTrigger>
              <TabsTrigger value="proofs">{t("dashboard.missingProofsTab")} {missingProofs.length > 0 && `(${missingProofs.length})`}</TabsTrigger>
              <TabsTrigger value="taxes">{t("dashboard.taxesTab")} {taxesDueSoon.length > 0 && `(${taxesDueSoon.length})`}</TabsTrigger>
              <TabsTrigger value="maintenance">{t("dashboard.maintenanceTab")} {openMaintenance.length > 0 && `(${openMaintenance.length})`}</TabsTrigger>
            </TabsList>
          </div>
          <div className="overflow-x-auto">
            <TabsContent value="overdue" className="m-0">
              {overdueRent.length === 0 ? (
                <div className="p-6 pt-0"><EmptyState icon={CheckCircle2} title={t("dashboard.noOverdueRent")} description={t("dashboard.allSet")} className="py-8" /></div>
              ) : (
                <Table><TableHeader><TableRow>
                  <TableHead>{t("contracts.property")}</TableHead><TableHead>{t("contracts.tenant")}</TableHead>
                  <TableHead>{t("rent.dueDate")}</TableHead><TableHead className="text-right">{t("rent.balanceDue")}</TableHead>
                  <TableHead>{t("common.status")}</TableHead><TableHead className="text-right">{t("common.actions")}</TableHead>
                </TableRow></TableHeader><TableBody>
                  {overdueRent.slice(0, MAX_ROWS).map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.property}</TableCell>
                      <TableCell className="text-muted-foreground">{item.tenant}</TableCell>
                      <TableCell>{formatDate(item.dueDate)}</TableCell>
                      <TableCell className="text-right font-semibold text-destructive">{formatCurrency(item.balanceDue)}</TableCell>
                      <TableCell><StatusBadge variant={item.status as any} /></TableCell>
                      <TableCell className="text-right"><Button size="sm" onClick={() => onRecordPayment(item.id)}>{t("dashboard.recordPayment")}</Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody></Table>
              )}
            </TabsContent>
            <TabsContent value="due-soon" className="m-0">
              {dueSoon.length === 0 ? (
                <div className="p-6 pt-0"><EmptyState icon={CheckCircle2} title={t("dashboard.nothingDueSoon")} description={t("dashboard.noRentDue7Days")} className="py-8" /></div>
              ) : (
                <Table><TableHeader><TableRow>
                  <TableHead>{t("contracts.property")}</TableHead><TableHead>{t("contracts.tenant")}</TableHead>
                  <TableHead>{t("rent.dueDate")}</TableHead><TableHead className="text-right">{t("rent.expected")}</TableHead>
                  <TableHead className="text-right">{t("common.actions")}</TableHead>
                </TableRow></TableHeader><TableBody>
                  {dueSoon.slice(0, MAX_ROWS).map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.property}</TableCell>
                      <TableCell className="text-muted-foreground">{item.tenant}</TableCell>
                      <TableCell>{formatDate(item.dueDate)}</TableCell>
                      <TableCell className="text-right font-semibold">{formatCurrency(item.expectedAmount)}</TableCell>
                      <TableCell className="text-right"><Button size="sm" variant="outline" onClick={() => onRecordPayment(item.id)}>{t("dashboard.recordPayment")}</Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody></Table>
              )}
            </TabsContent>
            <TabsContent value="proofs" className="m-0">
              {missingProofs.length === 0 ? (
                <div className="p-6 pt-0"><EmptyState icon={CheckCircle2} title={t("dashboard.noMissingProofs")} description={t("dashboard.allProofsSubmitted")} className="py-8" /></div>
              ) : (
                <Table><TableHeader><TableRow>
                  <TableHead>{t("contracts.property")}</TableHead><TableHead>{t("dashboard.utility")}</TableHead>
                  <TableHead>{t("rent.period")}</TableHead><TableHead>{t("rent.dueDate")}</TableHead>
                  <TableHead>{t("common.status")}</TableHead><TableHead className="text-right">{t("common.actions")}</TableHead>
                </TableRow></TableHeader><TableBody>
                  {missingProofs.slice(0, MAX_ROWS).map((item) => (
                    <TableRow key={item.id} className={item.status === "overdue" ? "bg-destructive/5" : undefined}>
                      <TableCell className="font-medium">{item.property}</TableCell>
                      <TableCell>{item.utilityType}</TableCell><TableCell>{item.period}</TableCell>
                      <TableCell>{item.dueDate ? formatDate(item.dueDate) : "—"}</TableCell>
                      <TableCell><StatusBadge variant={item.status as any} /></TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant={item.status === "overdue" ? "default" : "outline"} onClick={() => onUploadProof?.(item.id)}>{t("dashboard.uploadProof")}</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody></Table>
              )}
            </TabsContent>
            <TabsContent value="taxes" className="m-0">
              {taxesDueSoon.length === 0 ? (
                <div className="p-6 pt-0"><EmptyState icon={CheckCircle2} title={t("dashboard.noTaxesDue")} description={t("dashboard.noTaxes30Days")} className="py-8" /></div>
              ) : (
                <Table><TableHeader><TableRow>
                  <TableHead>{t("contracts.property")}</TableHead><TableHead>{t("dashboard.tax")}</TableHead>
                  <TableHead>{t("rent.dueDate")}</TableHead><TableHead>{t("common.status")}</TableHead>
                  <TableHead className="text-right">{t("common.actions")}</TableHead>
                </TableRow></TableHeader><TableBody>
                  {taxesDueSoon.slice(0, MAX_ROWS).map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.property}</TableCell>
                      <TableCell>{item.taxType}</TableCell><TableCell>{formatDate(item.dueDate)}</TableCell>
                      <TableCell><StatusBadge variant={item.status as any} /></TableCell>
                      <TableCell className="text-right"><Button size="sm" onClick={() => onUploadTaxReceipt?.(item.id)}>{t("dashboard.uploadReceipt")}</Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody></Table>
              )}
            </TabsContent>
            <TabsContent value="maintenance" className="m-0">
              {openMaintenance.length === 0 ? (
                <div className="p-6 pt-0"><EmptyState icon={CheckCircle2} title={t("dashboard.noOpenIssues")} description={t("dashboard.allIssuesResolved")} className="py-8" /></div>
              ) : (
                <Table><TableHeader><TableRow>
                  <TableHead>{t("contracts.property")}</TableHead><TableHead>{t("maintenance.descriptionLabel")}</TableHead>
                  <TableHead>{t("common.status")}</TableHead><TableHead className="text-right">{t("common.actions")}</TableHead>
                </TableRow></TableHeader><TableBody>
                  {openMaintenance.slice(0, MAX_ROWS).map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.property}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{item.issue}</TableCell>
                      <TableCell><StatusBadge variant={item.status as any} /></TableCell>
                      <TableCell className="text-right"><Button size="sm" variant="outline" onClick={() => navigate("/maintenance")}>{t("common.view")}</Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody></Table>
              )}
            </TabsContent>
          </div>
        </Tabs>
      </CardContent>
    </Card>
  );
}
