import { useEffect, useState } from "react";
import { Plus, DollarSign, Calendar, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/ui/page-header";
import { SearchBar } from "@/components/ui/search-bar";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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

interface RentDue {
  id: string;
  period_month: string;
  due_date: string;
  expected_amount: number;
  status: string;
  balance_due: number;
  contract_id: string;
  properties: {
    internal_identifier: string;
  };
  tenants: {
    full_name: string;
  };
}

export default function Rent() {
  const [rentDues, setRentDues] = useState<RentDue[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [selectedRentDue, setSelectedRentDue] = useState<RentDue | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("transfer");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (user) fetchRentDues();
  }, [user]);

  const fetchRentDues = async () => {
    try {
      const { data, error } = await supabase
        .from("rent_dues")
        .select(`
          *,
          properties(internal_identifier),
          tenants(full_name)
        `)
        .order("due_date", { ascending: true });

      if (error) throw error;
      setRentDues(data || []);
    } catch (error) {
      console.error("Error fetching rent dues:", error);
      toast({
        title: "Error",
        description: "Something went wrong. Please refresh.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const openPaymentDialog = (rentDue: RentDue) => {
    setSelectedRentDue(rentDue);
    setPaymentAmount(rentDue.balance_due.toString());
    setPaymentDialogOpen(true);
  };

  const handlePayment = async () => {
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

    setIsSubmitting(true);

    try {
      // Create payment record
      const { error: paymentError } = await supabase.from("rent_payments").insert({
        rent_due_id: selectedRentDue.id,
        payment_date: new Date().toISOString().split("T")[0],
        amount: amount,
        method: paymentMethod,
      });

      if (paymentError) throw paymentError;

      // Calculate new balance
      const newBalance = Math.max(0, selectedRentDue.balance_due - amount);
      const newStatus = newBalance === 0 ? "paid" : "partial";

      // Update rent due
      const { error: updateError } = await supabase
        .from("rent_dues")
        .update({
          balance_due: newBalance,
          status: newStatus,
        })
        .eq("id", selectedRentDue.id);

      if (updateError) throw updateError;

      if (newBalance > 0) {
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
      setPaymentAmount("");
      fetchRentDues();
    } catch (error) {
      console.error("Error recording payment:", error);
      toast({
        title: "Error",
        description: "Something went wrong. Please refresh.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredRentDues = rentDues.filter((rd) => {
    const matchesSearch =
      rd.properties.internal_identifier.toLowerCase().includes(search.toLowerCase()) ||
      rd.tenants.full_name.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || rd.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const formatMonth = (periodMonth: string) => {
    const [year, month] = periodMonth.split("-");
    return new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString("en-US", {
      month: "long",
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
      <PageHeader title="Rent" description="Track rent payments and balances" />

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
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="partial">Partial</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="ledger" className="space-y-4">
        <TabsList>
          <TabsTrigger value="ledger">Ledger</TabsTrigger>
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
        </TabsList>

        <TabsContent value="ledger">
          {filteredRentDues.length === 0 ? (
            <EmptyState
              icon={DollarSign}
              title="No rent records"
              description="Rent dues will appear here when contracts are active."
              className="py-12"
            />
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="divide-y">
                  {filteredRentDues.map((rd) => (
                    <div
                      key={rd.id}
                      className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 text-primary">
                          <Building2 className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-medium">
                            {rd.properties.internal_identifier} - {formatMonth(rd.period_month)}
                          </p>
                          <p className="text-sm text-muted-foreground">{rd.tenants.full_name}</p>
                          <p className="text-xs text-muted-foreground">
                            Due: {new Date(rd.due_date).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="font-semibold">{formatCurrency(rd.expected_amount)}</p>
                          {rd.balance_due > 0 && rd.balance_due < rd.expected_amount && (
                            <p className="text-xs text-warning">
                              Due: {formatCurrency(rd.balance_due)}
                            </p>
                          )}
                        </div>
                        <StatusBadge variant={rd.status as any} />
                        {rd.status !== "paid" && (
                          <Button size="sm" onClick={() => openPaymentDialog(rd)}>
                            Record payment
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="calendar">
          <Card>
            <CardHeader>
              <CardTitle>Calendar View</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredRentDues.map((rd) => (
                  <div
                    key={rd.id}
                    className="p-4 rounded-lg border bg-card hover:shadow-medium transition-shadow"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">{formatMonth(rd.period_month)}</span>
                      <StatusBadge variant={rd.status as any} />
                    </div>
                    <p className="text-sm text-muted-foreground mb-1">
                      {rd.properties.internal_identifier}
                    </p>
                    <p className="font-semibold">{formatCurrency(rd.expected_amount)}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Payment Dialog */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
          </DialogHeader>
          {selectedRentDue && (
            <div className="space-y-4 mt-4">
              <div className="p-3 rounded-lg bg-muted">
                <p className="font-medium">{selectedRentDue.properties.internal_identifier}</p>
                <p className="text-sm text-muted-foreground">
                  {formatMonth(selectedRentDue.period_month)} - {selectedRentDue.tenants.full_name}
                </p>
                <p className="text-sm mt-1">
                  Balance due: <span className="font-semibold">{formatCurrency(selectedRentDue.balance_due)}</span>
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="amount">Payment Amount</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Payment Method</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="transfer">Bank Transfer</SelectItem>
                    <SelectItem value="cash">Cash</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button variant="outline" onClick={() => setPaymentDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handlePayment} disabled={isSubmitting}>
                  {isSubmitting ? "Recording..." : "Record payment"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
