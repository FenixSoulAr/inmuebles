import { useState } from "react";
import { Plus, DollarSign, Trash2, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

interface Valuation {
  id: string;
  valuation_amount: number;
  valuation_date: string;
  notes: string | null;
  created_at: string;
}

interface PropertyValuationsProps {
  propertyId: string;
  valuations: Valuation[];
  onRefresh: () => void;
}

export function PropertyValuations({
  propertyId,
  valuations,
  onRefresh,
}: PropertyValuationsProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      toast({
        title: t("common.error"),
        description: t("propertyDetail.amountRequired"),
        variant: "destructive",
      });
      return;
    }
    if (!date) {
      toast({
        title: t("common.error"),
        description: t("propertyDetail.dateRequired"),
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from("property_valuations").insert({
        property_id: propertyId,
        valuation_amount: numAmount,
        valuation_date: date,
        notes: notes || null,
      });
      if (error) throw error;

      toast({
        title: t("propertyDetail.valuationAdded"),
        description: t("propertyDetail.valuationAddedDesc"),
      });
      setDialogOpen(false);
      setAmount("");
      setDate(new Date().toISOString().split("T")[0]);
      setNotes("");
      onRefresh();
    } catch (error) {
      console.error("Error adding valuation:", error);
      toast({
        title: t("common.error"),
        description: t("common.errorGeneric"),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from("property_valuations")
        .delete()
        .eq("id", id);
      if (error) throw error;
      toast({ title: t("propertyDetail.valuationDeleted") });
      onRefresh();
    } catch (error) {
      console.error("Error deleting valuation:", error);
      toast({
        title: t("common.error"),
        description: t("common.errorGeneric"),
        variant: "destructive",
      });
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{t("propertyDetail.valuations")}</CardTitle>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="w-4 h-4 mr-2" />
              {t("propertyDetail.addValuation")}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("propertyDetail.addValuation")}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>{t("propertyDetail.valuationAmount")}</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("propertyDetail.valuationDate")}</Label>
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("common.notes")}</Label>
                <Textarea
                  placeholder=""
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                >
                  {t("common.cancel")}
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? t("common.adding") : t("common.add")}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {valuations.length === 0 ? (
          <EmptyState
            icon={TrendingUp}
            title={t("propertyDetail.noValuations")}
            description={t("propertyDetail.noValuationsDesc")}
            className="py-8"
          />
        ) : (
          <div className="space-y-3">
            {valuations.map((v) => (
              <div
                key={v.id}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
              >
                <div className="flex items-center gap-3">
                  <DollarSign className="w-5 h-5 text-primary" />
                  <div>
                    <p className="font-semibold">
                      {formatCurrency(v.valuation_amount)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(v.valuation_date).toLocaleDateString()}
                    </p>
                    {v.notes && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {v.notes}
                      </p>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => handleDelete(v.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
