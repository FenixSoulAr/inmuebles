import { useEffect, useState } from "react";
import { FolderOpen, FileText, Download, Building2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/ui/page-header";
import { SearchBar } from "@/components/ui/search-bar";
import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

interface PropertyDocument {
  id: string; category: string; file_url: string; original_file_name: string;
  generated_name: string; uploaded_at: string;
  properties: { internal_identifier: string; full_address: string };
}

export default function Documents() {
  const { t } = useTranslation();

  const categoryLabels: Record<string, string> = {
    deed: t("propertyDetail.deed"), bylaws: t("propertyDetail.bylaws"), plans: t("propertyDetail.plans"),
    insurance: t("propertyDetail.insurance"), tax: t("propertyDetail.taxDoc"), other: t("propertyDetail.otherDoc"),
  };

  const [documents, setDocuments] = useState<PropertyDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => { if (user) fetchDocuments(); }, [user]);

  const fetchDocuments = async () => {
    try {
      const { data, error } = await supabase.from("property_documents")
        .select("*, properties(internal_identifier, full_address)").order("uploaded_at", { ascending: false });
      if (error) throw error;
      setDocuments(data || []);
    } catch (error) {
      console.error("Error fetching documents:", error);
      toast({ title: t("common.error"), description: t("common.errorGeneric"), variant: "destructive" });
    } finally { setLoading(false); }
  };

  const filteredDocuments = documents.filter((doc) => {
    const matchesSearch = doc.generated_name.toLowerCase().includes(search.toLowerCase()) ||
      doc.properties.internal_identifier.toLowerCase().includes(search.toLowerCase()) ||
      doc.original_file_name.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = categoryFilter === "all" || doc.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  if (loading) {
    return (<div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>);
  }

  return (
    <div>
      <PageHeader title={t("documents.title")} description={t("documents.description")} />

      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <SearchBar value={search} onChange={setSearch} placeholder={t("documents.searchPlaceholder")} className="flex-1 max-w-md" />
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder={t("propertyDetail.category")} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("documents.allCategories")}</SelectItem>
            <SelectItem value="deed">{t("propertyDetail.deed")}</SelectItem>
            <SelectItem value="bylaws">{t("propertyDetail.bylaws")}</SelectItem>
            <SelectItem value="plans">{t("propertyDetail.plans")}</SelectItem>
            <SelectItem value="insurance">{t("propertyDetail.insurance")}</SelectItem>
            <SelectItem value="tax">{t("propertyDetail.taxDoc")}</SelectItem>
            <SelectItem value="other">{t("propertyDetail.otherDoc")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filteredDocuments.length === 0 ? (
        <EmptyState icon={FolderOpen} title={t("documents.noDocuments")} description={t("documents.noDocumentsDesc")} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredDocuments.map((doc) => (
            <Card key={doc.id} className="hover:shadow-medium transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start gap-4">
                  <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-primary/10 text-primary shrink-0"><FileText className="w-6 h-6" /></div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{doc.generated_name}</p>
                    <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                      <Building2 className="w-3 h-3" /><span className="truncate">{doc.properties.internal_identifier}</span>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">{categoryLabels[doc.category] || doc.category}</span>
                      <span className="text-xs text-muted-foreground">{new Date(doc.uploaded_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
                <Button variant="outline" size="sm" className="w-full mt-4" asChild>
                  <a href={doc.file_url} target="_blank" rel="noopener noreferrer"><Download className="w-4 h-4 mr-2" />{t("common.download")}</a>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
