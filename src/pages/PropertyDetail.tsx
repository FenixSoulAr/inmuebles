import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Building2,
  MapPin,
  ArrowLeft,
  Upload,
  FileText,
  Users,
  Zap,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { AddUtilityModal } from "@/components/utilities/AddUtilityModal";
import { PropertyValuations } from "@/components/properties/PropertyValuations";
import { PropertyOwners } from "@/components/properties/PropertyOwners";

interface Property {
  id: string;
  type: string;
  full_address: string;
  internal_identifier: string;
  status: string;
  created_at: string;
}

interface PropertyDocument {
  id: string;
  category: string;
  file_url: string;
  original_file_name: string;
  generated_name: string;
  uploaded_at: string;
}

interface OwnershipStake {
  id: string;
  holder_type: string;
  holder_name: string;
  share_percent: number;
}

interface UtilityObligation {
  id: string;
  type: string;
  payer: string;
  frequency: string;
  due_day_of_month: number | null;
  active: boolean;
}

interface Valuation {
  id: string;
  valuation_amount: number;
  valuation_date: string;
  notes: string | null;
  created_at: string;
}

const requiredCategories = ["deed", "bylaws"];

export default function PropertyDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useTranslation();

  const [property, setProperty] = useState<Property | null>(null);
  const [documents, setDocuments] = useState<PropertyDocument[]>([]);
  const [stakes, setStakes] = useState<OwnershipStake[]>([]);
  const [utilities, setUtilities] = useState<UtilityObligation[]>([]);
  const [valuations, setValuations] = useState<Valuation[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("deed");

  useEffect(() => {
    if (id) fetchPropertyData();
  }, [id]);

  const fetchPropertyData = async () => {
    try {
      const [propertyRes, docsRes, stakesRes, utilitiesRes, valuationsRes] = await Promise.all([
        supabase.from("properties").select("*").eq("id", id).maybeSingle(),
        supabase.from("property_documents").select("*").eq("property_id", id).order("uploaded_at", { ascending: false }),
        supabase.from("ownership_stakes").select("*").eq("property_id", id),
        supabase.from("utility_obligations").select("*").eq("property_id", id).eq("active", true),
        supabase.from("property_valuations").select("*").eq("property_id", id).order("valuation_date", { ascending: false }),
      ]);

      if (propertyRes.error) throw propertyRes.error;
      if (!propertyRes.data) {
        navigate("/properties");
        return;
      }

      setProperty(propertyRes.data);
      setDocuments(docsRes.data || []);
      setStakes(stakesRes.data || []);
      setUtilities(utilitiesRes.data || []);
      setValuations(valuationsRes.data || []);
    } catch (error) {
      console.error("Error fetching property:", error);
      toast({
        title: t("common.error"),
        description: t("common.errorGeneric"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async () => {
    if (!selectedFile || !property) return;

    const maxSize = 10 * 1024 * 1024;
    if (selectedFile.size > maxSize) {
      toast({ title: t("common.error"), description: t("propertyDetail.fileTooLarge"), variant: "destructive" });
      return;
    }

    const allowedTypes = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(selectedFile.type)) {
      toast({ title: t("common.error"), description: t("propertyDetail.fileTypeNotSupported"), variant: "destructive" });
      return;
    }

    setUploading(true);
    try {
      const date = new Date().toISOString().split("T")[0];
      const ext = selectedFile.name.split(".").pop();
      const generatedName = `${date}__${selectedCategory}__${property.internal_identifier}.${ext}`;
      const filePath = `${property.id}/${generatedName}`;

      const { error: uploadError } = await supabase.storage.from("documents").upload(filePath, selectedFile);
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("documents").getPublicUrl(filePath);

      const { error: dbError } = await supabase.from("property_documents").insert({
        property_id: property.id,
        category: selectedCategory,
        file_url: urlData.publicUrl,
        original_file_name: selectedFile.name,
        generated_name: generatedName,
      });
      if (dbError) throw dbError;

      toast({ title: t("propertyDetail.fileUploaded"), description: t("propertyDetail.fileUploadedDesc") });
      setUploadDialogOpen(false);
      setSelectedFile(null);
      fetchPropertyData();
    } catch (error) {
      console.error("Upload error:", error);
      toast({ title: t("common.error"), description: t("common.errorGeneric"), variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const getChecklistStatus = () => {
    const uploadedCategories = documents.map((d) => d.category);
    return requiredCategories.every((cat) => uploadedCategories.includes(cat)) ? "complete" : "incomplete";
  };

  const propertyTypeLabels: Record<string, string> = {
    apartment: t("properties.apartment"),
    house: t("properties.house"),
    commercial: t("properties.commercial"),
    land: t("properties.land"),
    other: t("properties.other"),
  };

  const categoryLabels: Record<string, string> = {
    deed: t("propertyDetail.deed"),
    bylaws: t("propertyDetail.bylaws"),
    plans: t("propertyDetail.plans"),
    insurance: t("propertyDetail.insurance"),
    tax: t("propertyDetail.taxDoc"),
    other: t("propertyDetail.otherDoc"),
  };

  const utilityTypeLabels: Record<string, string> = {
    electricity: t("utilities.electricity"),
    gas: t("utilities.gas"),
    water: t("utilities.water"),
    hoa: t("utilities.hoa"),
    insurance: t("utilities.insuranceUtility"),
  };

  const frequencyLabels: Record<string, string> = {
    monthly: t("frequency.monthly"),
    bimonthly: t("frequency.bimonthly"),
    quarterly: t("frequency.quarterly"),
    annual: t("frequency.annual"),
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!property) return null;

  return (
    <div>
      <Button variant="ghost" size="sm" className="mb-4" onClick={() => navigate("/properties")}>
        <ArrowLeft className="w-4 h-4 mr-2" />
        {t("properties.backToProperties")}
      </Button>

      <PageHeader title={property.internal_identifier}>
        <StatusBadge variant={property.status as any} />
      </PageHeader>

      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-primary/10 text-primary">
                  <Building2 className="w-6 h-6" />
                </div>
                <div>
                  <p className="font-semibold text-lg">{property.internal_identifier}</p>
                  <p className="text-muted-foreground">{propertyTypeLabels[property.type] || property.type}</p>
                </div>
              </div>
              <div className="flex items-start gap-2 text-muted-foreground">
                <MapPin className="w-4 h-4 mt-1 shrink-0" />
                <span>{property.full_address}</span>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">{t("properties.documentChecklist")}</p>
                <StatusBadge variant={getChecklistStatus()} className="mt-1" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t("properties.created")}</p>
                <p className="font-medium">{new Date(property.created_at).toLocaleDateString()}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="documents" className="space-y-4">
        <TabsList>
          <TabsTrigger value="documents">{t("propertyDetail.documents")}</TabsTrigger>
          <TabsTrigger value="valuations">{t("propertyDetail.valuations")}</TabsTrigger>
          <TabsTrigger value="utilities">{t("propertyDetail.utilities")}</TabsTrigger>
          <TabsTrigger value="owners">Propietarios</TabsTrigger>
          <TabsTrigger value="ownership">{t("propertyDetail.ownership")}</TabsTrigger>
        </TabsList>

        <TabsContent value="documents">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>{t("propertyDetail.documents")}</CardTitle>
              <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Upload className="w-4 h-4 mr-2" />
                    {t("propertyDetail.uploadFile")}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t("propertyDetail.uploadDocument")}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label>{t("propertyDetail.category")}</Label>
                      <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(categoryLabels).map(([key, label]) => (
                            <SelectItem key={key} value={key}>{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>{t("propertyDetail.file")}</Label>
                      <Input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} />
                      <p className="text-xs text-muted-foreground">{t("propertyDetail.fileMaxSize")}</p>
                    </div>
                    <div className="flex justify-end gap-3 pt-4">
                      <Button variant="outline" onClick={() => setUploadDialogOpen(false)}>{t("common.cancel")}</Button>
                      <Button onClick={handleFileUpload} disabled={!selectedFile || uploading}>
                        {uploading ? t("common.uploading") : t("propertyDetail.uploadFile")}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {documents.length === 0 ? (
                <EmptyState icon={FileText} title={t("propertyDetail.noDocuments")} description={t("propertyDetail.noDocumentsDesc")} className="py-8" />
              ) : (
                <div className="space-y-3">
                  {documents.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-3">
                        <FileText className="w-5 h-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{doc.generated_name}</p>
                          <p className="text-xs text-muted-foreground">{categoryLabels[doc.category]} • {new Date(doc.uploaded_at).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <Button variant="outline" size="sm" asChild>
                        <a href={doc.file_url} target="_blank" rel="noopener noreferrer">{t("common.view")}</a>
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="valuations">
          <PropertyValuations propertyId={property.id} valuations={valuations} onRefresh={fetchPropertyData} />
        </TabsContent>

        <TabsContent value="utilities">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>{t("propertyDetail.utilities")}</CardTitle>
              <AddUtilityModal preselectedPropertyId={property.id} onSuccess={fetchPropertyData} triggerButton={
                <Button size="sm"><Zap className="w-4 h-4 mr-2" />{t("propertyDetail.addUtility")}</Button>
              } />
            </CardHeader>
            <CardContent>
              {utilities.length === 0 ? (
                <EmptyState icon={Zap} title={t("propertyDetail.noUtilities")} description={t("propertyDetail.noUtilitiesDesc")} className="py-8" />
              ) : (
                <div className="space-y-3">
                  {utilities.map((utility) => (
                    <div key={utility.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div>
                        <p className="font-medium">{utilityTypeLabels[utility.type] || utility.type}</p>
                        <p className="text-xs text-muted-foreground capitalize">
                          {utility.payer} • {frequencyLabels[utility.frequency] || utility.frequency}
                          {utility.due_day_of_month && ` • ${t("utilityServices.dueDay")} ${utility.due_day_of_month}`}
                        </p>
                      </div>
                      <StatusBadge variant={utility.active ? "active" : "ended"} />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="owners">
          <PropertyOwners propertyId={property.id} />
        </TabsContent>

        <TabsContent value="ownership">
          <Card>
            <CardHeader><CardTitle>{t("propertyDetail.ownershipStakes")}</CardTitle></CardHeader>
            <CardContent>
              {stakes.length === 0 ? (
                <EmptyState icon={Users} title={t("propertyDetail.noOwnership")} description={t("propertyDetail.noOwnershipDesc")} className="py-8" />
              ) : (
                <div className="space-y-3">
                  {stakes.map((stake) => (
                    <div key={stake.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div>
                        <p className="font-medium">{stake.holder_name}</p>
                        <p className="text-xs text-muted-foreground capitalize">{stake.holder_type}</p>
                      </div>
                      <span className="font-semibold">{stake.share_percent}%</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
