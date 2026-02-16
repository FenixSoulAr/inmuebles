import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Building2, MapPin, Eye } from "lucide-react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/ui/page-header";
import { SearchBar } from "@/components/ui/search-bar";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { EditPropertyModal } from "@/components/properties/EditPropertyModal";
import { PropertyActionMenu } from "@/components/properties/PropertyActionMenu";
import { Badge } from "@/components/ui/badge";

interface Property {
  id: string;
  type: string;
  full_address: string;
  internal_identifier: string;
  status: string;
  active: boolean;
  created_at: string;
}

export default function Properties() {
  const { t } = useTranslation();

  const propertySchema = z.object({
    type: z.string().min(1, t("properties.typeRequired")),
    full_address: z.string().min(1, t("properties.addressRequired")),
    internal_identifier: z.string().min(1, t("properties.idRequired")),
    status: z.string().min(1, t("properties.statusRequired")),
  });

  type PropertyFormData = z.infer<typeof propertySchema>;

  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [activeFilter, setActiveFilter] = useState<string>("active");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const {
    register, handleSubmit, reset, setValue, formState: { errors },
  } = useForm<PropertyFormData>({
    resolver: zodResolver(propertySchema),
    defaultValues: { type: "apartment", status: "vacant" },
  });

  useEffect(() => {
    if (user) fetchProperties();
  }, [user]);

  const fetchProperties = async () => {
    try {
      const { data, error } = await supabase
        .from("properties").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      setProperties(data || []);
    } catch (error) {
      console.error("Error fetching properties:", error);
      toast({ title: t("common.error"), description: t("common.errorGeneric"), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data: PropertyFormData) => {
    if (!user) return;
    setIsSubmitting(true);
    try {
      const { error } = await supabase.from("properties").insert({
        owner_user_id: user.id, type: data.type, full_address: data.full_address,
        internal_identifier: data.internal_identifier, status: data.status,
      });
      if (error) throw error;
      toast({ title: t("properties.propertyAdded"), description: t("properties.propertyAddedDesc") });
      setDialogOpen(false);
      reset();
      fetchProperties();
    } catch (error) {
      console.error("Error creating property:", error);
      toast({ title: t("common.error"), description: t("common.errorGeneric"), variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (property: Property) => {
    setSelectedProperty(property);
    setEditModalOpen(true);
  };

  const filteredProperties = properties.filter((property) => {
    const matchesSearch =
      property.full_address.toLowerCase().includes(search.toLowerCase()) ||
      property.internal_identifier.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || property.status === statusFilter;
    const matchesActive =
      activeFilter === "all" ||
      (activeFilter === "active" && property.active !== false) ||
      (activeFilter === "inactive" && property.active === false);
    return matchesSearch && matchesStatus && matchesActive;
  });

  const propertyTypeLabels: Record<string, string> = {
    apartment: t("properties.apartment"), house: t("properties.house"),
    commercial: t("properties.commercial"), land: t("properties.land"), other: t("properties.other"),
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
      <PageHeader title={t("properties.title")} description={t("properties.description")}>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />{t("properties.addProperty")}</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{t("properties.addNewProperty")}</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>{t("properties.propertyType")}</Label>
                <Select defaultValue="apartment" onValueChange={(value) => setValue("type", value)}>
                  <SelectTrigger><SelectValue placeholder={t("properties.selectType")} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="apartment">{t("properties.apartment")}</SelectItem>
                    <SelectItem value="house">{t("properties.house")}</SelectItem>
                    <SelectItem value="commercial">{t("properties.commercial")}</SelectItem>
                    <SelectItem value="land">{t("properties.land")}</SelectItem>
                    <SelectItem value="other">{t("properties.other")}</SelectItem>
                  </SelectContent>
                </Select>
                {errors.type && <p className="text-sm text-destructive">{errors.type.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="full_address">{t("properties.fullAddress")}</Label>
                <Input id="full_address" placeholder={t("properties.addressPlaceholder")} {...register("full_address")} />
                {errors.full_address && <p className="text-sm text-destructive">{errors.full_address.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="internal_identifier">{t("properties.internalId")}</Label>
                <Input id="internal_identifier" placeholder={t("properties.idPlaceholder")} {...register("internal_identifier")} />
                {errors.internal_identifier && <p className="text-sm text-destructive">{errors.internal_identifier.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>{t("common.status")}</Label>
                <Select defaultValue="vacant" onValueChange={(value) => setValue("status", value)}>
                  <SelectTrigger><SelectValue placeholder={t("properties.selectStatus")} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="vacant">{t("properties.vacant")}</SelectItem>
                    <SelectItem value="occupied">{t("properties.occupied")}</SelectItem>
                    <SelectItem value="under_repair">{t("properties.underRepair")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>{t("common.cancel")}</Button>
                <Button type="submit" disabled={isSubmitting}>{isSubmitting ? t("common.adding") : t("properties.addProperty")}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </PageHeader>

      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <SearchBar value={search} onChange={setSearch} placeholder={t("properties.searchPlaceholder")} className="flex-1 max-w-md" />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder={t("common.status")} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("common.allStatus")}</SelectItem>
            <SelectItem value="vacant">{t("properties.vacant")}</SelectItem>
            <SelectItem value="occupied">{t("properties.occupied")}</SelectItem>
            <SelectItem value="under_repair">{t("properties.underRepair")}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={activeFilter} onValueChange={setActiveFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder={t("common.active")} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("common.all")}</SelectItem>
            <SelectItem value="active">{t("common.active")}</SelectItem>
            <SelectItem value="inactive">{t("common.inactive")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filteredProperties.length === 0 ? (
        <EmptyState icon={Building2} title={t("properties.noProperties")} description={t("properties.noPropertiesDesc")}
          action={{ label: t("properties.addProperty"), onClick: () => setDialogOpen(true) }} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredProperties.map((property) => (
            <Card key={property.id} className={`group hover:shadow-medium transition-shadow cursor-pointer ${property.active === false ? "opacity-60" : ""}`}
              onClick={() => navigate(`/properties/${property.id}`)}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 text-primary"><Building2 className="w-5 h-5" /></div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold">{property.internal_identifier}</p>
                        {property.active === false && <Badge variant="secondary" className="text-xs">{t("common.inactive")}</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground">{propertyTypeLabels[property.type] || property.type}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge variant={property.status as any} />
                    <PropertyActionMenu property={property} onEdit={() => handleEdit(property)} onRefresh={fetchProperties} />
                  </div>
                </div>
                <div className="flex items-start gap-2 text-sm text-muted-foreground">
                  <MapPin className="w-4 h-4 mt-0.5 shrink-0" /><span className="line-clamp-2">{property.full_address}</span>
                </div>
                <Button variant="ghost" size="sm" className="w-full mt-4 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Eye className="w-4 h-4 mr-2" />{t("common.viewDetails")}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <EditPropertyModal property={selectedProperty} open={editModalOpen} onOpenChange={setEditModalOpen} onSuccess={fetchProperties} />
    </div>
  );
}
