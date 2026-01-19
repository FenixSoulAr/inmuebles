import { useEffect, useState } from "react";
import { Calendar, CheckCircle2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

interface Alert {
  id: string;
  type: string;
  title: string;
  description: string | null;
  due_date: string | null;
  status: string;
  created_at: string;
}

interface GroupedAlerts {
  month: string;
  alerts: Alert[];
}

export default function Agenda() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (user) fetchAlerts();
  }, [user]);

  const fetchAlerts = async () => {
    try {
      const { data, error } = await supabase
        .from("alerts")
        .select("*")
        .order("due_date", { ascending: true });

      if (error) throw error;
      setAlerts(data || []);
    } catch (error) {
      console.error("Error fetching alerts:", error);
      toast({
        title: "Error",
        description: "Something went wrong. Please refresh.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const markAsDone = async (alertId: string) => {
    try {
      const { error } = await supabase
        .from("alerts")
        .update({ status: "done" })
        .eq("id", alertId);

      if (error) throw error;

      setAlerts(
        alerts.map((a) => (a.id === alertId ? { ...a, status: "done" } : a))
      );
    } catch (error) {
      console.error("Error updating alert:", error);
      toast({
        title: "Error",
        description: "Something went wrong. Please refresh.",
        variant: "destructive",
      });
    }
  };

  const groupAlertsByMonth = (alerts: Alert[]): GroupedAlerts[] => {
    const groups = new Map<string, Alert[]>();

    alerts.forEach((alert) => {
      const date = alert.due_date ? new Date(alert.due_date) : new Date(alert.created_at);
      const monthKey = date.toLocaleDateString("en-US", { month: "long", year: "numeric" });

      if (!groups.has(monthKey)) {
        groups.set(monthKey, []);
      }
      groups.get(monthKey)!.push(alert);
    });

    return Array.from(groups.entries()).map(([month, alerts]) => ({
      month,
      alerts,
    }));
  };

  const openAlerts = alerts.filter((a) => a.status === "open");
  const doneAlerts = alerts.filter((a) => a.status === "done");
  const groupedAlerts = groupAlertsByMonth(openAlerts);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Agenda" description="Upcoming tasks and reminders" />

      {/* Open Alerts by Month */}
      {groupedAlerts.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="All caught up!"
          description="No upcoming items."
        />
      ) : (
        <div className="space-y-6">
          {groupedAlerts.map((group) => (
            <Card key={group.month}>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-primary" />
                  {group.month}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {group.alerts.map((alert) => (
                    <div
                      key={alert.id}
                      className="flex items-start justify-between gap-4 p-4 rounded-lg bg-muted/50 animate-slide-up"
                    >
                      <div className="flex items-start gap-3 flex-1">
                        <AlertCircle className="w-5 h-5 text-warning mt-0.5" />
                        <div>
                          <p className="font-medium">{alert.title}</p>
                          {alert.description && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {alert.description}
                            </p>
                          )}
                          {alert.due_date && (
                            <p className="text-xs text-muted-foreground mt-2">
                              Due: {new Date(alert.due_date).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      </div>
                      <Button size="sm" onClick={() => markAsDone(alert.id)}>
                        Mark as done
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Completed Section */}
      {doneAlerts.length > 0 && (
        <Card className="mt-8">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2 text-muted-foreground">
              <CheckCircle2 className="w-5 h-5" />
              Completed ({doneAlerts.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {doneAlerts.slice(0, 10).map((alert) => (
                <div
                  key={alert.id}
                  className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 opacity-60"
                >
                  <CheckCircle2 className="w-4 h-4 text-success" />
                  <span className="line-through">{alert.title}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
