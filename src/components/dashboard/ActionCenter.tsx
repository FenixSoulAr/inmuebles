import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AlertCircle, CheckCircle2, ArrowRight, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { addMonths, format, parseISO } from "date-fns";

export interface OverdueRentItem { id: string; property: string; tenant: string; dueDate: string; balanceDue: number; status: string; }
export interface DueSoonItem { id: string; property: string; tenant: string; dueDate: string; expectedAmount: number; }
export interface MissingProofItem { id: string; property: string; utilityType: string; period: string; status: string; dueDate?: string; }
export interface TaxDueItem { id: string; property: string; taxType: string; dueDate: string; status: string; }
export interface MaintenanceItem { id: string; property: string; issue: string; status: string; }
export interface UpcomingAdjustmentItem {
  contractId: string;
  property: string;
  tenant: string;
  nextAdjustmentDate: string;
  currentRent: number;
  currencyRent: string;
  adjustmentFrequency: number;
}

interface ActionCenterProps {
  overdueRent: OverdueRentItem[];
  dueSoon: DueSoonItem[];
  missingProofs: MissingProofItem[];
  taxesDueSoon: TaxDueItem[];
  openMaintenance: MaintenanceItem[];
  upcomingAdjustments?: UpcomingAdjustmentItem[];
  onRecordPayment: (rentDueId: string) => void;
  onUploadProof?: (proofId: string) => void;
  onUploadTaxReceipt?: (taxId: string) => void;
}

const MAX_ROWS = 8;
const formatCurrency = (amount: number, currency = "ARS") =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: currency === "USD" ? "USD" : "ARS", minimumFractionDigits: 0 }).format(amount);
const formatDate = (dateString: string) =>
  new Date(dateString + "T00:00:00").toLocaleDateString("es-AR", { day: "numeric", month: "short" });
const daysFromToday = (dateStr: string) => {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + "T00:00:00");
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
};

