import AdminLayout from "@/components/AdminLayout";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  ArrowLeft, Loader2, FileText, Plus, ChevronDown, ChevronUp,
  Pencil, Trash2, Upload, ExternalLink,
} from "lucide-react";
import { useState, useRef } from "react";
import { Link, useParams } from "wouter";
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

const OUTCOME_OPTIONS = [
  "Select Outcome",
  "Level One Only",
  "Level One (household)",
  "Level 2 Active",
  "Ineligible For SCN",
  "Provider Attestation Required",
];

const DOCUMENT_TYPES = [
  { value: "provider_attestation", label: "Provider Attestation" },
  { value: "consent", label: "Consent" },
  { value: "supporting_documentation", label: "Supporting Documentation" },
  { value: "id_document", label: "ID" },
  { value: "medicaid_card", label: "Medicaid Card" },
];

function InfoLine({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-slate-100 last:border-0">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-sm text-slate-900">{value || "—"}</span>
    </div>
  );
}

function ScreeningLine({ num, label, value }: { num: number; label: string; value: string | boolean | null | undefined }) {
  let display = "—";
  if (typeof value === "boolean") display = value ? "Yes" : "No";
  else if (typeof value === "string" && value) display = value;
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-slate-100">
      <span className="text-sm text-slate-600">{num}. {label}</span>
      <span className="text-sm text-slate-900">{display}</span>
    </div>
  );
}

function SectionCard({ title, count, onAdd, children }: {
  title: string; count?: number; onAdd?: () => void; children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{title}</h3>
          {count !== undefined && (
            <span className="text-xs text-slate-400">{count} total</span>
          )}
        </div>
        {onAdd && (
          <Button size="sm" className="bg-emerald-500 hover:bg-emerald-600 text-white gap-1 h-7 text-xs px-2.5">
            <Plus className="h-3 w-3" /> Add
          </Button>
        )}
      </div>
      {children}
    </div>
  );
}

