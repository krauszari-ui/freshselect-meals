import AdminLayout from "@/components/AdminLayout";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Upload, Loader2, FileText, Trash2, ExternalLink, RefreshCw, FolderOpen, Search
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";

const CATEGORY_LABELS: Record<string, string> = {
  provider_attestation: "Provider Attestation",
  consent: "Consent Forms",
  supporting_documentation: "Supporting Documentation",
  id_document: "ID Documents",
  medicaid_card: "Medicaid Cards",
  birth_certificate: "Birth Certificates",
  marriage_license: "Marriage Licenses",
  forms: "Forms",
  uncategorized: "Uncategorized",
};

export default function AdminDocuments() {
  const utils = trpc.useUtils();
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [showUpload, setShowUpload] = useState(false);
  const [uploadData, setUploadData] = useState({ category: "uncategorized" as string, fileName: "" });
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  const docsQuery = trpc.admin.documents.library.useQuery(
    categoryFilter !== "all" ? { category: categoryFilter } : undefined
  );

  const deleteMutation = trpc.admin.documents.delete.useMutation({
    onSuccess: () => {
      utils.admin.documents.library.invalidate();
      toast.success("Document deleted");
    },
  });

  const uploadMutation = trpc.admin.documents.upload.useMutation({
    onSuccess: () => {
      utils.admin.documents.library.invalidate();
      setShowUpload(false);
      setUploadData({ category: "other", fileName: "" });
      toast.success("Document uploaded");
    },
  });

  const docs = (docsQuery.data ?? []) as any[];
  const filteredDocs = debouncedSearch
    ? docs.filter((d: any) =>
        d.fileName?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        d.category?.toLowerCase().includes(debouncedSearch.toLowerCase())
      )
    : docs;

  const handleFileUpload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) { toast.error("Please select a file"); return; }
    setUploading(true);
    try {
      const buffer = await file.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), "")
      );
      uploadMutation.mutate({
        name: uploadData.fileName || file.name,
        category: uploadData.category as any,
        fileData: base64,
        contentType: file.type || "application/octet-stream",
        submissionId: null,
      });
    } catch {
      toast.error("Failed to read file");
    } finally {
      setUploading(false);
    }
  };

  return (
    <AdminLayout>
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Document Library</h1>
            <p className="text-slate-500 text-sm mt-1">{filteredDocs.length} documents</p>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => docsQuery.refetch()} className="text-slate-500">
              <RefreshCw className={`h-4 w-4 ${docsQuery.isFetching ? "animate-spin" : ""}`} />
            </Button>
            <Dialog open={showUpload} onOpenChange={setShowUpload}>
              <DialogTrigger asChild>
                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 gap-1.5">
                  <Upload className="h-4 w-4" /> Upload
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Upload Document</DialogTitle>
                </DialogHeader>
                <div className="space-y-3 mt-2">
                  <Input
                    placeholder="Document name (optional)"
                    value={uploadData.fileName}
                    onChange={(e) => setUploadData({ ...uploadData, fileName: e.target.value })}
                  />
                  <Select value={uploadData.category} onValueChange={(v) => setUploadData({ ...uploadData, category: v })}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <input ref={fileRef} type="file" className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100" />
                  <Button
                    className="w-full bg-emerald-600 hover:bg-emerald-700"
                    disabled={uploading || uploadMutation.isPending}
                    onClick={handleFileUpload}
                  >
                    {(uploading || uploadMutation.isPending) ? <Loader2 className="h-4 w-4 animate-spin" /> : "Upload Document"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search documents..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[160px] h-9 text-sm">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Document Grid */}
        {docsQuery.isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-slate-400" /></div>
        ) : filteredDocs.length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            <FolderOpen className="h-12 w-12 mx-auto text-slate-300 mb-3" />
            <p className="text-sm">No documents found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredDocs.map((doc: any) => (
              <Card key={doc.id} className="border-0 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="h-10 w-10 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                        <FileText className="h-5 w-5 text-slate-500" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">{doc.fileName}</p>
                        <Badge className="mt-1 text-[10px] bg-slate-100 text-slate-600">
                          {CATEGORY_LABELS[doc.category] || doc.category}
                        </Badge>
                        <p className="text-xs text-slate-400 mt-1">
                          {new Date(doc.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      {doc.fileUrl && (
                        <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer">
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-400 hover:text-emerald-600">
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Button>
                        </a>
                      )}
                      <Button
                        variant="ghost" size="sm"
                        className="h-8 w-8 p-0 text-slate-400 hover:text-red-600"
                        onClick={() => {
                          if (confirm("Delete this document?")) {
                            deleteMutation.mutate({ id: doc.id });
                          }
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
