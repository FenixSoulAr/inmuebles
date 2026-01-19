import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Building2, MapPin, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/ui/page-header";
import { SearchBar } from "@/components/ui/search-bar";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

interface Property {
  id: string;
  type: string;
  full_address: string;
  internal_identifier: string;
  status: string;
  created_at: string;
}

const propertySchema = z.object({
  type: z.string().min(1, "Property type is required."),
  full_address: z.string().min(1, "Address is required."),
  internal_identifier: z.string().min(1, "Internal ID is required."),
  status: z.string().min(1, "Status is required."),
});

type PropertyFormData = z.infer<typeof propertySchema>;

export default function Properties() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<PropertyFormData>({
    resolver: zodResolver(propertySchema),
    defaultValues: {
      type: "apartment",
      status: "vacant",
    },
  });

  useEffect(() => {
    if (user) fetchProperties();
  }, [user]);

  const fetchProperties = async () => {
    try {
      const { data, error } = await supabase
        .from("properties")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setProperties(data || []);
    } catch (error) {
      console.error("Error fetching properties:", error);
      toast({
        title: "Error",
        description: "Something went wrong. Please refresh.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data: PropertyFormData) => {
    if (!user) return;
    setIsSubmitting(true);

    try {
      const { error } = await supabase.from("properties").insert({
        owner_user_id: user.id,
        type: data.type,
        full_address: data.full_address,
        internal_identifier: data.internal_identifier,
        status: data.status,
      });

      if (error) throw error;

      toast({
        title: "Property added",
        description: "Your property has been created successfully.",
      });
      setDialogOpen(false);
      reset();
      fetchProperties();
    } catch (error) {
      console.error("Error creating property:", error);
      toast({
        title: "Error",
        description: "Something went wrong. Please refresh.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredProperties = properties.filter((property) => {
    const matchesSearch =
      property.full_address.toLowerCase().includes(search.toLowerCase()) ||
      property.internal_identifier.toLowerCase().includes(search.toLowerCase());
    const matchesStatus =
      statusFilter === "all" || property.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const propertyTypeLabels: Record<string, string> = {
    apartment: "Apartment",
    house: "House",
    commercial: "Commercial",
    land: "Land",
    other: "Other",
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
      <PageHeader title="Properties" description="Manage your property portfolio">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add property
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Property</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Property Type</Label>
                <Select
                  defaultValue="apartment"
                  onValueChange={(value) => setValue("type", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="apartment">Apartment</SelectItem>
                    <SelectItem value="house">House</SelectItem>
                    <SelectItem value="commercial">Commercial</SelectItem>
                    <SelectItem value="land">Land</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
                {errors.type && (
                  <p className="text-sm text-destructive">{errors.type.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="full_address">Full Address</Label>
                <Input
                  id="full_address"
                  placeholder="123 Main St, City, Country"
                  {...register("full_address")}
                />
                {errors.full_address && (
                  <p className="text-sm text-destructive">{errors.full_address.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="internal_identifier">Internal Identifier</Label>
                <Input
                  id="internal_identifier"
                  placeholder="APT-001"
                  {...register("internal_identifier")}
                />
                {errors.internal_identifier && (
                  <p className="text-sm text-destructive">{errors.internal_identifier.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  defaultValue="vacant"
                  onValueChange={(value) => setValue("status", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="vacant">Vacant</SelectItem>
                    <SelectItem value="occupied">Occupied</SelectItem>
                    <SelectItem value="under_repair">Under Repair</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Adding..." : "Add property"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </PageHeader>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Search by address or ID..."
          className="flex-1 max-w-md"
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="vacant">Vacant</SelectItem>
            <SelectItem value="occupied">Occupied</SelectItem>
            <SelectItem value="under_repair">Under Repair</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Properties Grid */}
      {filteredProperties.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No properties yet"
          description="No data yet. Add your first property to get started."
          action={{
            label: "Add property",
            onClick: () => setDialogOpen(true),
          }}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredProperties.map((property) => (
            <Card
              key={property.id}
              className="group hover:shadow-medium transition-shadow cursor-pointer"
              onClick={() => navigate(`/properties/${property.id}`)}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 text-primary">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-semibold">{property.internal_identifier}</p>
                      <p className="text-xs text-muted-foreground">
                        {propertyTypeLabels[property.type] || property.type}
                      </p>
                    </div>
                  </div>
                  <StatusBadge variant={property.status as any} />
                </div>
                <div className="flex items-start gap-2 text-sm text-muted-foreground">
                  <MapPin className="w-4 h-4 mt-0.5 shrink-0" />
                  <span className="line-clamp-2">{property.full_address}</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full mt-4 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Eye className="w-4 h-4 mr-2" />
                  View details
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
