import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

const SERVICE_TYPES = [
  { value: "expensas", labelEs: "Expensas", labelEn: "Building Fees" },
  { value: "abl", labelEs: "ABL", labelEn: "ABL" },
  { value: "luz", labelEs: "Luz", labelEn: "Electricity" },
  { value: "agua", labelEs: "Agua", labelEn: "Water" },
  { value: "gas", labelEs: "Gas", labelEn: "Gas" },
  { value: "internet", labelEs: "Internet", labelEn: "Internet" },
  { value: "seguro", labelEs: "Seguro", labelEn: "Insurance" },
  { value: "otro", labelEs: "Otro", labelEn: "Other" },
];

interface ContractService {
  id: string;
  service_type: string;
  due_day: number;
  expected_amount: number | null;
  active: boolean;
}

interface ContractServicesProps {
  contractId: string;
  rentDueDay: number;
}

export function ContractServices({ contractId, rentDueDay }: ContractServicesProps) {
  const { i18n } = useTranslation();
  const isEs = i18n.language?.startsWith("es");
  const { toast } = useToast();

  const [services, setServices] = useState<ContractService[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  // New service form
  const [newType, setNewType] = useState("");
  const [newDueDay, setNewDueDay] = useState(rentDueDay.toString());
  const [newAmount, setNewAmount] = useState("");

  useEffect(() => {
    fetchServices();
  }, [contractId]);

  const fetchServices = async () => {
    try {
      const { data, error } = await supabase
        .from("contract_services")
        .select("*")
        .eq("contract_id", contractId)
        .order("created_at");
      if (error) throw error;
      setServices((data as ContractService[]) || []);
    } catch {
      console.error("Error fetching services");
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!newType) return;
    setAdding(true);
    try {
      const { error } = await supabase.from("contract_services").insert({
        contract_id: contractId,
        service_type: newType,
        due_day: parseInt(newDueDay) || rentDueDay,
        expected_amount: newAmount ? parseFloat(newAmount) : null,
        active: true,
      });
      if (error) throw error;
      toast({ title: isEs ? "Servicio agregado" : "Service added" });
      setNewType("");
      setNewAmount("");
      setNewDueDay(rentDueDay.toString());
      fetchServices();
    } catch {
      toast({ title: isEs ? "Error" : "Error", variant: "destructive" });
    } finally {
      setAdding(false);
    }
  };

  const toggleActive = async (id: string, active: boolean) => {
    await supabase.from("contract_services").update({ active }).eq("id", id);
    fetchServices();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("contract_services").delete().eq("id", id);
    fetchServices();
  };

  const getLabel = (type: string) => {
    const st = SERVICE_TYPES.find((s) => s.value === type);
    return st ? (isEs ? st.labelEs : st.labelEn) : type;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6 flex justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">
          {isEs ? "Servicios del contrato" : "Contract Services"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Existing services */}
        {services.map((svc) => (
          <div key={svc.id} className="flex items-center justify-between gap-2 py-2 border-b last:border-0">
            <div className="flex-1">
              <p className="font-medium text-sm">{getLabel(svc.service_type)}</p>
              <p className="text-xs text-muted-foreground">
                {isEs ? `Día ${svc.due_day}` : `Day ${svc.due_day}`}
                {svc.expected_amount ? ` · $${svc.expected_amount}` : ""}
              </p>
            </div>
            <Switch
              checked={svc.active}
              onCheckedChange={(checked) => toggleActive(svc.id, checked)}
            />
            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => handleDelete(svc.id)}>
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        ))}

        {/* Add new */}
        <div className="pt-2 space-y-3 border-t">
          <Label className="text-xs font-medium text-muted-foreground">
            {isEs ? "Agregar servicio" : "Add service"}
          </Label>
          <div className="grid grid-cols-3 gap-2">
            <Select value={newType} onValueChange={setNewType}>
              <SelectTrigger className="text-sm">
                <SelectValue placeholder={isEs ? "Tipo..." : "Type..."} />
              </SelectTrigger>
              <SelectContent>
                {SERVICE_TYPES.map((st) => (
                  <SelectItem key={st.value} value={st.value}>
                    {isEs ? st.labelEs : st.labelEn}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="number"
              min="1"
              max="28"
              value={newDueDay}
              onChange={(e) => setNewDueDay(e.target.value)}
              placeholder={isEs ? "Día" : "Day"}
              className="text-sm"
            />
            <Input
              type="number"
              step="0.01"
              value={newAmount}
              onChange={(e) => setNewAmount(e.target.value)}
              placeholder={isEs ? "Monto" : "Amount"}
              className="text-sm"
            />
          </div>
          <Button size="sm" onClick={handleAdd} disabled={!newType || adding}>
            <Plus className="w-3.5 h-3.5 mr-1" />
            {isEs ? "Agregar" : "Add"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