export function ActionCenter({
  overdueRent,
  dueSoon,
  missingProofs,
  taxesDueSoon,
  openMaintenance,
  upcomingAdjustments = [],
  onRecordPayment,
  onUploadProof,
  onUploadTaxReceipt,
}: ActionCenterProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("pending");

  // Combine all "pending" items: overdue rent + overdue taxes
  const allPendingCount = overdueRent.length + taxesDueSoon.filter(tx => {
    const today = new Date().toISOString().split("T")[0];
    return tx.dueDate < today;
  }).length;

  const upcomingCount = dueSoon.length + taxesDueSoon.filter(tx => {
    const today = new Date().toISOString().split("T")[0];
    return tx.dueDate >= today;
  }).length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertCircle className="w-4 h-4 text-destructive" />
          Centro de acciones
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="px-6">
            <TabsList className="w-full justify-start flex-wrap h-auto gap-1 bg-transparent p-0 mb-4 border-b border-border">
              <TabsTrigger
                value="pending"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-destructive data-[state=active]:text-destructive data-[state=active]:bg-transparent pb-3"
              >
                Pendientes
                {overdueRent.length > 0 && (
                  <span className="ml-1.5 inline-flex items-center justify-center w-5 h-5 rounded-full bg-destructive/10 text-destructive text-[10px] font-bold">
                    {overdueRent.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger
                value="upcoming"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent pb-3"
              >
                Próximos
                {dueSoon.length > 0 && (
                  <span className="ml-1.5 inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold">
                    {dueSoon.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger
                value="missing"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-warning data-[state=active]:text-warning data-[state=active]:bg-transparent pb-3"
              >
                Faltantes
                {missingProofs.length > 0 && (
                  <span className="ml-1.5 inline-flex items-center justify-center w-5 h-5 rounded-full bg-warning/10 text-warning text-[10px] font-bold">
                    {missingProofs.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger
                value="adjustments"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent pb-3"
              >
                Ajustes
                {upcomingAdjustments.length > 0 && (
                  <span className="ml-1.5 inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold">
                    {upcomingAdjustments.length}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="overflow-x-auto">
            {/* TAB: Pendientes (overdue rent) */}
            <TabsContent value="pending" className="m-0">
              {overdueRent.length === 0 ? (
                <div className="p-6 pt-0">
                  <EmptyState
                    icon={CheckCircle2}
                    title="Sin mora acumulada"
                    description="No hay alquileres vencidos de meses anteriores."
                    compact
                    className="py-8"
                  />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Propiedad</TableHead>
                      <TableHead>Inquilino</TableHead>
                      <TableHead>Vencimiento</TableHead>
                      <TableHead className="text-right">Saldo</TableHead>
                      <TableHead className="text-right">Acción</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {overdueRent.slice(0, MAX_ROWS).map((item) => (
                      <TableRow key={item.id} className="bg-destructive/5 hover:bg-destructive/10">
                        <TableCell className="font-medium">{item.property}</TableCell>
                        <TableCell className="text-muted-foreground">{item.tenant}</TableCell>
                        <TableCell className="text-destructive font-medium">{formatDate(item.dueDate)}</TableCell>
                        <TableCell className="text-right font-bold text-destructive">
                          {formatCurrency(item.balanceDue)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            onClick={() => onRecordPayment(item.id)}
                            className="gap-1"
                          >
                            Registrar pago
                            <ArrowRight className="w-3 h-3" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              {overdueRent.length > MAX_ROWS && (
                <div className="px-6 py-3 border-t border-border">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-foreground gap-1"
                    onClick={() => navigate("/payment-proofs?kindTab=rent&statusTab=action&dueScope=overdue")}
                  >
                    Ver todos los vencidos ({overdueRent.length})
                    <ArrowRight className="w-3 h-3" />
                  </Button>
                </div>
              )}
            </TabsContent>

            {/* TAB: Próximos (due in 7 days) */}
            <TabsContent value="upcoming" className="m-0">
              {dueSoon.length === 0 ? (
                <div className="p-6 pt-0">
                  <EmptyState
                    icon={CheckCircle2}
                    title="Sin vencimientos próximos"
                    description="No hay alquileres que venzan en los próximos 7 días."
                    compact
                    className="py-8"
                  />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Propiedad</TableHead>
                      <TableHead>Inquilino</TableHead>
                      <TableHead>Vencimiento</TableHead>
                      <TableHead className="text-right">Esperado</TableHead>
                      <TableHead className="text-right">Acción</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dueSoon.slice(0, MAX_ROWS).map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.property}</TableCell>
                        <TableCell className="text-muted-foreground">{item.tenant}</TableCell>
                        <TableCell>{formatDate(item.dueDate)}</TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatCurrency(item.expectedAmount)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onRecordPayment(item.id)}
                            className="gap-1"
                          >
                            Registrar pago
                            <ArrowRight className="w-3 h-3" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>

            {/* TAB: Faltantes (missing proofs) */}
            <TabsContent value="missing" className="m-0">
              {missingProofs.length === 0 ? (
                <div className="p-6 pt-0">
                  <EmptyState
                    icon={CheckCircle2}
                    title="Documentación completa"
                    description="Todos los pagos confirmados tienen comprobante adjunto."
                    compact
                    className="py-8"
                  />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Propiedad</TableHead>
                      <TableHead>Período</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Acción</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {missingProofs.slice(0, MAX_ROWS).map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.property}</TableCell>
                        <TableCell>{item.period}</TableCell>
                        <TableCell>
                          <StatusBadge variant={item.status as any} />
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onUploadProof?.(item.id)}
                            className="gap-1"
                          >
                            Subir comprobante
                            <ArrowRight className="w-3 h-3" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              {missingProofs.length > MAX_ROWS && (
                <div className="px-6 py-3 border-t border-border">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-foreground gap-1"
                    onClick={() => navigate("/payment-proofs?kindTab=rent&statusTab=confirmed&missingProof=true")}
                  >
                    Ver todos los faltantes ({missingProofs.length})
                    <ArrowRight className="w-3 h-3" />
                  </Button>
                </div>
              )}
            </TabsContent>

            {/* TAB: Ajustes próximos */}
            <TabsContent value="adjustments" className="m-0">
              {upcomingAdjustments.length === 0 ? (
                <div className="p-6 pt-0">
                  <EmptyState
                    icon={TrendingUp}
                    title="Sin ajustes próximos"
                    description="No hay contratos con ajuste programado en los próximos 90 días."
                    compact
                    className="py-8"
                  />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Propiedad</TableHead>
                      <TableHead>Inquilino</TableHead>
                      <TableHead>Próximo ajuste</TableHead>
                      <TableHead className="text-right">Alquiler actual</TableHead>
                      <TableHead className="text-right">Acción</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {upcomingAdjustments.slice(0, MAX_ROWS).map((item) => {
                      const days = daysFromToday(item.nextAdjustmentDate);
                      const isUrgent = days <= 15;
                      return (
                        <TableRow key={item.contractId} className={isUrgent ? "bg-warning/5 hover:bg-warning/10" : ""}>
                          <TableCell className="font-medium">{item.property}</TableCell>
                          <TableCell className="text-muted-foreground">{item.tenant}</TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-0.5">
                              <span className={isUrgent ? "text-warning font-semibold" : "font-medium"}>
                                {formatDate(item.nextAdjustmentDate)}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {days === 0 ? "Hoy" : days < 0 ? `Hace ${Math.abs(days)}d` : `En ${days} días`}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {formatCurrency(item.currentRent, item.currencyRent)}
                            <span className="text-xs text-muted-foreground ml-1">{item.currencyRent}</span>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant={isUrgent ? "default" : "outline"}
                              onClick={() => navigate(`/contracts/${item.contractId}?openAdjustment=true`)}
                              className="gap-1"
                            >
                              Registrar ajuste
                              <ArrowRight className="w-3 h-3" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
              {upcomingAdjustments.length > MAX_ROWS && (
                <div className="px-6 py-3 border-t border-border">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-foreground gap-1"
                    onClick={() => navigate("/upcoming-adjustments")}
                  >
                    Ver todos los ajustes ({upcomingAdjustments.length})
                    <ArrowRight className="w-3 h-3" />
                  </Button>
                </div>
              )}
            </TabsContent>
          </div>
        </Tabs>
      </CardContent>
    </Card>
  );
}
