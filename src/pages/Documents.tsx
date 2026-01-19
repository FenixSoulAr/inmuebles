import { useEffect, useState } from "react";
import { FolderOpen, FileText, Download, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/ui/page-header";
import { SearchBar } from "@/components/ui/search-bar";
import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

interface PropertyDocument {
  id: string;
  category: string;
  file_url: string;
  original_file_name: string;
  generated_name: string;
  uploaded_at: string;
  properties: {
    internal_identifier: string;
    full_address: string;
  };
}

const categoryLabels: Record<string, string> = {
  deed: "Deed",
  bylaws: "Bylaws",
  plans: "Plans",
  insurance: "Insurance",
  tax: "Tax",
  other: "Other",
};

export default function Documents() {
  const [documents, setDocuments] = useState<PropertyDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (user) fetchDocuments();
  }, [user]);

  const fetchDocuments = async () => {
    try {
      const { data, error } = await supabase
        .from("property_documents")
        .select("*, properties(internal_identifier, full_address)")
        .order("uploaded_at", { ascending: false });

      if (error) throw error;
      setDocuments(data || []);
    } catch (error) {
      console.error("Error fetching documents:", error);
      toast({
        title: "Error",
        description: "Something went wrong. Please refresh.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredDocuments = documents.filter((doc) => {
    const matchesSearch =
      doc.generated_name.toLowerCase().includes(search.toLowerCase()) ||
      doc.properties.internal_identifier.toLowerCase().includes(search.toLowerCase()) ||
      doc.original_file_name.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = categoryFilter === "all" || doc.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Documents" description="All property documents in one place" />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Search documents..."
          className="flex-1 max-w-md"
        />
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="deed">Deed</SelectItem>
            <SelectItem value="bylaws">Bylaws</SelectItem>
            <SelectItem value="plans">Plans</SelectItem>
            <SelectItem value="insurance">Insurance</SelectItem>
            <SelectItem value="tax">Tax</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Documents List */}
      {filteredDocuments.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title="No documents yet"
          description="No data yet. Add your first property to get started."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredDocuments.map((doc) => (
            <Card key={doc.id} className="hover:shadow-medium transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start gap-4">
                  <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-primary/10 text-primary shrink-0">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{doc.generated_name}</p>
                    <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                      <Building2 className="w-3 h-3" />
                      <span className="truncate">{doc.properties.internal_identifier}</span>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                        {categoryLabels[doc.category] || doc.category}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(doc.uploaded_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full mt-4"
                  asChild
                >
                  <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                    <Download className="w-4 h-4 mr-2" />
                    Download
                  </a>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
