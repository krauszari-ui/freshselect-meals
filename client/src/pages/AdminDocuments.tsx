import AdminLayout from "@/components/AdminLayout";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Upload, Loader2, FileText, Download, FolderOpen,
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
  const [showUpload, setShowUpload] = useState(false);
  const [uploadData, setUploadData] = useState({ category: "uncategorized" as string, fileName: "" });
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const docsQuery = trpc.admin.documents.library.useQuery(
    categoryFilter !== "all" ? { category: categoryFilter } : undefined
  );

  const uploadMutation = trpc.admin.documents.upload.useMutation({
    onSuccess: () => {
      utils.admin.documents.library.invalidate();
      setShowUpload(false);
      setUploadData({ category: "uncategorized", fileName: "" });
      toast.success("Document uploaded");
    },
  });

  const docs = (docsQuery.data ?? []) as any[];

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
      <div className="p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Document Library</h1>
            <p className="text-slate-500 text-sm mt-0.5">{docs.length} documents available</p>
          </div>
          <Button className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5 h-9" onClick={() => setShowUpload(true)}>
            <Upload className="h-4 w-4" /> Upload Document
          </Button>
        </div>

        {/* Filter */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-500">Filter by:</span>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[180px] h-9 text-sm bg-white border-slate-200">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Document List */}
        {docsQuery.isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-slate-400" /></div>
        ) : docs.length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            <FolderOpen className="h-12 w-12 mx-auto text-slate-300 mb-3" />
            <p className="text-sm">No documents found</p>
          </div>
        ) : (
          <div className="space-y-2">
            {docs.map((doc: any) => (
              <div key={doc.id} className="bg-white rounded-lg border border-slate-200 p-4 flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <FileText className="h-5 w-5 text-slate-400 mt-0.5 shrink-0" />
                  <div>
                    <a
                      href={doc.fileUrl || doc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline"
                    >
                      {doc.fileName || doc.name}
                    </a>
                    {doc.description && (
                      <p className="text-xs text-slate-500 mt-0.5">{doc.description}</p>
                    )}
                    <div className="flex items-center gap-2 mt-1.5">
                      <Badge className="text-[10px] bg-blue-100 text-blue-700 border-0">
                        {CATEGORY_LABELS[doc.category] || doc.category}
                      </Badge>
                      <span className="text-xs text-slate-400">
                        by {doc.uploaderName || doc.uploadedByEmail || "staff"}
                      </span>
                    </div>
                  </div>
                </div>
                <a
                  href={doc.fileUrl || doc.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Download document"
                >
                  <Download className="h-4 w-4 text-slate-400 hover:text-slate-600" />
                </a>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Upload Document Dialog */}
      <Dialog open={showUpload} onOpenChange={setShowUpload}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Upload Document</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">Category</label>
              <Select value={uploadData.category} onValueChange={(v) => setUploadData({ ...uploadData, category: v })}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">Document Name (optional)</label>
              <Input
                placeholder="Leave blank to use file name"
                value={uploadData.fileName}
                onChange={(e) => setUploadData({ ...uploadData, fileName: e.target.value })}
                className="h-9 text-sm"
              />
            </div>
            <label className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-colors">
              <Upload className="h-8 w-8 text-slate-400 mb-2" />
              <span className="text-sm text-slate-500">Click to select a file</span>
              <span className="text-xs text-slate-400 mt-1">{fileRef.current?.files?.[0]?.name || "No file selected"}</span>
              <input ref={fileRef} type="file" className="hidden" onChange={() => {}} />
            </label>
          </div>
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="outline" onClick={() => setShowUpload(false)}>Cancel</Button>
            <Button
              className="bg-blue-600 hover:bg-blue-700"
              onClick={handleFileUpload}
              disabled={uploading || uploadMutation.isPending}
            >
              {(uploading || uploadMutation.isPending) ? <Loader2 className="h-4 w-4 animate-spin" /> : "Upload"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
