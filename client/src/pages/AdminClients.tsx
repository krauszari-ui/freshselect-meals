import AdminLayout from "@/components/AdminLayout";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Search, Loader2, Plus, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, X, Download, FileSpreadsheet, FileText, Trash2,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import * as XLSX from "xlsx";
import { useEffect, useState, useMemo, useRef } from "react";
import { Link, useSearch } from "wouter";
import { toast } from "sonner";

const STAGE_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  referral: { label: "Referral", bg: "bg-emerald-100", text: "text-emerald-700" },
  assessment: { label: "Assessment", bg: "bg-blue-100", text: "text-blue-700" },
  level_one_only: { label: "Level One Only", bg: "bg-violet-100", text: "text-violet-700" },
  level_one_household: { label: "Level One (household)", bg: "bg-purple-100", text: "text-purple-700" },
  level_2_active: { label: "Level 2 Active", bg: "bg-teal-100", text: "text-teal-700" },
  ineligible: { label: "Ineligible For SCN", bg: "bg-red-100", text: "text-red-700" },
  provider_attestation_required: { label: "Provider Attestation Required", bg: "bg-orange-100", text: "text-orange-700" },
  flagged: { label: "Flagged", bg: "bg-rose-100", text: "text-rose-700" },
};

const AVATAR_COLORS = [
  "bg-emerald-500", "bg-blue-500", "bg-purple-500", "bg-orange-500",
  "bg-pink-500", "bg-teal-500", "bg-indigo-500", "bg-amber-500",
];

function getAvatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitials(firstName: string, lastName: string) {
  return `${(firstName || "")[0] || ""}${(lastName || "")[0] || ""}`.toUpperCase();
}

/* ─── Add Client Dialog ──────────────────────────────────────────────── */

interface AddClientForm {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  medicaidId: string;
  cellPhone: string;
  email: string;
  streetAddress: string;
  city: string;
  state: string;
  zipcode: string;
  language: string;
  neighborhood: string;
  supermarket: string;
}

const NEIGHBORHOODS_LIST = [
  { name: "Williamsburg", vendors: ["Foodoo Kosher", "Rosemary Kosher", "Chestnut", "Central Market"] },
  { name: "Borough Park", vendors: ["KRM", "Certo Market", "Breadberry"] },
  { name: "Flatbush", vendors: ["Pomegranate", "Moisha's Discount"] },
  { name: "Monsey", vendors: ["Evergreen", "Hatzlacha"] },
  { name: "Monroe", vendors: ["Refresh", "Landau's"] },
];

const INITIAL_ADD_FORM: AddClientForm = {
  firstName: "", lastName: "", dateOfBirth: "", medicaidId: "",
  cellPhone: "", email: "", streetAddress: "", city: "Brooklyn",
  state: "NY", zipcode: "", language: "English", neighborhood: "Williamsburg", supermarket: "Foodoo Kosher",
};

