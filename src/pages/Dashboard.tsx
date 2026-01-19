import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, DollarSign, Upload, X, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { DashboardKPIs } from "@/components/dashboard/DashboardKPIs";
import {
  ActionCenter,
  OverdueRentItem,
  DueSoonItem,
  MissingProofItem,
  TaxDueItem,
  MaintenanceItem,
} from "@/components/dashboard/ActionCenter";
import { MonthlyAgenda, AgendaItem } from "@/components/dashboard/MonthlyAgenda";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface RentDueData {
  id: string;
  period_month: string;
  due_date: string;
  expected_amount: number;
  balance_due: number;
  status: string;
  properties: { internal_identifier: string };
  tenants: { full_name: string };
  rent_payments: { amount: number }[];
}

interface DashboardStats {
  occupiedCount: number;
  vacantCount: number;
  rentCollectedThisMonth: number;
  rentOutstandingThisMonth: number;
  missingUtilityProofs: number;
  taxesDueSoon: number;
  openMaintenance: number;
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    occupiedCount: 0,
    vacantCount: 0,
    rentCollectedThisMonth: 0,
    rentOutstandingThisMonth: 0,
    missingUtilityProofs: 0,
    taxesDueSoon: 0,
    openMaintenance: 0,
  });
  const [overdueRent, setOverdueRent] = useState<OverdueRentItem[]>([]);
  const [dueSoon, setDueSoon] = useState<DueSoonItem[]>([]);
  const [missingProofs, setMissingProofs] = useState<MissingProofItem[]>([]);
  const [taxesDue, setTaxesDue] = useState<TaxDueItem[]>([]);
  const [openMaintenance, setOpenMaintenance] = useState<MaintenanceItem[]>([]);
  const [agendaItems, setAgendaItems] = useState<AgendaItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Payment modal state
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [selectedRentDue, setSelectedRentDue] = useState<RentDueData | null>(null);
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0]);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("transfer");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      const now = new Date();
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString();

      // Parallel fetch all data
      const [
        propertiesRes,
        rentDuesRes,
        paymentsThisMonthRes,
        utilityProofsRes,
        taxesRes,
        maintenanceRes,
        alertsRes,
      ] = await Promise.all([
        supabase.from("properties").select("id, status"),
        supabase
          .from("rent_dues")
          .select("*, properties(internal_identifier), tenants(full_name), rent_payments(amount)")
          .order("due_date", { ascending: true }),
        supabase
          .from("rent_payments")
          .select("amount")
          .gte("payment_date", monthStart)
          .lte("payment_date", monthEnd),
        supabase
          .from("utility_proofs")
          .select("*, utility_obligations(type, properties(internal_identifier))")
          .in("status", ["not_submitted", "overdue"]),
        supabase
          .from("tax_obligations")
          .select("*, properties(internal_identifier)")
          .eq("status", "pending")
          .lte("due_date", in30Days),
        supabase
          .from("maintenance_issues")
          .select("*, properties(internal_identifier)")
          .neq("status", "resolved"),
        supabase
          .from("alerts")
          .select("*")
          .eq("status", "open")
          .gte("due_date", now.toISOString())
          .lte("due_date", monthEnd)
          .order("due_date", { ascending: true })
          .limit(10),
      ]);

      // Process properties stats
      const properties = propertiesRes.data || [];
      const occupiedCount = properties.filter((p) => p.status === "occupied").length;
      const vacantCount = properties.filter((p) => p.status === "vacant").length;

      // Process rent dues
      const rentDues = (rentDuesRes.data || []) as RentDueData[];
      const todayStr = now.toISOString().split("T")[0];

      // Compute derived status for each rent due
      const processedRentDues = rentDues.map((rd) => {
        const totalPaid = (rd.rent_payments || []).reduce((sum, p) => sum + Number(p.amount), 0);
        const balanceDue = Math.max(rd.expected_amount - totalPaid, 0);
        let derivedStatus: string;
        if (totalPaid >= rd.expected_amount) {
          derivedStatus = "paid";
        } else if (totalPaid > 0) {
          derivedStatus = "partial";
        } else if (new Date(rd.due_date) < now) {
          derivedStatus = "overdue";
        } else {
          derivedStatus = "due";
        }
        return { ...rd, balanceDue, derivedStatus };
      });

      // Overdue rent: status is overdue or partial with balance > 0 and past due
      const overdueItems: OverdueRentItem[] = processedRentDues
        .filter(
          (rd) =>
            rd.balanceDue > 0 &&
            (rd.derivedStatus === "overdue" || (rd.derivedStatus === "partial" && new Date(rd.due_date) < now))
        )
        .map((rd) => ({
          id: rd.id,
          property: rd.properties.internal_identifier,
          tenant: rd.tenants.full_name,
          dueDate: rd.due_date,
          balanceDue: rd.balanceDue,
          status: rd.derivedStatus,
        }));

      // Due soon: due in next 7 days, not paid
      const dueSoonItems: DueSoonItem[] = processedRentDues
        .filter(
          (rd) =>
            rd.balanceDue > 0 &&
            rd.derivedStatus === "due" &&
            rd.due_date >= todayStr &&
            rd.due_date <= in7Days.split("T")[0]
        )
        .map((rd) => ({
          id: rd.id,
          property: rd.properties.internal_identifier,
          tenant: rd.tenants.full_name,
          dueDate: rd.due_date,
          expectedAmount: rd.expected_amount,
        }));

      // Rent collected this month
      const rentCollected = (paymentsThisMonthRes.data || []).reduce(
        (sum, p) => sum + Number(p.amount),
        0
      );

      // Rent outstanding this month
      const rentOutstanding = processedRentDues
        .filter((rd) => rd.period_month === currentMonth && rd.balanceDue > 0)
        .reduce((sum, rd) => sum + rd.balanceDue, 0);

      // Missing utility proofs with derived status
      const utilityProofs = utilityProofsRes.data || [];
      const missingProofItems: MissingProofItem[] = utilityProofs.map((p: any) => {
        // Derive due date from period and due_day_of_month
        const [year, month] = (p.period_month || "").split("-").map(Number);
        const dueDay = p.utility_obligations?.due_day_of_month || 10;
        const dueDate = new Date(year, month - 1, dueDay);
        
        // Derive status: overdue if past due date and no file
        const derivedStatus = dueDate < now && !p.file_url ? "overdue" : "not_submitted";
        
        return {
          id: p.id,
          property: p.utility_obligations?.properties?.internal_identifier || "Unknown",
          utilityType: p.utility_obligations?.type || "Unknown",
          period: formatMonth(p.period_month),
          status: derivedStatus,
          dueDate: dueDate.toISOString().split("T")[0],
        };
      });

      // Taxes due soon
      const taxes = taxesRes.data || [];
      const taxItems: TaxDueItem[] = taxes.map((t: any) => ({
        id: t.id,
        property: t.properties?.internal_identifier || "Unknown",
        taxType: formatTaxType(t.type),
        dueDate: t.due_date,
        status: t.status,
      }));

      // Open maintenance
      const maintenance = maintenanceRes.data || [];
      const maintenanceItems: MaintenanceItem[] = maintenance.map((m: any) => ({
        id: m.id,
        property: m.properties?.internal_identifier || "Unknown",
        issue: m.description,
        status: m.status,
      }));

      // Agenda items for this month
      const alerts = alertsRes.data || [];
      const agenda: AgendaItem[] = alerts.map((a) => ({
        id: a.id,
        type: mapAlertType(a.type),
        title: a.title,
        dueDate: a.due_date || "",
        property: a.description || "",
      }));

      // Add upcoming rent dues to agenda
      processedRentDues
        .filter((rd) => rd.due_date >= todayStr && rd.due_date <= monthEnd.split("T")[0])
        .slice(0, 5)
        .forEach((rd) => {
          agenda.push({
            id: `rent-${rd.id}`,
            type: "rent",
            title: `Rent due: ${formatMonth(rd.period_month)}`,
            dueDate: rd.due_date,
            property: rd.properties.internal_identifier,
          });
        });

      // Sort agenda by date
      agenda.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

      setStats({
        occupiedCount,
        vacantCount,
        rentCollectedThisMonth: rentCollected,
        rentOutstandingThisMonth: rentOutstanding,
        missingUtilityProofs: missingProofItems.length,
        taxesDueSoon: taxItems.length,
        openMaintenance: maintenanceItems.length,
      });
      setOverdueRent(overdueItems);
      setDueSoon(dueSoonItems);
      setMissingProofs(missingProofItems);
      setTaxesDue(taxItems);
      setOpenMaintenance(maintenanceItems);
      setAgendaItems(agenda);
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

  const formatMonth = (periodMonth: string) => {
    const [year, month] = periodMonth.split("-");
    return new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString("en-US", {
      month: "short",
      year: "numeric",
    });
  };

  const formatTaxType = (type: string) => {
    const labels: Record<string, string> = {
      municipal: "Municipal Tax",
      property: "Property Tax",
      income: "Income Tax",
    };
    return labels[type] || type;
  };

  const mapAlertType = (type: string): "rent" | "contract" | "utility" | "tax" => {
    if (type.includes("rent")) return "rent";
    if (type.includes("contract")) return "contract";
    if (type.includes("utility")) return "utility";
    if (type.includes("tax")) return "tax";
    return "rent";
  };

  // Payment modal handlers
  const handleRecordPayment = async (rentDueId: string) => {
    // Fetch the full rent due data
    const { data, error } = await supabase
      .from("rent_dues")
      .select("*, properties(internal_identifier), tenants(full_name), rent_payments(amount)")
      .eq("id", rentDueId)
      .single();

    if (error || !data) {
      toast({
        title: "Error",
        description: "Could not load rent due data.",
        variant: "destructive",
      });
      return;
    }

    const totalPaid = (data.rent_payments || []).reduce((sum: number, p: any) => sum + Number(p.amount), 0);
    const balanceDue = Math.max(data.expected_amount - totalPaid, 0);

    // Block if already fully paid
    if (balanceDue === 0) {
      toast({
        title: "Already paid",
        description: "This rent is already fully paid.",
        variant: "destructive",
      });
      return;
    }

    setSelectedRentDue(data as RentDueData);
    setPaymentAmount(balanceDue.toString());
    setPaymentDate(new Date().toISOString().split("T")[0]);
    setPaymentMethod("transfer");
    setPaymentNotes("");
    setReceiptFile(null);
    setPaymentDialogOpen(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "Error",
        description: "File is too large. Maximum size is 10MB.",
        variant: "destructive",
      });
      return;
    }

    const allowedTypes = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "Error",
        description: "File type not supported. Please upload PDF, JPG, PNG, or WebP.",
        variant: "destructive",
      });
      return;
    }

    setReceiptFile(file);
  };

  const removeFile = () => {
    setReceiptFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const uploadReceipt = async (rentDueId: string): Promise<string | null> => {
    if (!receiptFile || !user) return null;

    const fileExt = receiptFile.name.split(".").pop();
    const fileName = `${user.id}/${rentDueId}/${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("documents")
      .upload(fileName, receiptFile);

    if (uploadError) throw uploadError;

    const {
      data: { publicUrl },
    } = supabase.storage.from("documents").getPublicUrl(fileName);

    return publicUrl;
  };

  const handlePaymentSubmit = async () => {
    if (!selectedRentDue) return;

    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: "Error",
        description: "Enter a valid amount greater than 0.",
        variant: "destructive",
      });
      return;
    }

    if (!paymentDate) {
      toast({
        title: "Error",
        description: "Payment date is required.",
        variant: "destructive",
      });
      return;
    }

    const totalPaid = (selectedRentDue.rent_payments || []).reduce(
      (sum, p) => sum + Number(p.amount),
      0
    );
    const balanceDue = Math.max(selectedRentDue.expected_amount - totalPaid, 0);
    const exceedsBalance = amount > balanceDue;

    setIsSubmitting(true);

    try {
      let receiptUrl: string | null = null;
      if (receiptFile) {
        receiptUrl = await uploadReceipt(selectedRentDue.id);
      }

      const { error: paymentError } = await supabase.from("rent_payments").insert({
        rent_due_id: selectedRentDue.id,
        payment_date: paymentDate,
        amount: amount,
        method: paymentMethod,
        receipt_file_url: receiptUrl,
        notes: paymentNotes || null,
      });

      if (paymentError) throw paymentError;

      const newTotalPaid = totalPaid + amount;
      const newBalance = Math.max(0, selectedRentDue.expected_amount - newTotalPaid);

      let newStatus: string;
      if (newTotalPaid >= selectedRentDue.expected_amount) {
        newStatus = "paid";
      } else if (newTotalPaid > 0) {
        newStatus = "partial";
      } else if (new Date() > new Date(selectedRentDue.due_date)) {
        newStatus = "overdue";
      } else {
        newStatus = "due";
      }

      const { error: updateError } = await supabase
        .from("rent_dues")
        .update({
          balance_due: newBalance,
          status: newStatus,
        })
        .eq("id", selectedRentDue.id);

      if (updateError) throw updateError;

      if (exceedsBalance) {
        toast({
          title: "Payment saved",
          description: "Payment saved. Amount exceeds the remaining balance.",
        });
      } else if (newBalance > 0) {
        toast({
          title: "Payment saved",
          description: `Payment saved. Balance still due: $${newBalance.toFixed(2)}`,
        });
      } else {
        toast({
          title: "Payment complete",
          description: "Rent has been fully paid.",
        });
      }

      setPaymentDialogOpen(false);
      setSelectedRentDue(null);
      fetchDashboardData();
    } catch (error) {
      console.error("Error recording payment:", error);
      toast({
        title: "Error",
        description: "Could not save payment. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
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
      <PageHeader title="Dashboard" description="Overview of your property portfolio">
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate("/rent")}>
            <DollarSign className="w-4 h-4 mr-2" />
            Record payment
          </Button>
          <Button onClick={() => navigate("/properties")}>
            <Plus className="w-4 h-4 mr-2" />
            Add property
          </Button>
        </div>
      </PageHeader>

      {/* KPI Cards */}
      <DashboardKPIs
        occupiedCount={stats.occupiedCount}
        vacantCount={stats.vacantCount}
        rentCollectedThisMonth={stats.rentCollectedThisMonth}
        rentOutstandingThisMonth={stats.rentOutstandingThisMonth}
        missingUtilityProofs={stats.missingUtilityProofs}
        taxesDueSoon={stats.taxesDueSoon}
        openMaintenance={stats.openMaintenance}
      />

      {/* Main content grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Action Center - Takes 2 columns */}
        <div className="lg:col-span-2">
          <ActionCenter
            overdueRent={overdueRent}
            dueSoon={dueSoon}
            missingProofs={missingProofs}
            taxesDueSoon={taxesDue}
            openMaintenance={openMaintenance}
            onRecordPayment={handleRecordPayment}
            onUploadProof={() => navigate("/utilities")}
            onUploadTaxReceipt={() => navigate("/taxes")}
          />
        </div>

        {/* Monthly Agenda - Takes 1 column */}
        <div className="lg:col-span-1">
          <MonthlyAgenda items={agendaItems} />
        </div>
      </div>

      {/* Record Payment Modal */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent className="flex flex-col max-h-[90vh] sm:max-w-[600px]">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>Record payment</DialogTitle>
            <DialogDescription>
              {selectedRentDue && (
                <>
                  {selectedRentDue.properties.internal_identifier} • {selectedRentDue.tenants.full_name}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto py-4 space-y-4">
            <p className="text-sm text-muted-foreground">
              You can record multiple payments for the same rent due.
            </p>

            <div className="space-y-2">
              <Label htmlFor="payment-date">Payment date *</Label>
              <Input
                id="payment-date"
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="payment-amount">Amount *</Label>
              <Input
                id="payment-amount"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Method</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="transfer">Transfer</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="payment-notes">Notes</Label>
              <Textarea
                id="payment-notes"
                placeholder="Optional notes..."
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Receipt (optional)</Label>
              <p className="text-xs text-muted-foreground mb-2">Upload a PDF or image.</p>
              {receiptFile ? (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm flex-1 truncate">{receiptFile.name}</span>
                  <Button variant="ghost" size="sm" onClick={removeFile}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <div
                  className="flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-lg cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="w-8 h-8 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">Click to upload</p>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>
          </div>

          <DialogFooter className="flex-shrink-0 pt-4 border-t">
            <Button variant="outline" onClick={() => setPaymentDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handlePaymentSubmit} disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
