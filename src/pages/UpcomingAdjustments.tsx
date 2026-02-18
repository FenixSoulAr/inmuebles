import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, TrendingUp, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { addMonths, format, parseISO } from "date-fns";
import { es } from "date-fns/locale";

interface UpcomingAdjustment {
  contractId: string;
  property: string;
  tenant: string;
  nextAdjustmentDate: string;
  currentRent: number;
  currencyRent: string;
  adjustmentFrequency: number;
}

const formatCurrency = (amount: number, currency: string) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: currency === "USD" ? "USD" : "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);

const formatDate = (dateStr: string) => {
  const d = parseISO(dateStr);
  return format(d, "dd MMM yyyy", { locale: es });
};

function computeNextAdjustmentDate(
  startDate: string,
  adjustmentFrequency: number,
  lastConfirmedDate: string | null
): string {
  const base = lastConfirmedDate ? parseISO(lastConfirmedDate) : parseISO(startDate);
  const next = addMonths(base, adjustmentFrequency);
  return format(next, "yyyy-MM-dd");
}

function daysFromToday(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = parseISO(dateStr);
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function AdjustmentTable({
  items,
  onRegister,
}: {
  items: UpcomingAdjustment[];
  onRegister: (contractId: string) => void;
}) {
  if (items.length === 0) {
    return (
      <div className="py-12">
        <EmptyState
          icon={TrendingUp}
          title="Sin ajustes en este período"
          description="No hay contratos con ajuste programado en este rango de fechas."
          compact
        />
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Propiedad</TableHead>
          <TableHead>Inquilino</TableHead>
          <TableHead>Próximo ajuste</TableHead>
          <TableHead>Frecuencia</TableHead>
          <TableHead className="text-right">Alquiler actual</TableHead>
          <TableHead className="text-right">Acción</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => {
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
                    {days === 0 ? "Hoy" : days < 0 ? `Hace ${Math.abs(days)} días` : `En ${days} días`}
                  </span>
                </div>
              </TableCell>
              <TableCell>
                <Badge variant="outline">
                  Cada {item.adjustmentFrequency} meses
                </Badge>
              </TableCell>
              <TableCell className="text-right font-semibold">
                {formatCurrency(item.currentRent, item.currencyRent)}
                <span className="text-xs text-muted-foreground ml-1">{item.currencyRent}</span>
              </TableCell>
              <TableCell className="text-right">
                <Button
                  size="sm"
                  variant={isUrgent ? "default" : "outline"}
                  onClick={() => onRegister(item.contractId)}
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
  );
}

export default function UpcomingAdjustments() {
  const [adjustments, setAdjustments] = useState<UpcomingAdjustment[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) fetchUpcomingAdjustments();
  }, [user]);

  const fetchUpcomingAdjustments = async () => {
    setLoading(true);
    try {
      // Fetch active contracts with property/tenant info
      const { data: contracts, error } = await supabase
        .from("contracts")
        .select(`
          id, start_date, current_rent, currency, adjustment_frequency,
          properties(internal_identifier),
          tenants(full_name)
        `)
        .eq("is_active", true);

      if (error) throw error;

      // Fetch last confirmed adjustment per contract
      const contractIds = (contracts || []).map((c: any) => c.id);
      let lastConfirmedMap: Record<string, string> = {};

      if (contractIds.length > 0) {
        const { data: confirmedAdj } = await supabase
          .from("contract_adjustments")
          .select("contract_id, adjustment_date")
          .eq("status", "confirmed")
          .in("contract_id", contractIds)
          .order("adjustment_date", { ascending: false });

        // Keep only the latest per contract
        for (const adj of confirmedAdj || []) {
          if (!lastConfirmedMap[adj.contract_id]) {
            lastConfirmedMap[adj.contract_id] = adj.adjustment_date;
          }
        }
      }

      const today = format(new Date(), "yyyy-MM-dd");
      const in90Days = format(addMonths(new Date(), 3), "yyyy-MM-dd");

      const result: UpcomingAdjustment[] = [];

      for (const c of contracts || []) {
        const freq = c.adjustment_frequency ?? 12;
        if (freq <= 0) continue;

        const lastConfirmed = lastConfirmedMap[c.id] ?? null;
        const nextDate = computeNextAdjustmentDate(c.start_date, freq, lastConfirmed);

        // Only include if within 90 days from today
        if (nextDate > in90Days) continue;

        result.push({
          contractId: c.id,
          property: (c as any).properties?.internal_identifier || "—",
          tenant: (c as any).tenants?.full_name || "—",
          nextAdjustmentDate: nextDate,
          currentRent: Number(c.current_rent),
          currencyRent: c.currency ?? "ARS",
          adjustmentFrequency: freq,
        });
      }

      // Sort by nextAdjustmentDate ascending
      result.sort((a, b) => a.nextAdjustmentDate.localeCompare(b.nextAdjustmentDate));
      setAdjustments(result);
    } catch (err) {
      console.error("Error fetching upcoming adjustments:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = (contractId: string) => {
    navigate(`/contracts/${contractId}?openAdjustment=true`);
  };

  const today = format(new Date(), "yyyy-MM-dd");
  const in30 = format(addMonths(new Date(), 1), "yyyy-MM-dd");
  const in60 = format(addMonths(new Date(), 2), "yyyy-MM-dd");
  const in90 = format(addMonths(new Date(), 3), "yyyy-MM-dd");

  const items30 = adjustments.filter((a) => a.nextAdjustmentDate <= in30);
  const items60 = adjustments.filter((a) => a.nextAdjustmentDate <= in60);
  const items90 = adjustments.filter((a) => a.nextAdjustmentDate <= in90);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Ajustes próximos"
        description="Contratos con ajuste de alquiler programado en los próximos 90 días."
      >
        <Button variant="outline" size="sm" onClick={fetchUpcomingAdjustments} className="gap-1">
          <RefreshCw className="w-4 h-4" />
          Actualizar
        </Button>
      </PageHeader>

      {adjustments.length === 0 ? (
        <EmptyState
          icon={TrendingUp}
          title="Sin ajustes próximos"
          description="No hay contratos con ajuste programado en los próximos 90 días."
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Tabs defaultValue="30">
              <div className="px-6 pt-4">
                <TabsList className="border-b border-border w-full justify-start flex-wrap h-auto gap-1 bg-transparent p-0 mb-0">
                  <TabsTrigger
                    value="30"
                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent pb-3"
                  >
                    30 días
                    {items30.length > 0 && (
                      <span className="ml-1.5 inline-flex items-center justify-center w-5 h-5 rounded-full bg-destructive/10 text-destructive text-[10px] font-bold">
                        {items30.length}
                      </span>
                    )}
                  </TabsTrigger>
                  <TabsTrigger
                    value="60"
                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent pb-3"
                  >
                    60 días
                    {items60.length > 0 && (
                      <span className="ml-1.5 inline-flex items-center justify-center w-5 h-5 rounded-full bg-warning/10 text-warning text-[10px] font-bold">
                        {items60.length}
                      </span>
                    )}
                  </TabsTrigger>
                  <TabsTrigger
                    value="90"
                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent pb-3"
                  >
                    90 días
                    {items90.length > 0 && (
                      <span className="ml-1.5 inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold">
                        {items90.length}
                      </span>
                    )}
                  </TabsTrigger>
                </TabsList>
              </div>

              <div className="overflow-x-auto">
                <TabsContent value="30" className="m-0">
                  <AdjustmentTable items={items30} onRegister={handleRegister} />
                </TabsContent>
                <TabsContent value="60" className="m-0">
                  <AdjustmentTable items={items60} onRegister={handleRegister} />
                </TabsContent>
                <TabsContent value="90" className="m-0">
                  <AdjustmentTable items={items90} onRegister={handleRegister} />
                </TabsContent>
              </div>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
