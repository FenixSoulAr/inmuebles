import { useNavigate } from "react-router-dom";
import { Calendar, ArrowRight, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export interface AgendaItem {
  id: string;
  type: "rent" | "contract" | "utility" | "tax";
  title: string;
  dueDate: string;
  property: string;
}

interface MonthlyAgendaProps {
  items: AgendaItem[];
}

const typeLabels: Record<string, string> = {
  rent: "Rent due",
  contract: "Contract",
  utility: "Utility",
  tax: "Tax",
};

const typeColors: Record<string, string> = {
  rent: "bg-primary/10 text-primary",
  contract: "bg-warning/10 text-warning",
  utility: "bg-info/10 text-info",
  tax: "bg-destructive/10 text-destructive",
};

export function MonthlyAgenda({ items }: MonthlyAgendaProps) {
  const navigate = useNavigate();

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-muted-foreground" />
          This month
        </CardTitle>
        <Button variant="ghost" size="sm" onClick={() => navigate("/agenda")}>
          Open agenda
          <ArrowRight className="w-4 h-4 ml-1" />
        </Button>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <EmptyState
            icon={CheckCircle2}
            title="All clear"
            description="No upcoming items this month."
            className="py-6"
          />
        ) : (
          <ul className="space-y-2">
            {items.slice(0, 6).map((item) => (
              <li
                key={item.id}
                className="flex items-center gap-3 p-2 rounded-lg bg-muted/50"
              >
                <span
                  className={`text-xs font-medium px-2 py-1 rounded ${typeColors[item.type] || "bg-muted text-muted-foreground"}`}
                >
                  {typeLabels[item.type]}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.title}</p>
                  <p className="text-xs text-muted-foreground">{item.property}</p>
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {formatDate(item.dueDate)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
