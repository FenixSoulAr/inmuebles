import { useState, useEffect } from "react";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";

interface Property {
  id: string;
  internal_identifier: string;
}

interface AddUtilityModalProps {
  onSuccess: () => void;
  preselectedPropertyId?: string;
  triggerButton?: React.ReactNode;
}

const utilityTypes = [
  { value: "electricity", label: "Electricity" },
  { value: "gas", label: "Gas" },
  { value: "water", label: "Water" },
  { value: "hoa", label: "Building fees (HOA / Expensas)" },
  { value: "insurance", label: "Insurance" },
];

const frequencies = [
  { value: "monthly", label: "Monthly" },
  { value: "bimonthly", label: "Bimonthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "annual", label: "Annual" },
];

const responsibleOptions = [
  { value: "tenant", label: "Tenant" },
  { value: "owner", label: "Owner" },
];

export function AddUtilityModal({
  onSuccess,
  preselectedPropertyId,
  triggerButton,
}: AddUtilityModalProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loadingProperties, setLoadingProperties] = useState(false);

  // Form state
  const [propertyId, setPropertyId] = useState(preselectedPropertyId || "");
  const [utilityType, setUtilityType] = useState("");
  const [payer, setPayer] = useState("");
  const [frequency, setFrequency] = useState("monthly");
  const [dueDay, setDueDay] = useState("10");
  const [startMonth, setStartMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  const { toast } = useToast();

  useEffect(() => {
    if (open && !preselectedPropertyId) {
      fetchProperties();
    }
  }, [open, preselectedPropertyId]);

  useEffect(() => {
    if (preselectedPropertyId) {
      setPropertyId(preselectedPropertyId);
    }
  }, [preselectedPropertyId]);

  const fetchProperties = async () => {
    setLoadingProperties(true);
    try {
      const { data, error } = await supabase
        .from("properties")
        .select("id, internal_identifier")
        .order("internal_identifier");

      if (error) throw error;
      setProperties(data || []);
    } catch (error) {
      console.error("Error fetching properties:", error);
    } finally {
      setLoadingProperties(false);
    }
  };

  const resetForm = () => {
    if (!preselectedPropertyId) {
      setPropertyId("");
    }
    setUtilityType("");
    setPayer("");
    setFrequency("monthly");
    setDueDay("10");
    const now = new Date();
    setStartMonth(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
  };

  const getMonthIncrement = (freq: string): number => {
    switch (freq) {
      case "bimonthly":
        return 2;
      case "quarterly":
        return 3;
      case "annual":
        return 12;
      default:
        return 1;
    }
  };

  const generateProofPeriods = (
    startMonthStr: string,
    freq: string
  ): string[] => {
    const periods: string[] = [];
    const [startYear, startMonthNum] = startMonthStr.split("-").map(Number);
    const startDate = new Date(startYear, startMonthNum - 1);
    const monthIncrement = getMonthIncrement(freq);

    // Generate only 2 periods: current and next upcoming
    for (let i = 0; i < 2; i++) {
      const current = new Date(startDate);
      current.setMonth(current.getMonth() + i * monthIncrement);
      const year = current.getFullYear();
      const month = String(current.getMonth() + 1).padStart(2, "0");
      periods.push(`${year}-${month}`);
    }

    return periods;
  };

  const handleSubmit = async () => {
    if (!propertyId || !utilityType || !payer) {
      toast({
        title: "Error",
        description: "Please fill all required fields.",
        variant: "destructive",
      });
      return;
    }

    const dueDayNum = parseInt(dueDay);
    if (isNaN(dueDayNum) || dueDayNum < 1 || dueDayNum > 28) {
      toast({
        title: "Error",
        description: "Due day must be between 1 and 28.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // 1. Create utility obligation
      const { data: obligation, error: obligationError } = await supabase
        .from("utility_obligations")
        .insert({
          property_id: propertyId,
          type: utilityType,
          payer: payer,
          frequency: frequency,
          due_day_of_month: dueDayNum,
          active: true,
        } as any)
        .select()
        .single();

      if (obligationError) throw obligationError;

      // 2. Generate proof periods
      const periods = generateProofPeriods(startMonth, frequency);

      // 3. Create utility proofs for each period
      if (periods.length > 0) {
        const proofs = periods.map((period) => ({
          utility_obligation_id: obligation.id,
          period_month: period,
          status: "not_submitted",
        }));

        const { error: proofsError } = await supabase
          .from("utility_proofs")
          .insert(proofs as any);

        if (proofsError) throw proofsError;
      }

      toast({
        title: "Utility added.",
        description: `Created ${periods.length} proof periods.`,
      });

      setOpen(false);
      resetForm();
      onSuccess();
    } catch (error) {
      console.error("Error creating utility:", error);
      toast({
        title: "Error",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const isFormValid = propertyId && utilityType && payer;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {triggerButton || (
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Add utility
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add utility</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-4">
          {/* Property selector - only show if not preselected */}
          {!preselectedPropertyId && (
            <div className="space-y-2">
              <Label>Property *</Label>
              <Select value={propertyId} onValueChange={setPropertyId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select property" />
                </SelectTrigger>
                <SelectContent>
                  {loadingProperties ? (
                    <SelectItem value="loading" disabled>
                      Loading...
                    </SelectItem>
                  ) : properties.length === 0 ? (
                    <SelectItem value="none" disabled>
                      No properties found
                    </SelectItem>
                  ) : (
                    properties.map((prop) => (
                      <SelectItem key={prop.id} value={prop.id}>
                        {prop.internal_identifier}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Utility Type */}
          <div className="space-y-2">
            <Label>Utility type *</Label>
            <Select value={utilityType} onValueChange={setUtilityType}>
              <SelectTrigger>
                <SelectValue placeholder="Select utility type" />
              </SelectTrigger>
              <SelectContent>
                {utilityTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Responsible */}
          <div className="space-y-2">
            <Label>Responsible *</Label>
            <Select value={payer} onValueChange={setPayer}>
              <SelectTrigger>
                <SelectValue placeholder="Select responsible party" />
              </SelectTrigger>
              <SelectContent>
                {responsibleOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Frequency */}
          <div className="space-y-2">
            <Label>Frequency</Label>
            <Select value={frequency} onValueChange={setFrequency}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {frequencies.map((freq) => (
                  <SelectItem key={freq.value} value={freq.value}>
                    {freq.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Due Day */}
          <div className="space-y-2">
            <Label>Due day of month</Label>
            <Input
              type="number"
              min={1}
              max={28}
              value={dueDay}
              onChange={(e) => setDueDay(e.target.value)}
              placeholder="10"
            />
            <p className="text-xs text-muted-foreground">
              Day of the month when proof is due (1-28)
            </p>
          </div>

          {/* Start Month */}
          <div className="space-y-2">
            <Label>Start month</Label>
            <Input
              type="month"
              value={startMonth}
              onChange={(e) => setStartMonth(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Proofs will be generated for 12 months starting from this month
            </p>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={loading || !isFormValid}>
              {loading ? "Adding..." : "Add utility"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
