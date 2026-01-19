import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Building2,
  Users,
  FileText,
  DollarSign,
  AlertCircle,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface DashboardStats {
  properties: number;
  tenants: number;
  activeContracts: number;
  overdueRent: number;
}

interface Alert {
  id: string;
  type: string;
  title: string;
  description: string | null;
  due_date: string | null;
  status: string;
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    properties: 0,
    tenants: 0,
    activeContracts: 0,
    overdueRent: 0,
  });
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user]);

  const fetchDashboardData = async () => {
    try {
      const [propertiesRes, tenantsRes, contractsRes, alertsRes] = await Promise.all([
        supabase.from("properties").select("id", { count: "exact" }),
        supabase.from("tenants").select("id", { count: "exact" }).eq("status", "active"),
        supabase.from("contracts").select("id", { count: "exact" }).eq("is_active", true),
        supabase.from("alerts").select("*").eq("status", "open").order("due_date", { ascending: true }).limit(10),
      ]);

      setStats({
        properties: propertiesRes.count || 0,
        tenants: tenantsRes.count || 0,
        activeContracts: contractsRes.count || 0,
        overdueRent: 0,
      });

      if (alertsRes.data) {
        setAlerts(alertsRes.data);
      }
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      toast({
        title: "Error",
        description: "Something went wrong. Please refresh.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const markAlertDone = async (alertId: string) => {
    const { error } = await supabase
      .from("alerts")
      .update({ status: "done" })
      .eq("id", alertId);

    if (error) {
      toast({
        title: "Error",
        description: "Something went wrong. Please refresh.",
        variant: "destructive",
      });
    } else {
      setAlerts(alerts.filter((a) => a.id !== alertId));
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
      <PageHeader
        title="Dashboard"
        description="Overview of your property portfolio"
      />

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <StatCard
          title="Total Properties"
          value={stats.properties}
          icon={Building2}
          variant="primary"
        />
        <StatCard
          title="Active Tenants"
          value={stats.tenants}
          icon={Users}
          variant="success"
        />
        <StatCard
          title="Active Contracts"
          value={stats.activeContracts}
          icon={FileText}
          variant="default"
        />
        <StatCard
          title="Overdue Rent"
          value={stats.overdueRent}
          icon={DollarSign}
          variant={stats.overdueRent > 0 ? "destructive" : "default"}
        />
      </div>

      {/* Alerts & Quick Actions */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Alerts */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-warning" />
              Open Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            {alerts.length === 0 ? (
              <EmptyState
                icon={CheckCircle2}
                title="All caught up!"
                description="No upcoming items."
                className="py-8"
              />
            ) : (
              <ul className="space-y-3">
                {alerts.map((alert) => (
                  <li
                    key={alert.id}
                    className="flex items-start justify-between gap-4 p-3 rounded-lg bg-muted/50 animate-slide-up"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{alert.title}</p>
                      {alert.description && (
                        <p className="text-sm text-muted-foreground truncate">
                          {alert.description}
                        </p>
                      )}
                      {alert.due_date && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Due: {new Date(alert.due_date).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => markAlertDone(alert.id)}
                    >
                      Mark as done
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              variant="outline"
              className="w-full justify-between"
              onClick={() => navigate("/properties")}
            >
              <span>Add property</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              className="w-full justify-between"
              onClick={() => navigate("/tenants")}
            >
              <span>Add tenant</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              className="w-full justify-between"
              onClick={() => navigate("/contracts/new")}
            >
              <span>Add contract</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              className="w-full justify-between"
              onClick={() => navigate("/rent")}
            >
              <span>Record payment</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