function CollapsibleSection({ title, defaultOpen = true, children }: {
  title: string; defaultOpen?: boolean; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-slate-200 rounded-lg">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        {title}
        {open ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
      </button>
      {open && <div className="px-4 pb-3">{children}</div>}
    </div>
  );
}

export default function AdminClientDetail() {
  const params = useParams<{ id: string }>();
  const id = parseInt(params.id || "0");
  const utils = trpc.useUtils();

  const { data: client, isLoading } = trpc.admin.getById.useQuery({ id }, { enabled: id > 0 });
  const { data: notes } = trpc.admin.notes.byClient.useQuery({ submissionId: id }, { enabled: id > 0 });
  const { data: tasks } = trpc.admin.tasks.byClient.useQuery({ submissionId: id }, { enabled: id > 0 });
  const { data: clientServices } = trpc.admin.services.byClient.useQuery({ submissionId: id }, { enabled: id > 0 });
  const { data: clientDocs } = trpc.admin.documents.byClient.useQuery({ submissionId: id }, { enabled: id > 0 });
  const staffQuery = trpc.admin.staffList.useQuery();

  const [activeTab, setActiveTab] = useState<"overview" | "assessment" | "services">("overview");
  const [noteText, setNoteText] = useState("");
  const [showAddService, setShowAddService] = useState(false);
  const [newServiceName, setNewServiceName] = useState("");
  const [docType, setDocType] = useState("provider_attestation");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const updateStageMutation = trpc.admin.updateStage.useMutation({
    onSuccess: () => { utils.admin.getById.invalidate({ id }); toast.success("Stage updated"); },
  });
  const updateAssignmentMutation = trpc.admin.updateAssignment.useMutation({
    onSuccess: () => { utils.admin.getById.invalidate({ id }); toast.success("Assignment updated"); },
  });
  const addNoteMutation = trpc.admin.notes.create.useMutation({
    onSuccess: () => { utils.admin.notes.byClient.invalidate({ submissionId: id }); setNoteText(""); toast.success("Note added"); },
  });
  const addTaskMutation = trpc.admin.tasks.create.useMutation({
    onSuccess: () => { utils.admin.tasks.byClient.invalidate({ submissionId: id }); toast.success("Task added"); },
  });
  const addServiceMutation = trpc.admin.services.create.useMutation({
    onSuccess: () => { utils.admin.services.byClient.invalidate({ submissionId: id }); setShowAddService(false); setNewServiceName(""); toast.success("Service added"); },
  });
  const uploadDocMutation = trpc.admin.documents.upload.useMutation({
    onSuccess: () => { utils.admin.documents.byClient.invalidate({ submissionId: id }); toast.success("Document uploaded"); },
  });

  const staffList = (staffQuery.data ?? []) as any[];

  const getWorkerName = (wId: number | null) => {
    if (!wId) return null;
    const w = staffList.find((s: any) => s.id === wId);
    return w?.name || `User #${wId}`;
  };

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex justify-center items-center h-96"><Loader2 className="h-8 w-8 animate-spin text-slate-400" /></div>
      </AdminLayout>
    );
  }

  if (!client) {
    return (
      <AdminLayout>
        <div className="p-6 text-center">
          <p className="text-slate-500">Client not found</p>
          <Link href="/admin/clients"><Button variant="outline" className="mt-4">Back to Clients</Button></Link>
        </div>
      </AdminLayout>
    );
  }

  const fd = (client as any).formData as any || {};
  const screening = fd.screening || {};
  const healthCategories = fd.healthCategories || [];
  const householdMembers = fd.householdMembers || [];
  const documents = fd.documents || {};

  const stageInfo = STAGE_CONFIG[client.stage] || { label: client.stage, bg: "bg-slate-100", text: "text-slate-700" };
  const isReferral = client.stage === "referral";
  const isAssessment = ["assessment", "level_one_only", "level_one_household", "level_2_active"].includes(client.stage);
  const intakeRepName = getWorkerName(client.intakeRep);
  const assignedWorkerName = getWorkerName(client.assignedTo);

  const intakeRepTasks = (tasks || []).filter((t: any) => t.area === "intake_rep");
  const workerTasks = (tasks || []).filter((t: any) => t.area === "assigned_worker");

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      uploadDocMutation.mutate({
        submissionId: id,
        name: file.name,
        category: docType as any,
        fileData: base64,
        contentType: file.type,
      });
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <AdminLayout>
      <div className="p-6 space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <Link href="/admin/clients">
              <button className="mt-1.5 text-slate-400 hover:text-slate-600">
                <ArrowLeft className="h-5 w-5" />
              </button>
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-slate-900">{client.firstName} {client.lastName}</h1>
                <Badge className={`${stageInfo.bg} ${stageInfo.text} text-xs font-medium border-0`}>
                  {stageInfo.label}
                </Badge>
              </div>
              <p className="text-sm text-slate-500 mt-0.5">Carebridge</p>
              <div className="flex items-center gap-4 mt-1 text-sm text-slate-500">
                <span>Intake Rep: <strong className="text-slate-700">{intakeRepName || "—"}</strong></span>
                <span className="flex items-center gap-1.5">
                  Assigned Worker:
                  <Select
                    value={client.assignedTo ? String(client.assignedTo) : "unassigned"}
                    onValueChange={(v) => updateAssignmentMutation.mutate({ id, assignedTo: v === "unassigned" ? null : parseInt(v) })}
                  >
                    <SelectTrigger className="h-7 w-[140px] text-xs border-slate-300">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">Unassigned</SelectItem>
                      {staffList.map((s: any) => (
                        <SelectItem key={s.id} value={String(s.id)}>{s.name || `User #${s.id}`}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5 text-slate-600 h-8">
              <Pencil className="h-3.5 w-3.5" /> Edit
            </Button>
            <Button variant="outline" size="sm" className="text-red-500 hover:text-red-600 hover:bg-red-50 h-8 w-8 p-0">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Intake Journey */}
        <div className="bg-white rounded-lg border border-slate-200 p-5">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">Intake Journey</h3>
          <div className="flex items-center">
            {/* Step 1: Referral */}
            <div className="flex flex-col items-center">
              <button
                onClick={() => updateStageMutation.mutate({ id, stage: "referral" })}
                className={`h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                  isReferral || isAssessment
                    ? "bg-emerald-500 text-white"
                    : "bg-slate-200 text-slate-500"
                }`}
              >
                1
              </button>
              <span className={`text-xs mt-1.5 ${isReferral ? "font-semibold text-emerald-700" : "text-slate-500"}`}>Referral</span>
            </div>

            {/* Line */}
            <div className={`flex-1 h-0.5 mx-2 ${isAssessment ? "bg-emerald-500" : "bg-slate-200"}`} />

            {/* Step 2: Assessment */}
            <div className="flex flex-col items-center">
              <button
                onClick={() => updateStageMutation.mutate({ id, stage: "assessment" })}
                className={`h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                  isAssessment
                    ? "bg-emerald-500 text-white"
                    : "bg-slate-200 text-slate-500"
                }`}
              >
                2
              </button>
              <span className={`text-xs mt-1.5 ${isAssessment ? "font-semibold text-emerald-700" : "text-slate-500"}`}>Assessment</span>
            </div>

            {/* Line */}
            <div className="flex-1 h-0.5 mx-2 bg-slate-200" />

            {/* Outcome */}
            <div className="flex flex-col items-center">
              <Select
                value={client.stage}
                onValueChange={(v) => updateStageMutation.mutate({ id, stage: v as any })}
              >
                <SelectTrigger className="h-10 w-[180px] text-xs bg-slate-100 border-slate-200">
                  <SelectValue placeholder="Select Outcome" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(STAGE_CONFIG).map(([key, { label }]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-xs mt-1.5 text-slate-500">Outcome</span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-slate-200">
          {(["overview", "assessment", "services"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                activeTab === tab
                  ? "border-emerald-500 text-emerald-700"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              {tab === "overview" ? "Overview" : tab === "assessment" ? "Assessment" : "Services"}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === "overview" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Left Column */}
            <div className="space-y-5">
              {/* Client Information */}
              <SectionCard title="Client Information">
                <InfoLine label="CIN ID" value={client.medicaidId} />
                <InfoLine label="Date of Birth" value={fd.dateOfBirth ? new Date(fd.dateOfBirth).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : null} />
                <InfoLine label="Phone" value={client.cellPhone} />
                <InfoLine label="Address" value={[fd.streetAddress, fd.aptUnit, fd.city || "Brooklyn", fd.state || "NY", fd.zipcode].filter(Boolean).join(" ")} />
                <InfoLine label="Language" value={client.language || "English"} />
                <InfoLine label="Program" value={client.program || "PHS"} />
              </SectionCard>

              {/* Household Members */}
              <SectionCard title="Household Members" count={householdMembers.length} onAdd={() => toast.info("Feature coming soon")}>
                {householdMembers.length > 0 ? (
                  <div className="space-y-2">
                    {householdMembers.map((m: any, i: number) => (
                      <div key={i} className="p-3 rounded-lg bg-slate-50 border border-slate-100">
                        <p className="text-sm font-medium text-slate-900">{m.name || `Member ${i + 1}`}</p>
                        <div className="flex gap-4 mt-1 text-xs text-slate-500">
                          <span>DOB: {m.dob || m.dateOfBirth || "—"}</span>
                          <span>Medicaid: {m.medicaidId || "—"}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">No household members linked</p>
                )}
              </SectionCard>

              {/* Addresses */}
              <SectionCard title="Addresses" onAdd={() => toast.info("Feature coming soon")}>
                <p className="text-sm text-slate-400">No additional addresses. Click Add to create one.</p>
              </SectionCard>

              {/* Additional Phones */}
              <SectionCard title="Additional Phones" onAdd={() => toast.info("Feature coming soon")}>
                <p className="text-sm text-slate-400">No additional phone numbers. Click Add to create one.</p>
              </SectionCard>

              {/* Email Addresses */}
              <SectionCard title="Email Addresses" onAdd={() => toast.info("Feature coming soon")}>
                {client.email ? (
                  <p className="text-sm text-slate-700">{client.email}</p>
                ) : (
                  <p className="text-sm text-slate-400">No email addresses. Click Add to create one.</p>
                )}
              </SectionCard>
            </div>

            {/* Right Column */}
            <div className="space-y-5">
              {/* Services */}
              <SectionCard title="Services">
                <div className="flex justify-end -mt-2 mb-2">
                  <Link href={`#`}>
                    <span className="text-xs text-blue-600 hover:text-blue-700 cursor-pointer" onClick={() => setActiveTab("services")}>View All</span>
                  </Link>
                </div>
                {clientServices && (clientServices as any[]).length > 0 ? (
                  <div className="space-y-2">
                    {(clientServices as any[]).slice(0, 3).map((s: any) => (
                      <div key={s.id} className="flex items-center justify-between p-2 rounded bg-slate-50 border border-slate-100">
                        <span className="text-sm text-slate-700">{s.name}</span>
                        <Badge className={`text-[10px] ${s.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                          {s.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <FileText className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm text-slate-400">No active services. Add one from the Services tab.</p>
                  </div>
                )}
              </SectionCard>

              {/* Tasks & Action Items */}
              <div className="bg-white rounded-lg border border-slate-200 p-5">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Tasks & Action Items</h3>

                {/* Intake Rep Tasks */}
                <CollapsibleSection title={`Intake Rep Tasks → ${intakeRepName || "Unassigned"}`}>
                  {intakeRepTasks.length > 0 ? (
                    <div className="space-y-2">
                      {intakeRepTasks.map((t: any) => (
                        <div key={t.id} className="flex items-center justify-between p-2 rounded bg-slate-50 border border-slate-100">
                          <span className="text-sm text-slate-700">{t.description}</span>
                          <Badge className={`text-[10px] ${t.status === "completed" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                            {t.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400">No tasks yet.</p>
                  )}
                  <Button
                    variant="ghost" size="sm"
                    className="text-blue-600 hover:text-blue-700 gap-1 mt-2 h-7 text-xs px-2"
                    onClick={() => addTaskMutation.mutate({ submissionId: id, description: "New task", area: "intake_rep" })}
                  >
                    <Plus className="h-3 w-3" /> Add Task
                  </Button>
                </CollapsibleSection>

                <div className="mt-3">
                  <CollapsibleSection title="Assigned Worker Tasks">
                    {workerTasks.length > 0 ? (
                      <div className="space-y-2">
                        {workerTasks.map((t: any) => (
                          <div key={t.id} className="flex items-center justify-between p-2 rounded bg-slate-50 border border-slate-100">
                            <span className="text-sm text-slate-700">{t.description}</span>
                            <Badge className={`text-[10px] ${t.status === "completed" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                              {t.status}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-400">No tasks yet.</p>
                    )}
                    <Button
                      variant="ghost" size="sm"
                      className="text-blue-600 hover:text-blue-700 gap-1 mt-2 h-7 text-xs px-2"
                      onClick={() => addTaskMutation.mutate({ submissionId: id, description: "New task", area: "assigned_worker" })}
                    >
                      <Plus className="h-3 w-3" /> Add Task
                    </Button>
                  </CollapsibleSection>
                </div>
              </div>

              {/* Case Notes */}
              <div className="bg-white rounded-lg border border-slate-200 p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Case Notes</h3>
                  <Button
                    size="sm"
                    className="bg-blue-600 hover:bg-blue-700 text-white gap-1 h-7 text-xs px-2.5"
                    onClick={() => {
                      if (noteText.trim()) {
                        addNoteMutation.mutate({ submissionId: id, content: noteText.trim() });
                      }
                    }}
                    disabled={!noteText.trim() || addNoteMutation.isPending}
                  >
                    <Plus className="h-3 w-3" /> Add Note
                  </Button>
                </div>
                <Textarea
                  placeholder="Add a case note..."
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  className="text-sm min-h-[60px] mb-3"
                />
                {notes && (notes as any[]).length > 0 ? (
                  <div className="space-y-2">
                    {(notes as any[]).map((note: any) => (
                      <div key={note.id} className="p-3 rounded-lg bg-slate-50 border border-slate-100">
                        <p className="text-sm text-slate-700">{note.content}</p>
                        <div className="flex items-center gap-2 mt-2 text-xs text-slate-400">
                          <span>{note.authorName || "Staff"}</span>
                          <span>&middot;</span>
                          <span>{new Date(note.createdAt).toLocaleString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">No notes yet.</p>
                )}
              </div>

              {/* Documents */}
              <div className="bg-white rounded-lg border border-slate-200 p-5">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Documents</h3>

                {/* Document Type + Upload */}
                <div className="flex gap-2 mb-3">
                  <Select value={docType} onValueChange={setDocType}>
                    <SelectTrigger className="flex-1 h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DOCUMENT_TYPES.map((dt) => (
                        <SelectItem key={dt.value} value={dt.value}>{dt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Upload area */}
                <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-colors mb-3">
                  <Upload className="h-6 w-6 text-slate-400 mb-1" />
                  <span className="text-sm text-slate-500">Click to upload documents</span>
                  <span className="text-xs text-slate-400">or drag files here</span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                </label>

                {/* Existing documents */}
                {clientDocs && (clientDocs as any[]).length > 0 ? (
                  <div className="space-y-2">
                    {(clientDocs as any[]).map((doc: any) => (
                      <div key={doc.id} className="flex items-center justify-between p-2 rounded bg-slate-50 border border-slate-100">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-slate-400" />
                          <span className="text-sm text-slate-700">{doc.name}</span>
                        </div>
                        <a href={doc.url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-4 w-4 text-blue-500 hover:text-blue-600" />
                        </a>
                      </div>
                    ))}
                  </div>
                ) : (
                  /* Also show form-uploaded documents */
                  Object.keys(documents).length > 0 ? (
                    <div className="space-y-2">
                      {Object.entries(documents).map(([key, url]) => (
                        <div key={key} className="flex items-center justify-between p-2 rounded bg-slate-50 border border-slate-100">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-slate-400" />
                            <span className="text-sm text-slate-700">{key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase())}</span>
                          </div>
                          <a href={url as string} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-4 w-4 text-blue-500 hover:text-blue-600" />
                          </a>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400">No documents yet. Upload one above.</p>
                  )
                )}
              </div>
            </div>
          </div>
        )}

        {/* Assessment Tab */}
        {activeTab === "assessment" && (
          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-slate-900">SCN Screening Questionnaire</h2>
              <Button variant="outline" size="sm" className="gap-1.5 text-slate-600 h-8">
                <Pencil className="h-3.5 w-3.5" /> Edit
              </Button>
            </div>

            {/* Screening Info */}
            <div className="mb-6">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Screening Info</h3>
              <InfoLine label="Screening Date" value={client.createdAt ? new Date(client.createdAt).toLocaleDateString() : null} />
              <InfoLine label="Screener Name" value={intakeRepName || "—"} />
            </div>

            {/* Screening Questions */}
            <div>
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Screening Questions</h3>
              <ScreeningLine num={1} label="Current living situation" value={screening.livingSituation} />
              {screening.livingSituation && (
                <div className="pl-6 py-1.5 border-b border-slate-100">
                  <span className="text-xs text-slate-400">Struggles with paying for housing / behind on payments</span>
                </div>
              )}
              <ScreeningLine num={2} label="Utility shutoff threat (past 12 months)" value={screening.utilityShutoff} />
              <ScreeningLine num={3} label="Receives SNAP (Food Stamps)" value={fd.receivesSnap ?? fd.hasSnap} />
              <ScreeningLine num={4} label="Receives WIC" value={fd.receivesWic ?? fd.hasWic} />
              <ScreeningLine num={5} label="Receives TANF" value={screening.receivesTanf} />
              <ScreeningLine num={6} label="Enrolled in Health Home" value={healthCategories.includes("Enrolled in Health Home Care Management")} />
              <ScreeningLine num={7} label="Household members" value={fd.householdMemberCount || String(householdMembers.length)} />
              <ScreeningLine num={8} label="Household members with Medicaid" value={screening.householdMembersWithMedicaid} />
              <ScreeningLine num={9} label="Needs work assistance" value={screening.needsWorkAssistance} />
              <ScreeningLine num={10} label="Wants school or training help" value={screening.wantsSchoolTraining ?? screening.wantsSchoolHelp} />
              <ScreeningLine num={11} label="Transportation barrier (past 12 months)" value={screening.transportationBarrier} />
              <ScreeningLine num={12} label="Has chronic illness" value={screening.hasChronicIllness} />
              <ScreeningLine num={13} label="Other known health issues" value={screening.otherHealthIssues} />
              <ScreeningLine num={14} label="Medications require refrigeration" value={screening.medicationsRequireRefrigeration} />
              <ScreeningLine num={15} label="Pregnant or postpartum" value={healthCategories.includes("Pregnant") || healthCategories.includes("Postpartum")} />
              <ScreeningLine num={16} label="Breastmilk refrigeration needed" value={screening.breastmilkRefrigeration} />
            </div>

            {/* Food Allergies */}
            <div className="mt-6 pt-4 border-t border-slate-200">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Food Allergies / Dietary Restrictions</h3>
              <InfoLine label="Food allergies" value={fd.foodAllergies || fd.foodAllergiesDetails || "—"} />
              <InfoLine label="Dietary restrictions" value={fd.dietaryRestrictions || "—"} />
            </div>

            {/* Appliances */}
            <div className="mt-6 pt-4 border-t border-slate-200">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Household Appliance / Cooking Needs</h3>
              <InfoLine label="Needs refrigerator" value={fd.needsRefrigerator || "—"} />
              <InfoLine label="Needs microwave" value={fd.needsMicrowave || "—"} />
              <InfoLine label="Needs cooking utensils/supplies" value={fd.needsCookingUtensils || "—"} />
            </div>
          </div>
        )}

        {/* Services Tab */}
        {activeTab === "services" && (
          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-900">Services</h2>
              <Button
                className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5 h-8 text-sm px-3"
                onClick={() => setShowAddService(true)}
              >
                <Plus className="h-4 w-4" /> Add Service
              </Button>
            </div>
            {clientServices && (clientServices as any[]).length > 0 ? (
              <div className="space-y-3">
                {(clientServices as any[]).map((s: any) => (
                  <div key={s.id} className="flex items-center justify-between p-4 rounded-lg bg-slate-50 border border-slate-100">
                    <div>
                      <p className="text-sm font-medium text-slate-900">{s.name}</p>
                      {s.description && <p className="text-xs text-slate-500 mt-0.5">{s.description}</p>}
                      {s.startDate && <p className="text-xs text-slate-400 mt-0.5">Started: {new Date(s.startDate).toLocaleDateString()}</p>}
                    </div>
                    <Badge className={`text-xs ${
                      s.status === "active" ? "bg-emerald-100 text-emerald-700" :
                      s.status === "completed" ? "bg-blue-100 text-blue-700" :
                      "bg-slate-100 text-slate-600"
                    }`}>
                      {s.status}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <FileText className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                <p className="text-sm text-slate-400">No services yet. Add one to get started.</p>
              </div>
            )}
          </div>
        )}

        {/* Add Service Dialog */}
        <Dialog open={showAddService} onOpenChange={setShowAddService}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Service</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <Input
                placeholder="Service name..."
                value={newServiceName}
                onChange={(e) => setNewServiceName(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddService(false)}>Cancel</Button>
              <Button
                className="bg-blue-600 hover:bg-blue-700"
                onClick={() => newServiceName.trim() && addServiceMutation.mutate({ submissionId: id, name: newServiceName.trim() })}
                disabled={!newServiceName.trim() || addServiceMutation.isPending}
              >
                {addServiceMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
