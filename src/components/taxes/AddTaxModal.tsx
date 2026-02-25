import { useState, useEffect } from "react";
import { Plus, CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface Property {
  id: string;
  internal_identifier: string;
}

interface AddTaxModalProps {
  onSuccess: () => void;
  preselectedPropertyId?: string;
  triggerButton?: React.ReactNode;
}

const taxTypes = [
  { value: "municipal", label: "Municipal Tax" },
  { value: "property", label: "Property Tax" },
  { value: "income", label: "Income Tax" },
  { value: "other", label: "Other" },
];

const responsibleOptions = [
  { value: "owner", label: "Owner" },
  { value: "tenant", label: "Tenant" },
];

const frequencies = [
  { value: "monthly", label: "Monthly" },
  { value: "bimonthly", label: "Bimonthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "annual", label: "Annual" },
];

const endConditions = [
  { value: "end_of_year", label: "Until end of current year" },
  { value: "specific_date", label: "Until a specific date" },
  { value: "no_end", label: "No end date (ongoing)" },
];

export function AddTaxModal({
  onSuccess,
  preselectedPropertyId,
  triggerButton,
}: AddTaxModalProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loadingProperties, setLoadingProperties] = useState(false);

  // Form state
  const [propertyId, setPropertyId] = useState(preselectedPropertyId || "");
  const [taxType, setTaxType] = useState("");
  const [responsible, setResponsible] = useState("owner");
  const [repetitionType, setRepetitionType] = useState<"one-time" | "recurring">("one-time");
  const [frequency, setFrequency] = useState("annual");
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endCondition, setEndCondition] = useState("end_of_year");
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [amount, setAmount] = useState("");

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
    setTaxType("");
    setResponsible("owner");
    setRepetitionType("one-time");
    setFrequency("annual");
    setDueDate(undefined);
    setStartDate(undefined);
    setEndCondition("end_of_year");
    setEndDate(undefined);
    setAmount("");
  };

  const getMonthIncrement = (freq: string): number => {
    switch (freq) {
      case "bimonthly": return 2;
      case "quarterly": return 3;
      case "annual": return 12;
      default: return 1;
    }
  };

  const generateTaxRecords = (): Date[] => {
    if (repetitionType === "one-time") {
      return dueDate ? [dueDate] : [];
    }

    if (!startDate) return [];

    const dates: Date[] = [];
    const monthIncrement = getMonthIncrement(frequency);
    let currentDate = new Date(startDate);

    // Determine end date based on condition
    let maxDate: Date;
    switch (endCondition) {
      case "end_of_year":
        maxDate = new Date(new Date().getFullYear(), 11, 31);
        break;
      case "specific_date":
        maxDate = endDate || new Date(new Date().getFullYear(), 11, 31);
        break;
      case "no_end":
        // For "no end", generate 2 years of records max
        maxDate = new Date(startDate);
        maxDate.setFullYear(maxDate.getFullYear() + 2);
        break;
      default:
        maxDate = new Date(new Date().getFullYear(), 11, 31);
    }

    while (currentDate <= maxDate) {
      dates.push(new Date(currentDate));
      currentDate.setMonth(currentDate.getMonth() + monthIncrement);
    }

    return dates;
  };

  const handleSubmit = async () => {
    if (!propertyId || !taxType) {
      toast({
        title: "Error",
        description: "Please fill all required fields.",
        variant: "destructive",
      });
      return;
    }

    if (repetitionType === "one-time" && !dueDate) {
      toast({
        title: "Error",
        description: "Please select a due date.",
        variant: "destructive",
      });
      return;
    }

    if (repetitionType === "recurring" && !startDate) {
      toast({
        title: "Error",
        description: "Please select a start date.",
        variant: "destructive",
      });
      return;
    }

    if (repetitionType === "recurring" && endCondition === "specific_date" && !endDate) {
      toast({
        title: "Error",
        description: "Please select an end date.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const dueDates = generateTaxRecords();
      
      if (dueDates.length === 0) {
        toast({
          title: "Error",
          description: "No tax records to generate. Check your dates.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      const taxRecords = dueDates.map((date) => ({
        property_id: propertyId,
        type: taxType,
        responsible: responsible,
        frequency: repetitionType === "one-time" ? "one-time" : frequency,
        due_date: format(date, "yyyy-MM-dd"),
        status: "pending",
        amount: amount ? parseFloat(amount) : null,
      }));

      const { error } = await supabase
        .from("tax_obligations")
        .insert(taxRecords as any);

      if (error) throw error;

      toast({
        title: "Tax added",
        description: `Created ${dueDates.length} tax record${dueDates.length > 1 ? "s" : ""}.`,
      });

      setOpen(false);
      resetForm();
      onSuccess();
    } catch (error) {
      console.error("Error creating tax:", error);
      toast({
        title: "Error",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const isFormValid =
    propertyId &&
    taxType &&
    ((repetitionType === "one-time" && dueDate) ||
      (repetitionType === "recurring" && startDate && (endCondition !== "specific_date" || endDate)));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {triggerButton || (
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Add tax
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add tax obligation</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-4">
          {/* Property selector */}
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

          {/* Tax Type */}
          <div className="space-y-2">
            <Label>Tax type *</Label>
            <Select value={taxType} onValueChange={setTaxType}>
              <SelectTrigger>
                <SelectValue placeholder="Select tax type" />
              </SelectTrigger>
              <SelectContent>
                {taxTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Responsible */}
          <div className="space-y-2">
            <Label>Responsible</Label>
            <Select value={responsible} onValueChange={setResponsible}>
              <SelectTrigger>
                <SelectValue />
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

          {/* Amount */}
          <div className="space-y-2">
            <Label>Amount (optional)</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
            />
          </div>

          {/* Repetition Type */}
          <div className="space-y-3">
            <Label>How often does this tax repeat?</Label>
            <RadioGroup
              value={repetitionType}
              onValueChange={(v) => setRepetitionType(v as "one-time" | "recurring")}
              className="space-y-2"
            >
              <div className="flex items-start space-x-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
                <RadioGroupItem value="one-time" id="one-time" className="mt-0.5" />
                <div className="flex-1">
                  <Label htmlFor="one-time" className="font-medium cursor-pointer">
                    One-time
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Use this for single or irregular tax bills.
                  </p>
                </div>
              </div>
              <div className="flex items-start space-x-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
                <RadioGroupItem value="recurring" id="recurring" className="mt-0.5" />
                <div className="flex-1">
                  <Label htmlFor="recurring" className="font-medium cursor-pointer">
                    Recurring
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Use this when the tax repeats on a regular schedule.
                  </p>
                </div>
              </div>
            </RadioGroup>
          </div>

          {/* One-time: Due Date */}
          {repetitionType === "one-time" && (
            <div className="space-y-2">
              <Label>Due date *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !dueDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dueDate ? format(dueDate, "PPP") : "Select date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dueDate}
                    onSelect={setDueDate}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>
          )}

          {/* Recurring options */}
          {repetitionType === "recurring" && (
            <>
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

              {/* Start Date */}
              <div className="space-y-2">
                <Label>Start date *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !startDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {startDate ? format(startDate, "PPP") : "Select date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={startDate}
                      onSelect={setStartDate}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* End Condition */}
              <div className="space-y-2">
                <Label>End condition</Label>
                <Select value={endCondition} onValueChange={setEndCondition}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {endConditions.map((cond) => (
                      <SelectItem key={cond.value} value={cond.value}>
                        {cond.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* End Date (if specific) */}
              {endCondition === "specific_date" && (
                <div className="space-y-2">
                  <Label>End date *</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !endDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {endDate ? format(endDate, "PPP") : "Select date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={endDate}
                        onSelect={setEndDate}
                        disabled={(date) => startDate ? date < startDate : false}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              )}
            </>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={loading || !isFormValid}>
              {loading ? "Adding..." : "Add tax"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
