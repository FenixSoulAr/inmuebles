import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Building2,
  MapPin,
  ArrowLeft,
  Upload,
  FileText,
  Users,
  Pencil,
  Trash2,
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

const requiredCategories = ["deed", "bylaws"];

export default function PropertyDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [property, setProperty] = useState<Property | null>(null);
  const [documents, setDocuments] = useState<PropertyDocument[]>([]);
  const [stakes, setStakes] = useState<OwnershipStake[]>([]);
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
      const [propertyRes, docsRes, stakesRes] = await Promise.all([
        supabase.from("properties").select("*").eq("id", id).maybeSingle(),
        supabase.from("property_documents").select("*").eq("property_id", id).order("uploaded_at", { ascending: false }),
        supabase.from("ownership_stakes").select("*").eq("property_id", id),
      ]);

      if (propertyRes.error) throw propertyRes.error;
      if (!propertyRes.data) {
        navigate("/properties");
        return;
      }

      setProperty(propertyRes.data);
      setDocuments(docsRes.data || []);
      setStakes(stakesRes.data || []);
    } catch (error) {
      console.error("Error fetching property:", error);
      toast({
        title: "Error",
        description: "Something went wrong. Please refresh.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async () => {
    if (!selectedFile || !property) return;

    // Validate file
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (selectedFile.size > maxSize) {
      toast({
        title: "Error",
        description: "File is too large.",
        variant: "destructive",
      });
      return;
    }

    const allowedTypes = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(selectedFile.type)) {
      toast({
        title: "Error",
        description: "File type not supported.",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);

    try {
      // Generate file name: YYYY-MM-DD__Category__PropertyId
      const date = new Date().toISOString().split("T")[0];
      const ext = selectedFile.name.split(".").pop();
      const generatedName = `${date}__${selectedCategory}__${property.internal_identifier}.${ext}`;

      // Upload to storage
      const filePath = `${property.id}/${generatedName}`;
      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(filePath, selectedFile);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("documents")
        .getPublicUrl(filePath);

      // Save document record
      const { error: dbError } = await supabase.from("property_documents").insert({
        property_id: property.id,
        category: selectedCategory,
        file_url: urlData.publicUrl,
        original_file_name: selectedFile.name,
        generated_name: generatedName,
      });

      if (dbError) throw dbError;

      toast({
        title: "File uploaded.",
        description: "Document has been saved successfully.",
      });

      setUploadDialogOpen(false);
      setSelectedFile(null);
      fetchPropertyData();
    } catch (error) {
      console.error("Upload error:", error);
      toast({
        title: "Error",
        description: "Something went wrong. Please refresh.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const getChecklistStatus = () => {
    const uploadedCategories = documents.map((d) => d.category);
    const hasRequired = requiredCategories.every((cat) =>
      uploadedCategories.includes(cat)
    );
    return hasRequired ? "complete" : "incomplete";
  };

  const propertyTypeLabels: Record<string, string> = {
    apartment: "Apartment",
    house: "House",
    commercial: "Commercial",
    land: "Land",
    other: "Other",
  };

  const categoryLabels: Record<string, string> = {
    deed: "Deed",
    bylaws: "Bylaws",
    plans: "Plans",
    insurance: "Insurance",
    tax: "Tax",
    other: "Other",
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
      <Button
        variant="ghost"
        size="sm"
        className="mb-4"
        onClick={() => navigate("/properties")}
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Properties
      </Button>

      <PageHeader title={property.internal_identifier}>
        <StatusBadge variant={property.status as any} />
      </PageHeader>

      {/* Property Info Card */}
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
                  <p className="text-muted-foreground">
                    {propertyTypeLabels[property.type] || property.type}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2 text-muted-foreground">
                <MapPin className="w-4 h-4 mt-1 shrink-0" />
                <span>{property.full_address}</span>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Document Checklist</p>
                <StatusBadge variant={getChecklistStatus()} className="mt-1" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Created</p>
                <p className="font-medium">
                  {new Date(property.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="documents" className="space-y-4">
        <TabsList>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="ownership">Ownership</TabsTrigger>
        </TabsList>

        <TabsContent value="documents">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Documents</CardTitle>
              <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Upload className="w-4 h-4 mr-2" />
                    Upload file
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Upload Document</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label>Category</Label>
                      <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="deed">Deed</SelectItem>
                          <SelectItem value="bylaws">Bylaws</SelectItem>
                          <SelectItem value="plans">Plans</SelectItem>
                          <SelectItem value="insurance">Insurance</SelectItem>
                          <SelectItem value="tax">Tax</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>File</Label>
                      <Input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png,.webp"
                        onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                      />
                      <p className="text-xs text-muted-foreground">
                        Max 10MB. PDF, JPG, PNG, WebP supported.
                      </p>
                    </div>
                    <div className="flex justify-end gap-3 pt-4">
                      <Button variant="outline" onClick={() => setUploadDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleFileUpload} disabled={!selectedFile || uploading}>
                        {uploading ? "Uploading..." : "Upload file"}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {documents.length === 0 ? (
                <EmptyState
                  icon={FileText}
                  title="No documents"
                  description="Upload your first document to get started."
                  className="py-8"
                />
              ) : (
                <div className="space-y-3">
                  {documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                    >
                      <div className="flex items-center gap-3">
                        <FileText className="w-5 h-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{doc.generated_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {categoryLabels[doc.category]} • {new Date(doc.uploaded_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <Button variant="outline" size="sm" asChild>
                        <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                          View
                        </a>
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ownership">
          <Card>
            <CardHeader>
              <CardTitle>Ownership Stakes</CardTitle>
            </CardHeader>
            <CardContent>
              {stakes.length === 0 ? (
                <EmptyState
                  icon={Users}
                  title="No ownership records"
                  description="Add ownership stakes to track property shares."
                  className="py-8"
                />
              ) : (
                <div className="space-y-3">
                  {stakes.map((stake) => (
                    <div
                      key={stake.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                    >
                      <div>
                        <p className="font-medium">{stake.holder_name}</p>
                        <p className="text-xs text-muted-foreground capitalize">
                          {stake.holder_type}
                        </p>
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
