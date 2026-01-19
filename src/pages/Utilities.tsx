import { useEffect, useState } from "react";
import { Plus, Zap, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

interface UtilityObligation {
  id: string;
  type: string;
  payer: string;
  frequency: string;
  due_day_of_month: number;
  active: boolean;
  properties: {
    internal_identifier: string;
    full_address: string;
  };
}

interface UtilityProof {
  id: string;
  period_month: string;
  status: string;
  file_url: string | null;
  utility_obligations: {
    type: string;
    properties: {
      internal_identifier: string;
    };
  };
}

const utilityTypeLabels: Record<string, string> = {
  electricity: "Electricity",
  gas: "Gas",
  water: "Water",
  hoa: "HOA Fees",
  insurance: "Insurance",
};

export default function Utilities() {
  const [obligations, setObligations] = useState<UtilityObligation[]>([]);
  const [proofs, setProofs] = useState<UtilityProof[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (user) fetchData();
  }, [user]);

  const fetchData = async () => {
    try {
      const [obligationsRes, proofsRes] = await Promise.all([
        supabase
          .from("utility_obligations")
          .select("*, properties(internal_identifier, full_address)")
          .eq("active", true),
        supabase
          .from("utility_proofs")
          .select("*, utility_obligations(type, properties(internal_identifier))")
          .order("period_month", { ascending: false })
          .limit(50),
      ]);

      if (obligationsRes.error) throw obligationsRes.error;
      if (proofsRes.error) throw proofsRes.error;

      setObligations(obligationsRes.data || []);
      setProofs(proofsRes.data || []);
    } catch (error) {
      console.error("Error fetching utilities:", error);
      toast({
        title: "Error",
        description: "Something went wrong. Please refresh.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatMonth = (periodMonth: string) => {
    const [year, month] = periodMonth.split("-");
    return new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString("en-US", {
      month: "short",
      year: "numeric",
    });
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
      <PageHeader title="Utilities" description="Track utility payments and proofs" />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Active Obligations */}
        <Card>
          <CardHeader>
            <CardTitle>Active Obligations</CardTitle>
          </CardHeader>
          <CardContent>
            {obligations.length === 0 ? (
              <EmptyState
                icon={Zap}
                title="No utility obligations"
                description="Add utility obligations to track payments."
                className="py-8"
              />
            ) : (
              <div className="space-y-3">
                {obligations.map((ob) => (
                  <div
                    key={ob.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                  >
                    <div>
                      <p className="font-medium">{utilityTypeLabels[ob.type] || ob.type}</p>
                      <p className="text-sm text-muted-foreground">
                        {ob.properties.internal_identifier}
                      </p>
                      <p className="text-xs text-muted-foreground capitalize">
                        Payer: {ob.payer} • Due day: {ob.due_day_of_month}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Proofs */}
        <Card>
          <CardHeader>
            <CardTitle>Payment Proofs</CardTitle>
          </CardHeader>
          <CardContent>
            {proofs.length === 0 ? (
              <EmptyState
                icon={Upload}
                title="No proofs yet"
                description="Payment proofs will appear here."
                className="py-8"
              />
            ) : (
              <div className="space-y-3">
                {proofs.map((proof) => (
                  <div
                    key={proof.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                  >
                    <div>
                      <p className="font-medium">
                        {utilityTypeLabels[proof.utility_obligations.type] || proof.utility_obligations.type}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {proof.utility_obligations.properties.internal_identifier} • {formatMonth(proof.period_month)}
                      </p>
                    </div>
                    <StatusBadge variant={proof.status as any} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
