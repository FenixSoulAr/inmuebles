import { useEffect, useState, useRef } from "react";
import { useTranslation } from "react-i18next";
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
  obligation_status?: string; // from obligations table
}

// Compute derived values for a rent due
// Uses obligation_status as source of truth when available
function computeRentDueStatus(rentDue: RentDue): {
  totalPaid: number;
  balanceDue: number;
  derivedStatus: string;
} {
  const payments = rentDue.rent_payments || [];
  const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const balanceDue = Math.max(rentDue.expected_amount - totalPaid, 0);

  // Use obligation status as source of truth
  if (rentDue.obligation_status) {
    const oblStatus = rentDue.obligation_status;
    if (oblStatus === "confirmed") return { totalPaid, balanceDue: 0, derivedStatus: "paid" };
    if (oblStatus === "awaiting_review") return { totalPaid, balanceDue, derivedStatus: "awaiting_review" };
    if (oblStatus === "rejected") return { totalPaid, balanceDue, derivedStatus: "overdue" };
  }

  // Fallback for obligations without status
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
  const { t, i18n } = useTranslation();
  const isEs = i18n.language?.startsWith("es");
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

      // Get active, non-expired contracts to filter rent_dues
      const today = new Date().toISOString().split("T")[0];
      const { data: activeContracts, error: contractError } = await supabase
        .from("contracts")
        .select("id, end_date")
        .in("property_id", propertyIds)
        .eq("is_active", true)
        .gte("end_date", today);

      if (contractError) throw contractError;

      if (!activeContracts || activeContracts.length === 0) {
        setRentDues([]);
        setLoading(false);
        return;
      }

      const activeContractIds = activeContracts.map((c) => c.id);

      // Current period for limiting future noise
      const now = new Date();
      const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

      const { data, error } = await supabase
        .from("rent_dues")
        .select(`
          *,
          properties(internal_identifier),
          tenants(full_name),
          rent_payments(*)
        `)
        .in("property_id", propertyIds)
        .in("contract_id", activeContractIds)
        .lte("period_month", currentPeriod)
        .order("due_date", { ascending: true });

      if (error) throw error;

      // Fetch obligation statuses for these rent_dues
      const oblContractIds = [...new Set((data || []).map((rd: any) => rd.contract_id))];
      const oblPeriods = [...new Set((data || []).map((rd: any) => rd.period_month))];
      
      let oblMap = new Map<string, string>();
      if (oblContractIds.length > 0) {
        const { data: oblData } = await supabase
          .from("obligations")
          .select("contract_id, period, status")
          .in("contract_id", oblContractIds)
          .in("period", oblPeriods)
          .eq("kind", "rent");
        
        if (oblData) {
          for (const o of oblData) {
            oblMap.set(`${o.contract_id}|${o.period}`, o.status);
          }
        }
      }

      // Additional client-side filter: exclude periods beyond contract endDate
      // Then sort by period_month asc, property name asc
      const contractEndMap = new Map(activeContracts.map((c) => [c.id, c.end_date]));
      const filtered = (data || []).filter((rd: any) => {
        const endDate = contractEndMap.get(rd.contract_id);
        if (!endDate) return false;
        const endPeriod = endDate.substring(0, 7);
        return rd.period_month <= endPeriod;
      }).map((rd: any) => ({
        ...rd,
        obligation_status: oblMap.get(`${rd.contract_id}|${rd.period_month}`) || null,
      }));

      filtered.sort((a: any, b: any) => {
        const periodCmp = a.period_month.localeCompare(b.period_month);
        if (periodCmp !== 0) return periodCmp;
        return (a.properties?.internal_identifier || "").localeCompare(b.properties?.internal_identifier || "");
      });

      setRentDues(filtered);
    } catch (error) {
      console.error("Error fetching rent dues:", error);
      toast({
        title: t("common.error"),
        description: t("common.errorGeneric"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const openPaymentDialog = (rentDue: RentDue) => {
    const { balanceDue } = computeRentDueStatus(rentDue);
    
    if (balanceDue === 0) {
      toast({
        title: t("rent.alreadyPaid"),
        description: t("rent.alreadyPaidDesc"),
        variant: "destructive",
      });
      return;
    }
    
    setSelectedRentDue(rentDue);
    setPaymentAmount(balanceDue.toString());
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

    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: t("common.error"),
        description: t("rent.fileTooLarge"),
        variant: "destructive",
      });
      return;
    }

    const allowedTypes = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: t("common.error"),
        description: t("rent.fileNotSupported"),
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
        title: t("common.error"),
        description: t("rent.validAmount"),
        variant: "destructive",
      });
      return;
    }

    if (!paymentDate) {
      toast({
        title: t("common.error"),
        description: t("rent.dateRequired"),
        variant: "destructive",
      });
      return;
    }

    const { balanceDue } = computeRentDueStatus(selectedRentDue);
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

      const { error: updateError } = await supabase
        .from("rent_dues")
        .update({
          balance_due: newBalance,
          status: newStatus,
        })
        .eq("id", selectedRentDue.id);

      if (updateError) throw updateError;

      // Sync obligation status - set to awaiting_review (pending confirmation)
      {
        const { data: matchingObl } = await supabase
          .from("obligations")
          .select("id, payment_proof_id")
          .eq("contract_id", selectedRentDue.contract_id)
          .eq("period", selectedRentDue.period_month)
          .eq("kind", "rent")
          .maybeSingle();

        if (matchingObl) {
          await supabase
            .from("obligations")
            .update({ status: "awaiting_review" })
            .eq("id", matchingObl.id);
        }
      }

      if (exceedsBalance) {
        toast({
          title: t("rent.paymentSaved"),
          description: t("rent.exceedsBalance"),
        });
      } else if (newBalance > 0) {
        toast({
          title: t("rent.paymentSaved"),
          description: t("rent.balanceStillDue", { amount: formatCurrency(newBalance) }),
        });
      } else {
        toast({
          title: t("rent.paymentComplete"),
          description: t("rent.rentFullyPaid"),
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
        title: t("common.error"),
        description: t("rent.couldNotSave"),
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
    return new Intl.NumberFormat(isEs ? "es-AR" : "en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const formatMonth = (periodMonth: string) => {
    const [year, month] = periodMonth.split("-");
    return new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString(
      isEs ? "es-AR" : "en-US",
      { month: "long", year: "numeric" }
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(isEs ? "es-AR" : "en-US", {
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
      <PageHeader title={t("rent.title")} description={t("rent.description")} />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder={t("rent.searchPlaceholder")}
          className="flex-1 max-w-md"
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder={t("common.status")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("common.allStatus")}</SelectItem>
            <SelectItem value="paid">{t("rent.paid")}</SelectItem>
            <SelectItem value="awaiting_review">{t("obligations.pendingConfirmation")}</SelectItem>
            <SelectItem value="partial">{t("rent.partial")}</SelectItem>
            <SelectItem value="overdue">{t("rent.overdue")}</SelectItem>
            <SelectItem value="due">{t("rent.due")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="ledger" className="space-y-4">
        <TabsList>
          <TabsTrigger value="ledger">{t("rent.ledger")}</TabsTrigger>
          <TabsTrigger value="calendar">{t("rent.calendar")}</TabsTrigger>
        </TabsList>

        <TabsContent value="ledger">
          {filteredRentDues.length === 0 ? (
            <EmptyState
              icon={DollarSign}
              title={t("rent.noRentDues")}
              description={t("rent.noRentDuesDesc")}
              className="py-12"
            />
          ) : (
            <Card className="overflow-hidden">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table className="min-w-[900px]">
                    <TableHeader className="sticky top-0 bg-card z-10">
                      <TableRow>
                        <TableHead className="whitespace-nowrap">{t("rent.property")}</TableHead>
                        <TableHead className="whitespace-nowrap">{t("rent.tenant")}</TableHead>
                        <TableHead className="whitespace-nowrap">{t("rent.period")}</TableHead>
                        <TableHead className="whitespace-nowrap">{t("rent.dueDate")}</TableHead>
                        <TableHead className="text-right whitespace-nowrap">{t("rent.expected")}</TableHead>
                        <TableHead className="text-right whitespace-nowrap">{t("rent.totalPaid")}</TableHead>
                        <TableHead className="text-right whitespace-nowrap">{t("rent.balanceDue")}</TableHead>
                        <TableHead className="whitespace-nowrap">{t("common.status")}</TableHead>
                        <TableHead className="text-right whitespace-nowrap">{t("common.actions")}</TableHead>
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
                                    {t("rent.viewPayments", { count: paymentCount })}
                                  </Button>
                                )}
                                {derivedStatus !== "paid" && (
                                  <Button size="sm" onClick={() => openPaymentDialog(rd)}>
                                    {t("rent.recordPayment")}
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
          <Card>
            <CardContent className="py-12">
              <EmptyState
                icon={DollarSign}
                title={t("rent.calendarSoon")}
                description={t("rent.calendarDesc")}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Record Payment Dialog */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b flex-shrink-0">
            <DialogTitle>{t("rent.recordPaymentTitle")}</DialogTitle>
            <DialogDescription>
              {selectedRentDue && (
                <>
                  {selectedRentDue.properties.internal_identifier} – {formatMonth(selectedRentDue.period_month)}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto px-6 py-4">
            <div className="space-y-6">
              <p className="text-sm text-muted-foreground">
                {t("rent.multiplePaymentsHint")}
              </p>

              <div className="space-y-2">
                <Label htmlFor="paymentDate">{t("rent.paymentDate")}</Label>
                <Input
                  id="paymentDate"
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="paymentAmount">{t("rent.amount")}</Label>
                <Input
                  id="paymentAmount"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                />
                {selectedRentDue && (
                  <p className="text-sm text-muted-foreground">
                    {t("rent.balanceDue")}: {formatCurrency(computeRentDueStatus(selectedRentDue).balanceDue)}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="paymentMethod">{t("rent.method")}</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger id="paymentMethod">
                    <SelectValue placeholder={t("rent.selectMethod")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="transfer">{t("rent.transfer")}</SelectItem>
                    <SelectItem value="cash">{t("rent.cash")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="paymentNotes">{t("rent.notesOptional")}</Label>
                <Textarea
                  id="paymentNotes"
                  placeholder={t("rent.addNotes")}
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label>{t("rent.receiptOptional")}</Label>
                <p className="text-sm text-muted-foreground mb-2">
                  {t("rent.uploadPdf")}
                </p>
                {receiptFile ? (
                  <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                    <FileText className="w-5 h-5 text-muted-foreground" />
                    <span className="flex-1 text-sm truncate">{receiptFile.name}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={removeFile}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <div
                    className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      {t("rent.clickUpload")}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t("rent.maxSize")}
                    </p>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept=".pdf,.jpg,.jpeg,.png,.webp"
                  onChange={handleFileChange}
                />
              </div>
            </div>
          </div>

          <DialogFooter className="px-6 py-4 border-t flex-shrink-0">
            <Button
              variant="outline"
              onClick={() => setPaymentDialogOpen(false)}
              disabled={isSubmitting}
            >
              {t("common.cancel")}
            </Button>
            <Button onClick={handlePayment} disabled={isSubmitting}>
              {isSubmitting ? t("common.saving") : t("rent.savePayment")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Payments Dialog */}
      <Dialog open={paymentsViewDialogOpen} onOpenChange={setPaymentsViewDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b flex-shrink-0">
            <DialogTitle>{t("rent.paymentsHistory")}</DialogTitle>
            <DialogDescription>
              {selectedRentDue && (
                <>
                  {selectedRentDue.properties.internal_identifier} – {formatMonth(selectedRentDue.period_month)}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {selectedRentDue && (
              <div className="space-y-4">
                <div className="space-y-3">
                  {(selectedRentDue.rent_payments || []).length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      {t("rent.noPayments")}
                    </p>
                  ) : (
                    (selectedRentDue.rent_payments || [])
                      .sort((a, b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime())
                      .map((payment) => (
                        <div
                          key={payment.id}
                          className="p-4 border rounded-lg space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-semibold">{formatCurrency(payment.amount)}</span>
                            <span className="text-sm text-muted-foreground">
                              {formatDate(payment.payment_date)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span className="capitalize">
                              {payment.method === "transfer" ? t("rent.transfer") : 
                               payment.method === "cash" ? t("rent.cash") : 
                               payment.method === "check" ? t("rent.check") : payment.method}
                            </span>
                            {payment.receipt_file_url && (
                              <>
                                <span>•</span>
                                <a
                                  href={payment.receipt_file_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-primary hover:underline flex items-center gap-1"
                                >
                                  <FileText className="w-3 h-3" />
                                  {t("rent.receipt")}
                                </a>
                              </>
                            )}
                          </div>
                          {payment.notes && (
                            <p className="text-sm text-muted-foreground mt-2">
                              {payment.notes}
                            </p>
                          )}
                        </div>
                      ))
                  )}
                </div>

                <div className="grid grid-cols-3 gap-4 p-4 bg-muted rounded-lg border-t">
                  <div>
                    <p className="text-sm text-muted-foreground">{t("rent.expected")}</p>
                    <p className="font-semibold">{formatCurrency(selectedRentDue.expected_amount)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{t("rent.totalPaid")}</p>
                    <p className="font-semibold text-success">
                      {formatCurrency(computeRentDueStatus(selectedRentDue).totalPaid)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{t("rent.balanceDue")}</p>
                    <p className={`font-semibold ${computeRentDueStatus(selectedRentDue).balanceDue > 0 ? 'text-warning' : 'text-muted-foreground'}`}>
                      {formatCurrency(computeRentDueStatus(selectedRentDue).balanceDue)}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="px-6 py-4 border-t flex-shrink-0">
            <Button
              variant="outline"
              onClick={() => setPaymentsViewDialogOpen(false)}
            >
              {t("common.close")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}