import { useEffect, useState, useRef } from "react";
import { DollarSign, Building2, Upload, X, FileText } from "lucide-react";
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
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0]);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("transfer");
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
    setPaymentDate(new Date().toISOString().split("T")[0]);
    setPaymentMethod("transfer");
    setReceiptFile(null);
    setPaymentDialogOpen(true);
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

    setIsSubmitting(true);

    try {
      // Upload receipt if provided
      let receiptUrl: string | null = null;
      if (receiptFile) {
        receiptUrl = await uploadReceipt(selectedRentDue.id);
      }

      // Create payment record
      const { error: paymentError } = await supabase.from("rent_payments").insert({
        rent_due_id: selectedRentDue.id,
        payment_date: paymentDate,
        amount: amount,
        method: paymentMethod,
        receipt_file_url: receiptUrl,
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
              description="Rent dues are generated automatically from active contracts."
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
                        <TableHead className="text-right">Expected Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredRentDues.map((rd) => (
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
                            <div>
                              <span className="font-semibold">
                                {formatCurrency(rd.expected_amount)}
                              </span>
                              {rd.balance_due > 0 && rd.balance_due < rd.expected_amount && (
                                <p className="text-xs text-warning">
                                  Due: {formatCurrency(rd.balance_due)}
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <StatusBadge variant={rd.status as any} />
                          </TableCell>
                          <TableCell className="text-right">
                            {rd.status !== "paid" ? (
                              <Button size="sm" onClick={() => openPaymentDialog(rd)}>
                                Record payment
                              </Button>
                            ) : (
                              <span className="text-sm text-muted-foreground">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
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
              description="Rent dues are generated automatically from active contracts."
              className="py-12"
            />
          ) : (
            <Card>
              <CardContent className="p-6">
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
                      <p className="text-sm text-muted-foreground mb-2">
                        {rd.tenants.full_name}
                      </p>
                      <div className="flex items-center justify-between">
                        <span className="font-semibold">{formatCurrency(rd.expected_amount)}</span>
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
                      {formatCurrency(selectedRentDue.balance_due)}
                    </p>
                  </div>
                </div>
              </div>

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
    </div>
  );
}
