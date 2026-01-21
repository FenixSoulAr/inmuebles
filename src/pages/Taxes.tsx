import { useEffect, useState } from "react";
import { Receipt, Building2, MoreHorizontal, Pencil, Upload, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { AddTaxModal } from "@/components/taxes/AddTaxModal";
import { EditTaxModal } from "@/components/taxes/EditTaxModal";
import { UploadTaxReceiptModal } from "@/components/taxes/UploadTaxReceiptModal";

interface TaxObligation {
  id: string;
  type: string;
  frequency: string;
  due_date: string;
  responsible: string;
  status: string;
  amount: number | null;
  notes: string | null;
  receipt_file_url: string | null;
  properties: {
    id: string;
    internal_identifier: string;
    full_address: string;
  };
}

interface PropertyFiscalStatus {
  propertyId: string;
  propertyName: string;
  address: string;
  status: "ok" | "pending";
  obligations: TaxObligation[];
}

const taxTypeLabels: Record<string, string> = {
  municipal: "Municipal Tax",
  property: "Property Tax",
  income: "Income Tax",
  other: "Other Tax",
};

const frequencyLabels: Record<string, string> = {
  "one-time": "One-time",
  monthly: "Monthly",
  bimonthly: "Bimonthly",
  quarterly: "Quarterly",
  annual: "Annual",
};

export default function Taxes() {
  const [fiscalStatuses, setFiscalStatuses] = useState<PropertyFiscalStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  // Edit modal state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedTaxId, setSelectedTaxId] = useState<string | null>(null);
  const [selectedTaxDetails, setSelectedTaxDetails] = useState<{
    property: string;
    taxType: string;
    dueDate: string;
    amount: number | null;
    notes: string | null;
  } | null>(null);

  // Upload modal state
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadTaxDetails, setUploadTaxDetails] = useState<{
    property: string;
    taxType: string;
    dueDate: string;
  } | null>(null);

  useEffect(() => {
    if (user) fetchTaxData();
  }, [user]);

  const fetchTaxData = async () => {
    try {
      const { data: obligations, error } = await supabase
        .from("tax_obligations")
        .select("*, properties(id, internal_identifier, full_address)")
        .order("due_date", { ascending: true });

      if (error) throw error;

      // Group by property
      const propertyMap = new Map<string, PropertyFiscalStatus>();

      obligations?.forEach((ob) => {
        const propertyId = ob.properties.id;
        if (!propertyMap.has(propertyId)) {
          propertyMap.set(propertyId, {
            propertyId,
            propertyName: ob.properties.internal_identifier,
            address: ob.properties.full_address,
            status: "ok",
            obligations: [],
          });
        }
        const entry = propertyMap.get(propertyId)!;
        entry.obligations.push(ob);
        if (ob.status === "pending") {
          entry.status = "pending";
        }
      });

      setFiscalStatuses(Array.from(propertyMap.values()));
    } catch (error) {
      console.error("Error fetching tax data:", error);
      toast({
        title: "Error",
        description: "Something went wrong. Please refresh.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (tax: TaxObligation) => {
    setSelectedTaxId(tax.id);
    setSelectedTaxDetails({
      property: tax.properties.internal_identifier,
      taxType: taxTypeLabels[tax.type] || tax.type,
      dueDate: tax.due_date,
      amount: tax.amount,
      notes: tax.notes,
    });
    setEditModalOpen(true);
  };

  const handleUpload = (tax: TaxObligation) => {
    setSelectedTaxId(tax.id);
    setUploadTaxDetails({
      property: tax.properties.internal_identifier,
      taxType: taxTypeLabels[tax.type] || tax.type,
      dueDate: tax.due_date,
    });
    setUploadModalOpen(true);
  };

  const formatAmount = (amount: number | null) => {
    if (amount === null) return null;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  // State for add modal trigger
  const [addModalOpen, setAddModalOpen] = useState(false);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Taxes" description="Track tax obligations and fiscal status">
        <AddTaxModal onSuccess={fetchTaxData} />
      </PageHeader>

      {fiscalStatuses.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No tax obligations"
          description="No data yet. Add tax obligations to track fiscal status."
          action={{
            label: "Add tax",
            onClick: () => setAddModalOpen(true),
          }}
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {fiscalStatuses.map((property) => (
            <Card key={property.propertyId}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 text-primary">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base">{property.propertyName}</CardTitle>
                    <p className="text-xs text-muted-foreground">{property.address}</p>
                  </div>
                </div>
                <StatusBadge variant={property.status} />
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {property.obligations.map((ob) => (
                    <div
                      key={ob.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{taxTypeLabels[ob.type] || ob.type}</p>
                          {ob.amount !== null && (
                            <span className="text-sm text-muted-foreground">
                              {formatAmount(ob.amount)}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Due: {new Date(ob.due_date).toLocaleDateString()} • {frequencyLabels[ob.frequency] || ob.frequency}
                        </p>
                        {ob.notes && (
                          <p className="text-xs text-muted-foreground mt-1 truncate">
                            {ob.notes}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge variant={ob.status as any} />
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEdit(ob)}>
                              <Pencil className="w-4 h-4 mr-2" />
                              Edit tax record
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleUpload(ob)}>
                              <Upload className="w-4 h-4 mr-2" />
                              Upload receipt
                            </DropdownMenuItem>
                            {ob.receipt_file_url && (
                              <DropdownMenuItem asChild>
                                <a
                                  href={ob.receipt_file_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  <ExternalLink className="w-4 h-4 mr-2" />
                                  View receipt
                                </a>
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Modal */}
      <EditTaxModal
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        taxId={selectedTaxId}
        taxDetails={selectedTaxDetails}
        onSuccess={fetchTaxData}
      />

      {/* Upload Receipt Modal */}
      <UploadTaxReceiptModal
        open={uploadModalOpen}
        onOpenChange={setUploadModalOpen}
        taxId={selectedTaxId}
        taxDetails={uploadTaxDetails}
        onSuccess={fetchTaxData}
      />
    </div>
  );
}
