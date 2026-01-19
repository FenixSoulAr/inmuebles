import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, FileText, Calendar, DollarSign } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/ui/page-header";
import { SearchBar } from "@/components/ui/search-bar";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

interface Contract {
  id: string;
  start_date: string;
  end_date: string;
  current_rent: number;
  is_active: boolean;
  adjustment_type: string;
  properties: {
    internal_identifier: string;
    full_address: string;
  };
  tenants: {
    full_name: string;
  };
}

export default function Contracts() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (user) fetchContracts();
  }, [user]);

  const fetchContracts = async () => {
    try {
      const { data, error } = await supabase
        .from("contracts")
        .select(`
          *,
          properties(internal_identifier, full_address),
          tenants(full_name)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setContracts(data || []);
    } catch (error) {
      console.error("Error fetching contracts:", error);
      toast({
        title: "Error",
        description: "Something went wrong. Please refresh.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredContracts = contracts.filter((contract) => {
    const matchesSearch =
      contract.properties.internal_identifier.toLowerCase().includes(search.toLowerCase()) ||
      contract.tenants.full_name.toLowerCase().includes(search.toLowerCase());
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && contract.is_active) ||
      (statusFilter === "inactive" && !contract.is_active);
    return matchesSearch && matchesStatus;
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const adjustmentLabels: Record<string, string> = {
    ipc: "IPC",
    icl: "ICL",
    fixed: "Fixed",
    manual: "Manual",
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
      <PageHeader title="Contracts" description="Manage rental contracts">
        <Button onClick={() => navigate("/contracts/new")}>
          <Plus className="w-4 h-4 mr-2" />
          Add contract
        </Button>
      </PageHeader>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Search by property or tenant..."
          className="flex-1 max-w-md"
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Contracts List */}
      {filteredContracts.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No contracts yet"
          description="No data yet. Add your first contract to get started."
          action={{
            label: "Add contract",
            onClick: () => navigate("/contracts/new"),
          }}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredContracts.map((contract) => (
            <Card
              key={contract.id}
              className="group hover:shadow-medium transition-shadow"
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 text-primary">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-semibold">{contract.properties.internal_identifier}</p>
                      <p className="text-sm text-muted-foreground">{contract.tenants.full_name}</p>
                    </div>
                  </div>
                  <StatusBadge variant={contract.is_active ? "active" : "ended"} />
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="w-4 h-4" />
                    <span>
                      {new Date(contract.start_date).toLocaleDateString()} -{" "}
                      {new Date(contract.end_date).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-success" />
                    <span className="font-semibold">{formatCurrency(contract.current_rent)}/mo</span>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t">
                  <span className="text-xs text-muted-foreground">
                    Adjustment: {adjustmentLabels[contract.adjustment_type] || contract.adjustment_type}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
