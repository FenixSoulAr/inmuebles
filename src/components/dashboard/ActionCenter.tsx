import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export interface OverdueRentItem {
  id: string;
  property: string;
  tenant: string;
  dueDate: string;
  balanceDue: number;
  status: string;
}

export interface DueSoonItem {
  id: string;
  property: string;
  tenant: string;
  dueDate: string;
  expectedAmount: number;
}

export interface MissingProofItem {
  id: string;
  property: string;
  utilityType: string;
  period: string;
  status: string;
}

export interface TaxDueItem {
  id: string;
  property: string;
  taxType: string;
  dueDate: string;
  status: string;
}

export interface MaintenanceItem {
  id: string;
  property: string;
  issue: string;
  status: string;
}

interface ActionCenterProps {
  overdueRent: OverdueRentItem[];
  dueSoon: DueSoonItem[];
  missingProofs: MissingProofItem[];
  taxesDueSoon: TaxDueItem[];
  openMaintenance: MaintenanceItem[];
  onRecordPayment: (rentDueId: string) => void;
  onUploadProof?: (proofId: string) => void;
  onUploadTaxReceipt?: (taxId: string) => void;
  onViewMaintenance?: (issueId: string) => void;
}

const MAX_ROWS = 8;

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
};

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
};

export function ActionCenter({
  overdueRent,
  dueSoon,
  missingProofs,
  taxesDueSoon,
  openMaintenance,
  onRecordPayment,
  onUploadProof,
  onUploadTaxReceipt,
  onViewMaintenance,
}: ActionCenterProps) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("overdue");

  const overdueCount = overdueRent.length;
  const dueSoonCount = dueSoon.length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-destructive" />
          Action center
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="px-6">
            <TabsList className="w-full justify-start flex-wrap h-auto gap-1 bg-transparent p-0 mb-4">
              <TabsTrigger
                value="overdue"
                className="data-[state=active]:bg-destructive data-[state=active]:text-destructive-foreground"
              >
                Overdue {overdueCount > 0 && `(${overdueCount})`}
              </TabsTrigger>
              <TabsTrigger value="due-soon">
                Due soon {dueSoonCount > 0 && `(${dueSoonCount})`}
              </TabsTrigger>
              <TabsTrigger value="proofs">
                Missing proofs {missingProofs.length > 0 && `(${missingProofs.length})`}
              </TabsTrigger>
              <TabsTrigger value="taxes">
                Taxes {taxesDueSoon.length > 0 && `(${taxesDueSoon.length})`}
              </TabsTrigger>
              <TabsTrigger value="maintenance">
                Maintenance {openMaintenance.length > 0 && `(${openMaintenance.length})`}
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="overflow-x-auto">
            {/* Overdue Rent Tab */}
            <TabsContent value="overdue" className="m-0">
              {overdueRent.length === 0 ? (
                <div className="p-6 pt-0">
                  <EmptyState
                    icon={CheckCircle2}
                    title="No overdue rent"
                    description="You're all set."
                    className="py-8"
                  />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="whitespace-nowrap">Property</TableHead>
                      <TableHead className="whitespace-nowrap">Tenant</TableHead>
                      <TableHead className="whitespace-nowrap">Due date</TableHead>
                      <TableHead className="text-right whitespace-nowrap">Balance due</TableHead>
                      <TableHead className="whitespace-nowrap">Status</TableHead>
                      <TableHead className="text-right whitespace-nowrap">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {overdueRent.slice(0, MAX_ROWS).map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.property}</TableCell>
                        <TableCell className="text-muted-foreground">{item.tenant}</TableCell>
                        <TableCell>{formatDate(item.dueDate)}</TableCell>
                        <TableCell className="text-right font-semibold text-destructive">
                          {formatCurrency(item.balanceDue)}
                        </TableCell>
                        <TableCell>
                          <StatusBadge variant={item.status as any} />
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" onClick={() => onRecordPayment(item.id)}>
                            Record payment
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>

            {/* Due Soon Tab */}
            <TabsContent value="due-soon" className="m-0">
              {dueSoon.length === 0 ? (
                <div className="p-6 pt-0">
                  <EmptyState
                    icon={CheckCircle2}
                    title="Nothing due soon"
                    description="No rent due in the next 7 days."
                    className="py-8"
                  />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="whitespace-nowrap">Property</TableHead>
                      <TableHead className="whitespace-nowrap">Tenant</TableHead>
                      <TableHead className="whitespace-nowrap">Due date</TableHead>
                      <TableHead className="text-right whitespace-nowrap">Expected</TableHead>
                      <TableHead className="text-right whitespace-nowrap">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dueSoon.slice(0, MAX_ROWS).map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.property}</TableCell>
                        <TableCell className="text-muted-foreground">{item.tenant}</TableCell>
                        <TableCell>{formatDate(item.dueDate)}</TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatCurrency(item.expectedAmount)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="outline" onClick={() => onRecordPayment(item.id)}>
                            Record payment
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>

            {/* Missing Proofs Tab */}
            <TabsContent value="proofs" className="m-0">
              {missingProofs.length === 0 ? (
                <div className="p-6 pt-0">
                  <EmptyState
                    icon={CheckCircle2}
                    title="No missing proofs"
                    description="All utility proofs are submitted."
                    className="py-8"
                  />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="whitespace-nowrap">Property</TableHead>
                      <TableHead className="whitespace-nowrap">Utility</TableHead>
                      <TableHead className="whitespace-nowrap">Period</TableHead>
                      <TableHead className="whitespace-nowrap">Status</TableHead>
                      <TableHead className="text-right whitespace-nowrap">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {missingProofs.slice(0, MAX_ROWS).map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.property}</TableCell>
                        <TableCell>{item.utilityType}</TableCell>
                        <TableCell>{item.period}</TableCell>
                        <TableCell>
                          <StatusBadge variant={item.status as any} />
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            onClick={() => onUploadProof?.(item.id)}
                          >
                            Upload proof
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>

            {/* Taxes Tab */}
            <TabsContent value="taxes" className="m-0">
              {taxesDueSoon.length === 0 ? (
                <div className="p-6 pt-0">
                  <EmptyState
                    icon={CheckCircle2}
                    title="No taxes due soon"
                    description="No tax obligations due in the next 30 days."
                    className="py-8"
                  />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="whitespace-nowrap">Property</TableHead>
                      <TableHead className="whitespace-nowrap">Tax type</TableHead>
                      <TableHead className="whitespace-nowrap">Due date</TableHead>
                      <TableHead className="whitespace-nowrap">Status</TableHead>
                      <TableHead className="text-right whitespace-nowrap">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {taxesDueSoon.slice(0, MAX_ROWS).map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.property}</TableCell>
                        <TableCell>{item.taxType}</TableCell>
                        <TableCell>{formatDate(item.dueDate)}</TableCell>
                        <TableCell>
                          <StatusBadge variant={item.status as any} />
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            onClick={() => onUploadTaxReceipt?.(item.id)}
                          >
                            Upload receipt
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>

            {/* Maintenance Tab */}
            <TabsContent value="maintenance" className="m-0">
              {openMaintenance.length === 0 ? (
                <div className="p-6 pt-0">
                  <EmptyState
                    icon={CheckCircle2}
                    title="No open issues"
                    description="All maintenance issues are resolved."
                    className="py-8"
                  />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="whitespace-nowrap">Property</TableHead>
                      <TableHead className="whitespace-nowrap">Issue</TableHead>
                      <TableHead className="whitespace-nowrap">Status</TableHead>
                      <TableHead className="text-right whitespace-nowrap">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {openMaintenance.slice(0, MAX_ROWS).map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.property}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{item.issue}</TableCell>
                        <TableCell>
                          <StatusBadge variant={item.status as any} />
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => navigate("/maintenance")}
                          >
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>
          </div>
        </Tabs>
      </CardContent>
    </Card>
  );
}
