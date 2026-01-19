import { useEffect, useState } from "react";
import { Receipt, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

interface TaxObligation {
  id: string;
  type: string;
  frequency: string;
  due_date: string;
  responsible: string;
  status: string;
  properties: {
    internal_identifier: string;
    full_address: string;
  };
}

interface PropertyFiscalStatus {
  propertyId: string;
  propertyName: string;
  address: string;
  status: "ok" | "pending";
  obligations: TaxObligation[];
}

const taxTypeLabels: Record<string, string> = {
  municipal: "Municipal Tax",
  property: "Property Tax",
  income: "Income Tax",
};

export default function Taxes() {
  const [fiscalStatuses, setFiscalStatuses] = useState<PropertyFiscalStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (user) fetchTaxData();
  }, [user]);

  const fetchTaxData = async () => {
    try {
      const { data: obligations, error } = await supabase
        .from("tax_obligations")
        .select("*, properties(id, internal_identifier, full_address)")
        .order("due_date", { ascending: true });

      if (error) throw error;

      // Group by property
      const propertyMap = new Map<string, PropertyFiscalStatus>();

      obligations?.forEach((ob) => {
        const propertyId = ob.properties.id;
        if (!propertyMap.has(propertyId)) {
          propertyMap.set(propertyId, {
            propertyId,
            propertyName: ob.properties.internal_identifier,
            address: ob.properties.full_address,
            status: "ok",
            obligations: [],
          });
        }
        const entry = propertyMap.get(propertyId)!;
        entry.obligations.push(ob);
        if (ob.status === "pending") {
          entry.status = "pending";
        }
      });

      setFiscalStatuses(Array.from(propertyMap.values()));
    } catch (error) {
      console.error("Error fetching tax data:", error);
      toast({
        title: "Error",
        description: "Something went wrong. Please refresh.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
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
      <PageHeader title="Taxes" description="Track tax obligations and fiscal status" />

      {fiscalStatuses.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No tax obligations"
          description="No data yet. Add tax obligations to track fiscal status."
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {fiscalStatuses.map((property) => (
            <Card key={property.propertyId}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 text-primary">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base">{property.propertyName}</CardTitle>
                    <p className="text-xs text-muted-foreground">{property.address}</p>
                  </div>
                </div>
                <StatusBadge variant={property.status} />
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {property.obligations.map((ob) => (
                    <div
                      key={ob.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                    >
                      <div>
                        <p className="font-medium">{taxTypeLabels[ob.type] || ob.type}</p>
                        <p className="text-xs text-muted-foreground">
                          Due: {new Date(ob.due_date).toLocaleDateString()} • {ob.frequency}
                        </p>
                      </div>
                      <StatusBadge variant={ob.status as any} />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
