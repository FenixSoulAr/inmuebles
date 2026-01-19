import { useEffect, useState, useRef } from "react";
import { DollarSign, Building2, Upload, X, FileText, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/ui/page-header";
import { SearchBar } from "@/components/ui/search-bar";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";

interface RentPayment {
  id: string;
  payment_date: string;
  amount: number;
  method: string;
  receipt_file_url: string | null;
  notes: string | null;
  created_at: string;
}

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
  rent_payments?: RentPayment[];
}

// Compute derived values for a rent due
function computeRentDueStatus(rentDue: RentDue): {
  totalPaid: number;
  balanceDue: number;
  derivedStatus: string;
} {
  const payments = rentDue.rent_payments || [];
  const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const balanceDue = Math.max(rentDue.expected_amount - totalPaid, 0);

  let derivedStatus: string;
  if (totalPaid >= rentDue.expected_amount) {
    derivedStatus = "paid";
  } else if (totalPaid > 0) {
    derivedStatus = "partial";
  } else if (new Date() > new Date(rentDue.due_date)) {
    derivedStatus = "overdue";
  } else {
    derivedStatus = "due";
  }

  return { totalPaid, balanceDue, derivedStatus };
}

export default function Rent() {
  const [rentDues, setRentDues] = useState<RentDue[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentsViewDialogOpen, setPaymentsViewDialogOpen] = useState(false);
  const [selectedRentDue, setSelectedRentDue] = useState<RentDue | null>(null);
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0]);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("transfer");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (user) fetchRentDues();
  }, [user]);

  const fetchRentDues = async () => {
    try {
      // First get properties owned by this user
      const { data: userProperties, error: propError } = await supabase
        .from("properties")
        .select("id")
        .eq("owner_user_id", user!.id);

      if (propError) throw propError;

      if (!userProperties || userProperties.length === 0) {
        setRentDues([]);
        setLoading(false);
        return;
      }

      const propertyIds = userProperties.map((p) => p.id);

      // Fetch rent dues with payments for those properties
      const { data, error } = await supabase
        .from("rent_dues")
        .select(`
          *,
          properties(internal_identifier),
          tenants(full_name),
          rent_payments(*)
        `)
        .in("property_id", propertyIds)
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
    const { balanceDue } = computeRentDueStatus(rentDue);
    setSelectedRentDue(rentDue);
    setPaymentAmount(balanceDue > 0 ? balanceDue.toString() : "");
    setPaymentDate(new Date().toISOString().split("T")[0]);
    setPaymentMethod("transfer");
    setPaymentNotes("");
    setReceiptFile(null);
    setPaymentDialogOpen(true);
  };

  const openPaymentsViewDialog = (rentDue: RentDue) => {
    setSelectedRentDue(rentDue);
    setPaymentsViewDialogOpen(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "Error",
        description: "File is too large. Maximum size is 10MB.",
        variant: "destructive",
      });
      return;
    }

    // Validate file type
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

    if (uploadError) {
      console.error("Upload error:", uploadError);
      throw uploadError;
    }

    const { data: { publicUrl } } = supabase.storage
      .from("documents")
      .getPublicUrl(fileName);

    return publicUrl;
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

    if (!paymentDate) {
      toast({
        title: "Error",
        description: "Payment date is required.",
        variant: "destructive",
      });
      return;
    }

    const { balanceDue } = computeRentDueStatus(selectedRentDue);
    const exceedsBalance = amount > balanceDue;

    setIsSubmitting(true);

    try {
      // Upload receipt if provided
      let receiptUrl: string | null = null;
      if (receiptFile) {
        receiptUrl = await uploadReceipt(selectedRentDue.id);
      }

      // Create payment record (always a NEW row)
      const { error: paymentError } = await supabase.from("rent_payments").insert({
        rent_due_id: selectedRentDue.id,
        payment_date: paymentDate,
        amount: amount,
        method: paymentMethod,
        receipt_file_url: receiptUrl,
        notes: paymentNotes || null,
      });

      if (paymentError) throw paymentError;

      // Calculate new balance and status after this payment
      const currentTotalPaid = (selectedRentDue.rent_payments || []).reduce(
        (sum, p) => sum + Number(p.amount),
        0
      );
      const newTotalPaid = currentTotalPaid + amount;
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

      // Update rent due with new balance and status
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
          description: `Payment saved. Balance still due: ${formatCurrency(newBalance)}`,
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
      setPaymentNotes("");
      setReceiptFile(null);
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
    const { derivedStatus } = computeRentDueStatus(rd);
    const matchesStatus = statusFilter === "all" || derivedStatus === statusFilter;
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
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
            <SelectItem value="due">Due</SelectItem>
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
              title="No rent dues yet"
              description="Create an active contract to generate rent dues."
              className="py-12"
            />
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Property</TableHead>
                        <TableHead>Tenant</TableHead>
                        <TableHead>Period</TableHead>
                        <TableHead>Due Date</TableHead>
                        <TableHead className="text-right">Expected</TableHead>
                        <TableHead className="text-right">Total Paid</TableHead>
                        <TableHead className="text-right">Balance Due</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredRentDues.map((rd) => {
                        const { totalPaid, balanceDue, derivedStatus } = computeRentDueStatus(rd);
                        const paymentCount = rd.rent_payments?.length || 0;
                        return (
                          <TableRow key={rd.id}>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 text-primary">
                                  <Building2 className="w-4 h-4" />
                                </div>
                                <span className="font-medium">
                                  {rd.properties.internal_identifier}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {rd.tenants.full_name}
                            </TableCell>
                            <TableCell>{formatMonth(rd.period_month)}</TableCell>
                            <TableCell>{formatDate(rd.due_date)}</TableCell>
                            <TableCell className="text-right">
                              <span className="font-semibold">
                                {formatCurrency(rd.expected_amount)}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              <span className={totalPaid > 0 ? "font-semibold text-success" : "text-muted-foreground"}>
                                {formatCurrency(totalPaid)}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              <span className={balanceDue > 0 ? "font-semibold text-warning" : "text-muted-foreground"}>
                                {formatCurrency(balanceDue)}
                              </span>
                            </TableCell>
                            <TableCell>
                              <StatusBadge variant={derivedStatus as any} />
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                {paymentCount > 0 && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => openPaymentsViewDialog(rd)}
                                  >
                                    <Eye className="w-4 h-4 mr-1" />
                                    View ({paymentCount})
                                  </Button>
                                )}
                                {derivedStatus !== "paid" && (
                                  <Button size="sm" onClick={() => openPaymentDialog(rd)}>
                                    Record payment
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="calendar">
          {filteredRentDues.length === 0 ? (
            <EmptyState
              icon={DollarSign}
              title="No rent dues yet"
              description="Create an active contract to generate rent dues."
              className="py-12"
            />
          ) : (
            <Card>
              <CardContent className="p-6">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredRentDues.map((rd) => {
                    const { totalPaid, balanceDue, derivedStatus } = computeRentDueStatus(rd);
                    const paymentCount = rd.rent_payments?.length || 0;
                    return (
                      <div
                        key={rd.id}
                        className="p-4 rounded-lg border bg-card hover:shadow-medium transition-shadow"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium">{formatMonth(rd.period_month)}</span>
                          <StatusBadge variant={derivedStatus as any} />
                        </div>
                        <p className="text-sm text-muted-foreground mb-1">
                          {rd.properties.internal_identifier}
                        </p>
                        <p className="text-sm text-muted-foreground mb-2">
                          {rd.tenants.full_name}
                        </p>
                        <div className="space-y-1 mb-3">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Expected:</span>
                            <span className="font-semibold">{formatCurrency(rd.expected_amount)}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Paid:</span>
                            <span className={totalPaid > 0 ? "text-success" : "text-muted-foreground"}>
                              {formatCurrency(totalPaid)}
                            </span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Balance:</span>
                            <span className={balanceDue > 0 ? "text-warning font-semibold" : "text-muted-foreground"}>
                              {formatCurrency(balanceDue)}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {paymentCount > 0 && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1"
                              onClick={() => openPaymentsViewDialog(rd)}
                            >
                              <Eye className="w-4 h-4 mr-1" />
                              View ({paymentCount})
                            </Button>
                          )}
                          {derivedStatus !== "paid" && (
                            <Button
                              size="sm"
                              className="flex-1"
                              onClick={() => openPaymentDialog(rd)}
                            >
                              Record payment
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Payment Dialog */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
            <DialogDescription>
              Enter payment details for this rent due.
            </DialogDescription>
          </DialogHeader>
          {selectedRentDue && (
            <div className="space-y-4 mt-2">
              {/* Rent Due Summary */}
              <div className="p-4 rounded-lg bg-muted/50 border">
                <div className="flex items-start gap-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 text-primary shrink-0">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">
                      {selectedRentDue.properties.internal_identifier}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {formatMonth(selectedRentDue.period_month)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {selectedRentDue.tenants.full_name}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Balance due</p>
                    <p className="font-bold text-lg">
                      {formatCurrency(computeRentDueStatus(selectedRentDue).balanceDue)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Helper text */}
              <p className="text-sm text-muted-foreground bg-muted/30 p-3 rounded-lg">
                You can record multiple payments for the same rent due.
              </p>

              {/* Payment Date */}
              <div className="space-y-2">
                <Label htmlFor="paymentDate">Payment Date</Label>
                <Input
                  id="paymentDate"
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                />
              </div>

              {/* Payment Amount */}
              <div className="space-y-2">
                <Label htmlFor="amount">Amount</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                />
              </div>

              {/* Payment Method */}
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

              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="notes">Notes (optional)</Label>
                <Textarea
                  id="notes"
                  placeholder="Add any notes about this payment..."
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  rows={2}
                />
              </div>

              {/* Receipt Upload */}
              <div className="space-y-2">
                <Label>Receipt (optional)</Label>
                {receiptFile ? (
                  <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
                    <FileText className="w-5 h-5 text-muted-foreground shrink-0" />
                    <span className="text-sm truncate flex-1">{receiptFile.name}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={removeFile}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <div
                    className="flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="w-8 h-8 text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">
                      Click to upload receipt
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      PDF, JPG, PNG up to 10MB
                    </p>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t">
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

      {/* View Payments Dialog */}
      <Dialog open={paymentsViewDialogOpen} onOpenChange={setPaymentsViewDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Payment History</DialogTitle>
            <DialogDescription>
              All payments recorded for this rent due.
            </DialogDescription>
          </DialogHeader>
          {selectedRentDue && (
            <div className="space-y-4 mt-2">
              {/* Rent Due Summary */}
              <div className="p-4 rounded-lg bg-muted/50 border">
                <div className="flex items-start gap-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 text-primary shrink-0">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">
                      {selectedRentDue.properties.internal_identifier}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {formatMonth(selectedRentDue.period_month)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Expected</p>
                    <p className="font-bold">{formatCurrency(selectedRentDue.expected_amount)}</p>
                  </div>
                </div>
              </div>

              {/* Payments List */}
              {selectedRentDue.rent_payments && selectedRentDue.rent_payments.length > 0 ? (
                <div className="space-y-3">
                  {selectedRentDue.rent_payments
                    .sort((a, b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime())
                    .map((payment) => (
                      <div
                        key={payment.id}
                        className="p-4 rounded-lg border bg-card"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <p className="font-semibold">{formatCurrency(payment.amount)}</p>
                            <p className="text-sm text-muted-foreground">
                              {formatDate(payment.payment_date)}
                            </p>
                          </div>
                          <span className="text-xs px-2 py-1 rounded-full bg-muted capitalize">
                            {payment.method}
                          </span>
                        </div>
                        {payment.notes && (
                          <p className="text-sm text-muted-foreground mt-2">
                            {payment.notes}
                          </p>
                        )}
                        {payment.receipt_file_url && (
                          <a
                            href={payment.receipt_file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-sm text-primary hover:underline mt-2"
                          >
                            <FileText className="w-4 h-4" />
                            View receipt
                          </a>
                        )}
                      </div>
                    ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-4">
                  No payments recorded yet.
                </p>
              )}

              {/* Summary */}
              {selectedRentDue.rent_payments && selectedRentDue.rent_payments.length > 0 && (
                <div className="p-4 rounded-lg bg-muted/30 border-t">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Total paid:</span>
                    <span className="font-bold text-success">
                      {formatCurrency(computeRentDueStatus(selectedRentDue).totalPaid)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center mt-1">
                    <span className="text-muted-foreground">Remaining balance:</span>
                    <span className={`font-bold ${computeRentDueStatus(selectedRentDue).balanceDue > 0 ? "text-warning" : ""}`}>
                      {formatCurrency(computeRentDueStatus(selectedRentDue).balanceDue)}
                    </span>
                  </div>
                </div>
              )}

              {/* Close Button */}
              <div className="flex justify-end pt-2">
                <Button variant="outline" onClick={() => setPaymentsViewDialogOpen(false)}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