function AddClientDialog({
  open, onClose, onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState<AddClientForm>({ ...INITIAL_ADD_FORM });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const submitMutation = trpc.submission.submit.useMutation({
    onSuccess: () => {
      toast.success("Client added successfully");
      setForm({ ...INITIAL_ADD_FORM });
      setErrors({});
      onSuccess();
      onClose();
    },
    onError: (err) => {
      toast.error(err.message || "Failed to add client");
    },
  });

  const update = (key: keyof AddClientForm, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => { const n = { ...prev }; delete n[key]; return n; });
  };

  const handleSubmit = () => {
    const e: Record<string, string> = {};
    if (!form.firstName.trim()) e.firstName = "Required";
    if (!form.lastName.trim()) e.lastName = "Required";
    if (!form.dateOfBirth) e.dateOfBirth = "Required";
    if (!form.medicaidId.trim()) e.medicaidId = "Required";
    else if (!/^[A-Za-z]{2}\d{5}[A-Za-z]$/.test(form.medicaidId))
      e.medicaidId = "Format: 2 letters, 5 digits, 1 letter";
    if (!form.cellPhone.trim()) e.cellPhone = "Required";
    if (!form.email.trim()) e.email = "Required";
    if (!form.streetAddress.trim()) e.streetAddress = "Required";
    if (!form.zipcode.trim()) e.zipcode = "Required";

    if (Object.keys(e).length > 0) { setErrors(e); return; }

    submitMutation.mutate({
      ...form,
      neighborhood: form.neighborhood,
      homePhone: "",
      aptUnit: "",
      healthCategories: ["Chronic Condition"],
      employed: "No",
      spouseEmployed: "No",
      hasWic: "No",
      hasSnap: "No",
      newApplicant: "Yes",
      householdMembers: [{ name: "N/A", dateOfBirth: "2000-01-01", medicaidId: "AA00000A" }],
      mealFocus: ["Lunch"],
      needsRefrigerator: "No",
      needsMicrowave: "No",
      needsCookingUtensils: "No",
      hipaaConsent: true,
      guardianName: `${form.firstName} ${form.lastName}`,
      signatureDataUrl: "admin-added",
      screeningQuestions: {},
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Client</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-slate-600">First Name *</Label>
              <Input value={form.firstName} onChange={(e) => update("firstName", e.target.value)}
                className={errors.firstName ? "border-red-400" : ""} placeholder="First Name" />
              {errors.firstName && <p className="text-red-500 text-xs mt-0.5">{errors.firstName}</p>}
            </div>
            <div>
              <Label className="text-xs text-slate-600">Last Name *</Label>
              <Input value={form.lastName} onChange={(e) => update("lastName", e.target.value)}
                className={errors.lastName ? "border-red-400" : ""} placeholder="Last Name" />
              {errors.lastName && <p className="text-red-500 text-xs mt-0.5">{errors.lastName}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-slate-600">Date of Birth *</Label>
              <Input type="date" value={form.dateOfBirth} onChange={(e) => update("dateOfBirth", e.target.value)}
                className={errors.dateOfBirth ? "border-red-400" : ""} />
              {errors.dateOfBirth && <p className="text-red-500 text-xs mt-0.5">{errors.dateOfBirth}</p>}
            </div>
            <div>
              <Label className="text-xs text-slate-600">Medicaid ID (CIN) *</Label>
              <Input value={form.medicaidId} onChange={(e) => update("medicaidId", e.target.value.toUpperCase())}
                className={errors.medicaidId ? "border-red-400" : ""} placeholder="AB12345C" maxLength={8} />
              {errors.medicaidId && <p className="text-red-500 text-xs mt-0.5">{errors.medicaidId}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-slate-600">Cell Phone *</Label>
              <Input value={form.cellPhone} onChange={(e) => update("cellPhone", e.target.value)}
                className={errors.cellPhone ? "border-red-400" : ""} placeholder="(718) 555-0123" />
              {errors.cellPhone && <p className="text-red-500 text-xs mt-0.5">{errors.cellPhone}</p>}
            </div>
            <div>
              <Label className="text-xs text-slate-600">Email *</Label>
              <Input type="email" value={form.email} onChange={(e) => update("email", e.target.value)}
                className={errors.email ? "border-red-400" : ""} placeholder="email@example.com" />
              {errors.email && <p className="text-red-500 text-xs mt-0.5">{errors.email}</p>}
            </div>
          </div>

          <div>
            <Label className="text-xs text-slate-600">Street Address *</Label>
            <Input value={form.streetAddress} onChange={(e) => update("streetAddress", e.target.value)}
              className={errors.streetAddress ? "border-red-400" : ""} placeholder="123 Main Street" />
            {errors.streetAddress && <p className="text-red-500 text-xs mt-0.5">{errors.streetAddress}</p>}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs text-slate-600">City</Label>
              <Input value={form.city} onChange={(e) => update("city", e.target.value)} />
            </div>
            <div>
              <Label className="text-xs text-slate-600">State</Label>
              <Input value={form.state} onChange={(e) => update("state", e.target.value)} />
            </div>
            <div>
              <Label className="text-xs text-slate-600">Zipcode *</Label>
              <Input value={form.zipcode} onChange={(e) => update("zipcode", e.target.value)}
                className={errors.zipcode ? "border-red-400" : ""} placeholder="11219" />
              {errors.zipcode && <p className="text-red-500 text-xs mt-0.5">{errors.zipcode}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-slate-600">Language</Label>
              <Select value={form.language} onValueChange={(v) => update("language", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["English", "Spanish", "Yiddish", "Hebrew", "Russian", "Chinese", "Arabic"].map((l) => (
                    <SelectItem key={l} value={l}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-slate-600">Neighborhood</Label>
              <Select value={form.neighborhood} onValueChange={(v) => { update("neighborhood", v); const hood = NEIGHBORHOODS_LIST.find(n => n.name === v); if (hood) update("supermarket", hood.vendors[0]); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {NEIGHBORHOODS_LIST.map((n) => (
                    <SelectItem key={n.name} value={n.name}>{n.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-slate-600">Vendor</Label>
              <Select value={form.supermarket} onValueChange={(v) => update("supermarket", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(NEIGHBORHOODS_LIST.find(n => n.name === form.neighborhood)?.vendors || []).map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            disabled={submitMutation.isPending}
            className="bg-green-700 hover:bg-green-800 text-white"
          >
            {submitMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
            Add Client
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Export Dropdown ─────────────────────────────────────────────────── */

function ExportDropdown({ filters }: { filters?: Record<string, string | number | boolean | undefined> }) {
  const [open, setOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const exportMutation = trpc.admin.exportCsv.useMutation();

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const triggerDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportCsv = async () => {
    setExporting(true);
    setOpen(false);
    try {
      const result = await exportMutation.mutateAsync(filters as any || {});
      const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8;" });
      const date = new Date().toISOString().slice(0, 10);
      triggerDownload(blob, `freshselect-clients-${date}.csv`);
      toast.success(`Exported ${result.count} clients to CSV`);
    } catch {
      toast.error("Failed to export clients");
    } finally {
      setExporting(false);
    }
  };

  const handleExportExcel = async () => {
    setExporting(true);
    setOpen(false);
    try {
      const result = await exportMutation.mutateAsync(filters as any || {});
      const wsData = [result.headers, ...result.data];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      // Auto-size columns
      const colWidths = result.headers.map((h: string, i: number) => {
        let maxLen = h.length;
        result.data.forEach((row: string[]) => {
          if (row[i] && row[i].length > maxLen) maxLen = row[i].length;
        });
        return { wch: Math.min(maxLen + 2, 50) };
      });
      ws["!cols"] = colWidths;
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Clients");
      const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      const blob = new Blob([wbout], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const date = new Date().toISOString().slice(0, 10);
      triggerDownload(blob, `freshselect-clients-${date}.xlsx`);
      toast.success(`Exported ${result.count} clients to Excel`);
    } catch {
      toast.error("Failed to export clients");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        variant="outline"
        onClick={() => setOpen(!open)}
        disabled={exporting}
        className="gap-1.5 h-9 px-4 text-sm border-slate-300 text-slate-700 hover:bg-slate-50"
      >
        {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        Export
        <ChevronDown className="h-3 w-3 ml-0.5" />
      </Button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-50">
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <FileSpreadsheet className="h-4 w-4 text-green-600" />
            Export to Excel
          </button>
          <button
            onClick={handleExportCsv}
            className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <FileText className="h-4 w-4 text-blue-600" />
            Export to CSV
          </button>
        </div>
      )}
    </div>
  );
}

/* ─── Main Component ──────────────────────────────────────────────────── */

export default function AdminClients() {
  const { user } = useAuth();
  const isAssessor = user?.role === "assessor";
  const searchParams = useSearch();
  const urlParams = new URLSearchParams(searchParams);
  const initialStage = urlParams.get("stage") || "all";

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [stageFilter, setStageFilter] = useState(initialStage);
  const [languageFilter, setLanguageFilter] = useState("all");
  const [boroughFilter, setBoroughFilter] = useState("all");
  const [neighborhoodFilter, setNeighborhoodFilter] = useState("all");
  const [vendorFilter, setVendorFilter] = useState("all");
  const [programFilter, setProgramFilter] = useState("all");
  const [workerFilter, setWorkerFilter] = useState("all");
  const [repFilter, setRepFilter] = useState("all");
  const [referralFilter, setReferralFilter] = useState("all");
  const [assessmentCompletedFilter, setAssessmentCompletedFilter] = useState("all"); // "all" | "completed" | "not_completed"
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");
  const [page, setPage] = useState(1);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [search]);

  const utils = trpc.useUtils();

  // "assessment_completed" is a virtual stage filter — handled client-side
  const effectiveStageFilter = stageFilter === "assessment_completed" ? undefined : stageFilter;

  const listQuery = trpc.admin.list.useQuery({
    search: debouncedSearch || undefined,
    stage: effectiveStageFilter !== "all" ? effectiveStageFilter : undefined,
    language: languageFilter !== "all" ? languageFilter : undefined,
    borough: boroughFilter !== "all" ? boroughFilter : undefined,
    assignedTo: workerFilter !== "all" ? parseInt(workerFilter) : undefined,
    intakeRep: repFilter !== "all" ? parseInt(repFilter) : undefined,
    referralSource: referralFilter !== "all" ? referralFilter : undefined,
    // Assessors always see only assessment-completed clients (locked at DB level)
    assessmentCompleted: isAssessor ? true : undefined,
    page,
    pageSize: 25,
  });

  const staffQuery = trpc.admin.staffList.useQuery();
  const referralLinksQuery = trpc.admin.referrals.list.useQuery();
  const referralLinks = (referralLinksQuery.data ?? []) as any[];

  const bulkDeleteMutation = trpc.admin.bulkDeleteClients.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.deleted} client${data.deleted === 1 ? '' : 's'} deleted`);
      setSelectedIds(new Set());
      utils.admin.list.invalidate();
    },
    onError: () => toast.error("Failed to delete selected clients"),
  });

  const listData = listQuery.data as any;
  const rows = listData?.rows ?? [];
  const totalPages = listData?.totalPages ?? 1;
  const totalCount = listData?.total ?? 0;

  const sortedRows = useMemo(() => {
    if (!rows.length) return rows;
    return [...rows].sort((a: any, b: any) => {
      const da = new Date(a.createdAt).getTime();
      const db = new Date(b.createdAt).getTime();
      return sortDir === "desc" ? db - da : da - db;
    });
  }, [rows, sortDir]);

  const filteredRows = useMemo(() => {
    let result = sortedRows;
    if (programFilter !== "all") result = result.filter((r: any) => r.program === programFilter);
    if (neighborhoodFilter !== "all") result = result.filter((r: any) => {
      const fd = (r.formData as any) || {};
      return fd.neighborhood === neighborhoodFilter;
    });
    if (vendorFilter !== "all") result = result.filter((r: any) => r.supermarket === vendorFilter);
    // Virtual filter: Assessment Completed
    if (stageFilter === "assessment_completed") result = result.filter((r: any) => r.assessmentCompletedAt != null);
    if (assessmentCompletedFilter === "completed") result = result.filter((r: any) => r.assessmentCompletedAt != null);
    if (assessmentCompletedFilter === "not_completed") result = result.filter((r: any) => r.assessmentCompletedAt == null);
    return result;
  }, [sortedRows, programFilter, neighborhoodFilter, vendorFilter, stageFilter, assessmentCompletedFilter]);

  const staffList = (staffQuery.data ?? []) as any[];

  const getWorkerName = (id: number | null) => {
    if (!id) return "Unassigned";
    const w = staffList.find((s: any) => s.id === id);
    return w?.name || "Unknown";
  };

  return (
    <AdminLayout>
      <div className="p-6 space-y-5">
        {/* Assessor locked-view banner */}
        {isAssessor && (
          <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-lg">
            <span className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Assessment Completed</span>
            <span className="text-xs text-amber-600">— You are viewing clients whose assessment has been completed and are ready for review.</span>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Clients</h1>
            <p className="text-slate-500 text-sm mt-0.5">{totalCount} total clients</p>
          </div>
          <div className="flex items-center gap-2">
            <ExportDropdown filters={{
              stage: (stageFilter !== "all" && stageFilter !== "assessment_completed") ? stageFilter : undefined,
              supermarket: vendorFilter !== "all" ? vendorFilter : undefined,
              neighborhood: neighborhoodFilter !== "all" ? neighborhoodFilter : undefined,
              language: languageFilter !== "all" ? languageFilter : undefined,
              borough: boroughFilter !== "all" ? boroughFilter : undefined,
              search: debouncedSearch || undefined,
              assignedTo: workerFilter !== "all" ? parseInt(workerFilter) : undefined,
              intakeRep: repFilter !== "all" ? parseInt(repFilter) : undefined,
              referralSource: referralFilter !== "all" ? referralFilter : undefined,
              program: programFilter !== "all" ? programFilter : undefined,
              assessmentCompleted: isAssessor ? true : stageFilter === "assessment_completed" ? true : assessmentCompletedFilter === "completed" ? true : assessmentCompletedFilter === "not_completed" ? false : undefined,
            }} />
            {!isAssessor && (
              <Button
                onClick={() => setShowAddDialog(true)}
                className="bg-green-700 hover:bg-green-800 text-white gap-1.5 h-9 px-4 text-sm"
              >
                <Plus className="h-4 w-4" />
                Add Client
              </Button>
            )}
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search by name or CIN..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-10 text-sm bg-white border-slate-200"
          />
        </div>

        {/* Filter Row — hidden for assessors (their view is locked to assessment-completed) */}
        {!isAssessor && (<div className="flex flex-wrap gap-2">
          <Select value={stageFilter} onValueChange={(v) => { setStageFilter(v); setPage(1); }}>
            <SelectTrigger className="w-[180px] h-9 text-sm bg-white border-slate-200">
              <SelectValue placeholder="Stage" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Stages</SelectItem>
              {Object.entries(STAGE_CONFIG).map(([key, { label }]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
              <SelectItem value="assessment_completed">Assessment Completed</SelectItem>
            </SelectContent>
          </Select>

          <Select value={languageFilter} onValueChange={(v) => { setLanguageFilter(v); setPage(1); }}>
            <SelectTrigger className="w-[130px] h-9 text-sm bg-white border-slate-200">
              <SelectValue placeholder="Language" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Language</SelectItem>
              <SelectItem value="English">English</SelectItem>
              <SelectItem value="Spanish">Spanish</SelectItem>
              <SelectItem value="Yiddish">Yiddish</SelectItem>
              <SelectItem value="Hebrew">Hebrew</SelectItem>
              <SelectItem value="Russian">Russian</SelectItem>
            </SelectContent>
          </Select>

          <Select value={boroughFilter} onValueChange={(v) => { setBoroughFilter(v); setPage(1); }}>
            <SelectTrigger className="w-[130px] h-9 text-sm bg-white border-slate-200">
              <SelectValue placeholder="Borough" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Borough</SelectItem>
              <SelectItem value="Brooklyn">Brooklyn</SelectItem>
              <SelectItem value="Manhattan">Manhattan</SelectItem>
              <SelectItem value="Queens">Queens</SelectItem>
              <SelectItem value="Bronx">Bronx</SelectItem>
              <SelectItem value="Staten Island">Staten Island</SelectItem>
            </SelectContent>
          </Select>

          <Select value={neighborhoodFilter} onValueChange={(v) => { setNeighborhoodFilter(v); setVendorFilter("all"); setPage(1); }}>
            <SelectTrigger className="w-[150px] h-9 text-sm bg-white border-slate-200">
              <SelectValue placeholder="Neighborhood" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Neighborhood</SelectItem>
              {NEIGHBORHOODS_LIST.map((n) => (
                <SelectItem key={n.name} value={n.name}>{n.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={vendorFilter} onValueChange={(v) => { setVendorFilter(v); setPage(1); }}>
            <SelectTrigger className="w-[160px] h-9 text-sm bg-white border-slate-200">
              <SelectValue placeholder="Vendor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Vendors</SelectItem>
              {(neighborhoodFilter !== "all"
                ? NEIGHBORHOODS_LIST.find(n => n.name === neighborhoodFilter)?.vendors || []
                : NEIGHBORHOODS_LIST.flatMap(n => n.vendors)
              ).map((v) => (
                <SelectItem key={v} value={v}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={programFilter} onValueChange={(v) => { setProgramFilter(v); setPage(1); }}>
            <SelectTrigger className="w-[130px] h-9 text-sm bg-white border-slate-200">
              <SelectValue placeholder="Program" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Program</SelectItem>
              <SelectItem value="PHS">PHS</SelectItem>
              <SelectItem value="SCN">SCN</SelectItem>
            </SelectContent>
          </Select>

          <Select value="all">
            <SelectTrigger className="w-[160px] h-9 text-sm bg-white border-slate-200">
              <SelectValue placeholder="Zipcode Eligibility" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Zipcode Eligibility</SelectItem>
              <SelectItem value="eligible">Eligible</SelectItem>
              <SelectItem value="ineligible">Ineligible</SelectItem>
            </SelectContent>
          </Select>

          <Select value={workerFilter} onValueChange={(v) => { setWorkerFilter(v); setPage(1); }}>
            <SelectTrigger className="w-[160px] h-9 text-sm bg-white border-slate-200">
              <SelectValue placeholder="Assigned Worker" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Assigned Worker</SelectItem>
              {staffList.map((s: any) => (
                <SelectItem key={s.id} value={String(s.id)}>{s.name || `User #${s.id}`}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={repFilter} onValueChange={(v) => { setRepFilter(v); setPage(1); }}>
            <SelectTrigger className="w-[170px] h-9 text-sm bg-white border-slate-200">
              <SelectValue placeholder="Intake Representative" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Intake Representative</SelectItem>
              {staffList.map((s: any) => (
                <SelectItem key={s.id} value={String(s.id)}>{s.name || `User #${s.id}`}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={referralFilter} onValueChange={(v) => { setReferralFilter(v); setPage(1); }}>
            <SelectTrigger className="w-[160px] h-9 text-sm bg-white border-slate-200">
              <SelectValue placeholder="Referral Source" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Referral Source</SelectItem>
              {referralLinks.map((r: any) => (
                <SelectItem key={r.code} value={r.code}>{r.referrerName || r.code}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>)}

        {/* Bulk Delete Toolbar */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-3 px-4 py-2.5 bg-red-50 border border-red-200 rounded-lg">
            <span className="text-sm font-medium text-red-700">{selectedIds.size} client{selectedIds.size === 1 ? '' : 's'} selected</span>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 border-red-300 text-red-700 hover:bg-red-100"
              onClick={() => setShowBulkDeleteConfirm(true)}
              disabled={bulkDeleteMutation.isPending}
            >
              {bulkDeleteMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              Delete Selected
            </Button>
            <Button variant="ghost" size="sm" className="h-8 text-slate-500" onClick={() => setSelectedIds(new Set())}>
              Clear Selection
            </Button>
          </div>
        )}

        {/* Table */}
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          {listQuery.isLoading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="text-center py-20 text-slate-500">
              <p className="text-sm">No clients found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="px-4 py-3 w-10">
                      <Checkbox
                        checked={filteredRows.length > 0 && filteredRows.every((c: any) => selectedIds.has(c.id))}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedIds(new Set(filteredRows.map((c: any) => c.id)));
                          } else {
                            setSelectedIds(new Set());
                          }
                        }}
                        aria-label="Select all"
                      />
                    </th>
                    <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-4 py-3">Client</th>
                    <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-4 py-3">CIN</th>
                    <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-4 py-3">DOB</th>
                    <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-4 py-3">Language</th>
                    <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-4 py-3">Members</th>
                    <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-4 py-3 cursor-pointer select-none"
                      onClick={() => setSortDir(sortDir === "desc" ? "asc" : "desc")}>
                      <span className="flex items-center gap-1">
                        Date Added
                        {sortDir === "desc" ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
                      </span>
                    </th>
                    <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-4 py-3">Stage</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((client: any) => {
                    const fd = client.formData as any || {};
                    const initials = getInitials(client.firstName, client.lastName);
                    const avatarColor = getAvatarColor(`${client.firstName}${client.lastName}`);
                    const workerName = getWorkerName(client.assignedTo);
                    const stageInfo = STAGE_CONFIG[client.stage] || { label: client.stage, bg: "bg-slate-100", text: "text-slate-700" };
                    const dob = fd.dateOfBirth ? new Date(fd.dateOfBirth).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "\u2014";
                    const additionalCount = typeof client.additionalMembersCount === "number" ? client.additionalMembersCount : (fd.householdMembers?.length ?? 0);
                    const membersDisplay = additionalCount > 0 ? `1 + ${additionalCount}` : "1";

                    const isSelected = selectedIds.has(client.id);
                    return (
                      <tr key={client.id} className={`border-b border-slate-100 hover:bg-slate-50/50 transition-colors ${isSelected ? 'bg-red-50/40' : ''}`}>
                        <td className="px-4 py-3 w-10" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={(checked) => {
                              const next = new Set(selectedIds);
                              if (checked) next.add(client.id); else next.delete(client.id);
                              setSelectedIds(next);
                            }}
                            aria-label={`Select ${client.firstName} ${client.lastName}`}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <Link href={`/admin/clients/${client.id}`}>
                            <div className="flex items-center gap-3 cursor-pointer">
                              <div className={`h-9 w-9 rounded-full ${avatarColor} flex items-center justify-center text-white font-medium text-xs shrink-0`}>
                                {initials}
                              </div>
                              <div>
                                <p className="text-sm font-medium text-green-700 hover:text-green-800">{client.firstName} {client.lastName}</p>
                                <p className="text-xs text-slate-400">{workerName}</p>
                              </div>
                            </div>
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600">{client.medicaidId}</td>
                        <td className="px-4 py-3 text-sm text-slate-600">{dob}</td>
                        <td className="px-4 py-3 text-sm text-slate-600">{client.language || "English"}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1 text-sm font-medium text-slate-700">
                            <span>{membersDisplay}</span>
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600">
                          {new Date(client.createdAt).toLocaleDateString("en-US")}
                        </td>
                        <td className="px-4 py-3">
                          <Badge className={`${stageInfo.bg} ${stageInfo.text} text-[11px] font-medium border-0`}>
                            {stageInfo.label}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50/50">
              <p className="text-xs text-slate-500">
                Page {page} of {totalPages} ({totalCount} clients)
              </p>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)} className="h-8 w-8 p-0">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="h-8 w-8 p-0">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add Client Dialog */}
      <AddClientDialog
        open={showAddDialog}
        onClose={() => setShowAddDialog(false)}
        onSuccess={() => utils.admin.list.invalidate()}
      />

      {/* Bulk Delete Confirmation */}
      <AlertDialog open={showBulkDeleteConfirm} onOpenChange={setShowBulkDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedIds.size} client{selectedIds.size === 1 ? '' : 's'}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {selectedIds.size} client record{selectedIds.size === 1 ? '' : 's'} and all associated data (documents, notes, tasks). This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => bulkDeleteMutation.mutate({ ids: Array.from(selectedIds) })}
            >
              Delete {selectedIds.size} client{selectedIds.size === 1 ? '' : 's'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
