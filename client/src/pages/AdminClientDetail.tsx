import AdminLayout from "@/components/AdminLayout";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft, CheckCircle2, Clock, Loader2, FileText, MessageSquare,
  Calendar, User, Phone, Mail, MapPin, ShieldCheck, Heart, Store, Baby
} from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "wouter";
import { toast } from "sonner";

const STAGE_LABELS: Record<string, { label: string; color: string }> = {
  referral: { label: "Referral", color: "bg-blue-100 text-blue-700 border-blue-200" },
  assessment: { label: "Assessment", color: "bg-amber-100 text-amber-700 border-amber-200" },
  level_one_only: { label: "Level 1 Only", color: "bg-purple-100 text-purple-700 border-purple-200" },
  level_one_household: { label: "Level 1 Household", color: "bg-indigo-100 text-indigo-700 border-indigo-200" },
  level_2_active: { label: "Level 2 Active", color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  ineligible: { label: "Ineligible", color: "bg-red-100 text-red-700 border-red-200" },
  provider_attestation_required: { label: "Provider Attestation", color: "bg-orange-100 text-orange-700 border-orange-200" },
  flagged: { label: "Flagged", color: "bg-rose-100 text-rose-700 border-rose-200" },
};

const STAGE_ORDER = ["referral", "assessment", "level_one_only", "level_one_household", "level_2_active"];

const STATUS_COLORS: Record<string, string> = {
  new: "bg-blue-100 text-blue-700",
  in_review: "bg-amber-100 text-amber-700",
  approved: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-700",
  on_hold: "bg-slate-200 text-slate-700",
};

function InfoRow({ label, value, icon }: { label: string; value: string | null | undefined; icon?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between py-2.5 border-b border-slate-100 last:border-0">
      <div className="flex items-center gap-2 text-sm text-slate-500">
        {icon}
        {label}
      </div>
      <span className="text-sm font-medium text-slate-900 text-right max-w-[60%]">{value || "—"}</span>
    </div>
  );
}

function YesNo({ val }: { val: boolean | null | undefined }) {
  if (val === true) return <span className="text-emerald-600 font-medium text-sm">Yes</span>;
  if (val === false) return <span className="text-red-500 font-medium text-sm">No</span>;
  return <span className="text-slate-400 text-sm">—</span>;
}

export default function AdminClientDetail() {
  const params = useParams<{ id: string }>();
  const id = parseInt(params.id || "0");
  const utils = trpc.useUtils();

  const { data: client, isLoading } = trpc.admin.getById.useQuery({ id }, { enabled: id > 0 });
  const { data: notes } = trpc.admin.notes.byClient.useQuery({ submissionId: id }, { enabled: id > 0 });
  const { data: tasks } = trpc.admin.tasks.byClient.useQuery({ submissionId: id }, { enabled: id > 0 });

  const [noteText, setNoteText] = useState("");
  const [activeTab, setActiveTab] = useState("overview");

  const updateStatusMutation = trpc.admin.updateStatus.useMutation({
    onSuccess: () => { utils.admin.getById.invalidate({ id }); toast.success("Status updated"); },
  });
  const updateStageMutation = trpc.admin.updateStage.useMutation({
    onSuccess: () => { utils.admin.getById.invalidate({ id }); toast.success("Stage updated"); },
  });
  const addNoteMutation = trpc.admin.notes.create.useMutation({
    onSuccess: () => { utils.admin.notes.byClient.invalidate({ submissionId: id }); setNoteText(""); toast.success("Note added"); },
  });

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
  const mealFocus = fd.mealFocus || [];
  const appliances = fd.appliances || {};
  const documents = fd.documents || {};
  const householdMembers = fd.householdMembers || [];

  const currentStageIdx = STAGE_ORDER.indexOf(client.stage);

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/admin/clients">
              <Button variant="ghost" size="sm" className="gap-1 text-slate-500">
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-bold text-slate-900">{client.firstName} {client.lastName}</h1>
              <p className="text-sm text-slate-500">{client.referenceNumber} &middot; {client.medicaidId}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Select value={client.status} onValueChange={(v) => updateStatusMutation.mutate({ id, status: v as any })}>
              <SelectTrigger className="w-[130px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="new">New</SelectItem>
                <SelectItem value="in_review">In Review</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="on_hold">On Hold</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Intake Journey Progress */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-slate-700">INTAKE JOURNEY</CardTitle>
              <Select value={client.stage} onValueChange={(v) => updateStageMutation.mutate({ id, stage: v as any })}>
                <SelectTrigger className="w-[180px] h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(STAGE_LABELS).map(([key, { label }]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-0">
              {STAGE_ORDER.map((stage, idx) => {
                const isComplete = idx < currentStageIdx;
                const isCurrent = idx === currentStageIdx;
                return (
                  <div key={stage} className="flex items-center flex-1">
                    <div className="flex flex-col items-center flex-1">
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-medium ${
                        isComplete ? "bg-emerald-500 text-white" :
                        isCurrent ? "bg-emerald-500 text-white ring-4 ring-emerald-100" :
                        "bg-slate-200 text-slate-500"
                      }`}>
                        {isComplete ? <CheckCircle2 className="h-4 w-4" /> : idx + 1}
                      </div>
                      <span className={`text-[10px] mt-1 text-center ${isCurrent ? "font-semibold text-emerald-700" : "text-slate-500"}`}>
                        {STAGE_LABELS[stage]?.label}
                      </span>
                    </div>
                    {idx < STAGE_ORDER.length - 1 && (
                      <div className={`h-0.5 flex-1 ${idx < currentStageIdx ? "bg-emerald-500" : "bg-slate-200"}`} />
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-slate-100 p-1">
            <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
            <TabsTrigger value="assessment" className="text-xs">Assessment</TabsTrigger>
            <TabsTrigger value="services" className="text-xs">Services</TabsTrigger>
            <TabsTrigger value="tasks" className="text-xs">Tasks</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Personal Info */}
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <User className="h-4 w-4 text-slate-500" /> Mother's Personal Information
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <InfoRow label="First Name" value={client.firstName} />
                  <InfoRow label="Last Name" value={client.lastName} />
                  <InfoRow label="Date of Birth" value={fd.dateOfBirth} icon={<Calendar className="h-3.5 w-3.5" />} />
                  <InfoRow label="Medicaid ID" value={client.medicaidId} icon={<ShieldCheck className="h-3.5 w-3.5" />} />
                </CardContent>
              </Card>

              {/* Contact */}
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Phone className="h-4 w-4 text-slate-500" /> Contact Information
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <InfoRow label="Phone" value={client.cellPhone} icon={<Phone className="h-3.5 w-3.5" />} />
                  <InfoRow label="Email" value={client.email} icon={<Mail className="h-3.5 w-3.5" />} />
                  <InfoRow label="Address" value={fd.streetAddress} icon={<MapPin className="h-3.5 w-3.5" />} />
                  <InfoRow label="Apt" value={fd.apt} />
                  <InfoRow label="City" value={fd.city || "Brooklyn"} />
                  <InfoRow label="State" value={fd.state || "NY"} />
                  <InfoRow label="ZIP" value={fd.zipCode} />
                </CardContent>
              </Card>

              {/* Supermarket */}
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Store className="h-4 w-4 text-slate-500" /> Supermarket Selection
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <InfoRow label="Selected Store" value={client.supermarket} />
                  <InfoRow label="Referral Source" value={client.referralSource} />
                </CardContent>
              </Card>

              {/* Health Categories */}
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Heart className="h-4 w-4 text-slate-500" /> Health Categories
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {healthCategories.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {healthCategories.map((cat: string) => (
                        <Badge key={cat} variant="secondary" className="text-xs">{cat}</Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400">None selected</p>
                  )}
                  {fd.dueDate && <InfoRow label="Due Date" value={fd.dueDate} icon={<Baby className="h-3.5 w-3.5" />} />}
                  {fd.miscarriageDate && <InfoRow label="Miscarriage Date" value={fd.miscarriageDate} />}
                  {fd.infantName && <InfoRow label="Infant Name" value={fd.infantName} />}
                  {fd.infantDob && <InfoRow label="Infant DOB" value={fd.infantDob} />}
                  {fd.infantMedicaidId && <InfoRow label="Infant Medicaid ID" value={fd.infantMedicaidId} />}
                </CardContent>
              </Card>
            </div>

            {/* Documents */}
            {Object.keys(documents).length > 0 && (
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <FileText className="h-4 w-4 text-slate-500" /> Uploaded Documents
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {Object.entries(documents).map(([key, url]) => (
                      <a key={key} href={url as string} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-2 p-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors border border-slate-200">
                        <FileText className="h-4 w-4 text-emerald-600 shrink-0" />
                        <span className="text-sm text-slate-700 truncate">{key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase())}</span>
                      </a>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Household Members */}
            {householdMembers.length > 0 && (
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">Household Members ({householdMembers.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {householdMembers.map((m: any, i: number) => (
                      <div key={i} className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                        <p className="text-sm font-medium text-slate-900">Member {i + 1}: {m.name || "—"}</p>
                        <div className="flex gap-4 mt-1 text-xs text-slate-500">
                          <span>DOB: {m.dob || "—"}</span>
                          <span>Medicaid: {m.medicaidId || "—"}</span>
                        </div>
                        {m.documents && Object.keys(m.documents).length > 0 && (
                          <div className="flex gap-2 mt-2">
                            {Object.entries(m.documents).map(([dkey, durl]) => (
                              <a key={dkey} href={durl as string} target="_blank" rel="noopener noreferrer"
                                className="text-xs text-emerald-600 hover:underline flex items-center gap-1">
                                <FileText className="h-3 w-3" /> {dkey}
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Case Notes */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-slate-500" /> Case Notes
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <Textarea
                    placeholder="Add a case note..."
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    className="text-sm min-h-[60px]"
                  />
                  <Button
                    size="sm"
                    onClick={() => noteText.trim() && addNoteMutation.mutate({ submissionId: id, content: noteText.trim() })}
                    disabled={!noteText.trim() || addNoteMutation.isPending}
                    className="bg-emerald-600 hover:bg-emerald-700 self-end"
                  >
                    {addNoteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
                  </Button>
                </div>
                {notes && notes.length > 0 ? (
                  <div className="space-y-2">
                    {notes.map((note: any) => (
                      <div key={note.id} className="p-3 rounded-lg bg-slate-50 border border-slate-200">
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
                  <p className="text-sm text-slate-400 text-center py-4">No notes yet</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Assessment Tab */}
          <TabsContent value="assessment" className="mt-4">
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base font-semibold">SCN Screening Questionnaire</CardTitle>
              </CardHeader>
              <CardContent className="space-y-0">
                <div className="border-b border-slate-200 pb-3 mb-3">
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">SCREENING INFO</h3>
                  <InfoRow label="Screening Date" value={new Date(client.createdAt).toLocaleDateString()} />
                </div>

                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">SCREENING QUESTIONS</h3>
                <div className="flex items-center justify-between py-2.5 border-b border-slate-100">
                  <span className="text-sm text-slate-600">1. Current living situation</span>
                  <span className="text-sm font-medium text-slate-900">{screening.livingSituation || "—"}</span>
                </div>
                <div className="flex items-center justify-between py-2.5 border-b border-slate-100">
                  <span className="text-sm text-slate-600">2. Utility shutoff threat (past 12 months)</span>
                  <YesNo val={screening.utilityShutoff} />
                </div>
                <div className="flex items-center justify-between py-2.5 border-b border-slate-100">
                  <span className="text-sm text-slate-600">3. Receives SNAP (Food Stamps)</span>
                  <YesNo val={fd.receivesSnap} />
                </div>
                <div className="flex items-center justify-between py-2.5 border-b border-slate-100">
                  <span className="text-sm text-slate-600">4. Receives WIC</span>
                  <YesNo val={fd.receivesWic} />
                </div>
                <div className="flex items-center justify-between py-2.5 border-b border-slate-100">
                  <span className="text-sm text-slate-600">5. Receives TANF</span>
                  <YesNo val={screening.receivesTanf} />
                </div>
                <div className="flex items-center justify-between py-2.5 border-b border-slate-100">
                  <span className="text-sm text-slate-600">6. Enrolled in Health Home</span>
                  <YesNo val={healthCategories.includes("Enrolled in Health Home Care Management")} />
                </div>
                <div className="flex items-center justify-between py-2.5 border-b border-slate-100">
                  <span className="text-sm text-slate-600">7. Household members</span>
                  <span className="text-sm font-medium text-slate-900">{fd.householdMemberCount || "—"}</span>
                </div>
                <div className="flex items-center justify-between py-2.5 border-b border-slate-100">
                  <span className="text-sm text-slate-600">8. Household members with Medicaid</span>
                  <span className="text-sm font-medium text-slate-900">{screening.householdMembersWithMedicaid || "—"}</span>
                </div>
                <div className="flex items-center justify-between py-2.5 border-b border-slate-100">
                  <span className="text-sm text-slate-600">9. Needs work assistance</span>
                  <YesNo val={screening.needsWorkAssistance} />
                </div>
                <div className="flex items-center justify-between py-2.5 border-b border-slate-100">
                  <span className="text-sm text-slate-600">10. Wants school or training help</span>
                  <YesNo val={screening.wantsSchoolTraining} />
                </div>
                <div className="flex items-center justify-between py-2.5 border-b border-slate-100">
                  <span className="text-sm text-slate-600">11. Transportation barrier (past 12 months)</span>
                  <YesNo val={screening.transportationBarrier} />
                </div>
                <div className="flex items-center justify-between py-2.5 border-b border-slate-100">
                  <span className="text-sm text-slate-600">12. Has chronic illness</span>
                  <YesNo val={screening.hasChronicIllness} />
                </div>
                <div className="flex items-center justify-between py-2.5 border-b border-slate-100">
                  <span className="text-sm text-slate-600">13. Other known health issues</span>
                  <YesNo val={screening.otherHealthIssues} />
                </div>
                <div className="flex items-center justify-between py-2.5 border-b border-slate-100">
                  <span className="text-sm text-slate-600">14. Medications require refrigeration</span>
                  <YesNo val={screening.medicationsRequireRefrigeration} />
                </div>
                <div className="flex items-center justify-between py-2.5 border-b border-slate-100">
                  <span className="text-sm text-slate-600">15. Pregnant or postpartum</span>
                  <YesNo val={healthCategories.includes("Pregnant") || healthCategories.includes("Postpartum")} />
                </div>
                <div className="flex items-center justify-between py-2.5 border-b border-slate-100">
                  <span className="text-sm text-slate-600">16. Breastmilk refrigeration needed</span>
                  <YesNo val={screening.breastmilkRefrigeration} />
                </div>

                <div className="border-t border-slate-200 pt-3 mt-3">
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">FOOD ALLERGIES / DIETARY RESTRICTIONS</h3>
                  <div className="flex items-center justify-between py-2.5 border-b border-slate-100">
                    <span className="text-sm text-slate-600">Food allergies</span>
                    <YesNo val={fd.foodAllergies && fd.foodAllergies !== "None"} />
                  </div>
                  <div className="flex items-center justify-between py-2.5">
                    <span className="text-sm text-slate-600">Dietary restrictions</span>
                    <span className="text-sm font-medium text-slate-900">{fd.dietaryRestrictions || "—"}</span>
                  </div>
                </div>

                <div className="border-t border-slate-200 pt-3 mt-3">
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">HOUSEHOLD APPLIANCE / COOKING NEEDS</h3>
                  <div className="flex items-center justify-between py-2.5 border-b border-slate-100">
                    <span className="text-sm text-slate-600">Needs refrigerator</span>
                    <YesNo val={appliances.refrigerator} />
                  </div>
                  <div className="flex items-center justify-between py-2.5 border-b border-slate-100">
                    <span className="text-sm text-slate-600">Needs microwave</span>
                    <YesNo val={appliances.microwave} />
                  </div>
                  <div className="flex items-center justify-between py-2.5">
                    <span className="text-sm text-slate-600">Needs cooking utensils/supplies</span>
                    <YesNo val={appliances.cookingUtensils} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Services Tab */}
          <TabsContent value="services" className="mt-4">
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base font-semibold">Meal Services</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Meal Focus</h4>
                    {mealFocus.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {mealFocus.map((m: string) => (
                          <Badge key={m} className="bg-emerald-100 text-emerald-700 text-xs">{m}</Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-400">None selected</p>
                    )}
                  </div>

                  {fd.breakfastItems && (
                    <InfoRow label="Breakfast Items" value={fd.breakfastItems} />
                  )}
                  {fd.lunchItems && (
                    <InfoRow label="Lunch Items" value={fd.lunchItems} />
                  )}
                  {fd.dinnerItems && (
                    <InfoRow label="Dinner Items" value={fd.dinnerItems} />
                  )}
                  {fd.snackItems && (
                    <InfoRow label="Snack Items" value={fd.snackItems} />
                  )}

                  <div className="border-t border-slate-200 pt-3 mt-3">
                    <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Benefits Status</h4>
                    <InfoRow label="Employed" value={fd.employed ? "Yes" : "No"} />
                    <InfoRow label="Spouse Employed" value={fd.spouseEmployed ? "Yes" : "No"} />
                    <InfoRow label="Receives WIC" value={fd.receivesWic ? "Yes" : "No"} />
                    <InfoRow label="Receives SNAP" value={fd.receivesSnap ? "Yes" : "No"} />
                    <InfoRow label="New Applicant" value={fd.newApplicant} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tasks Tab */}
          <TabsContent value="tasks" className="mt-4">
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base font-semibold">Client Tasks</CardTitle>
              </CardHeader>
              <CardContent>
                {tasks && tasks.length > 0 ? (
                  <div className="space-y-2">
                    {tasks.map((task: any) => (
                      <div key={task.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200">
                        <div>
                          <p className="text-sm font-medium text-slate-900">{task.title}</p>
                          {task.description && <p className="text-xs text-slate-500 mt-0.5">{task.description}</p>}
                        </div>
                        <div className="flex items-center gap-2">
                          {task.dueDate && (
                            <span className="text-xs text-slate-500 flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {new Date(task.dueDate).toLocaleDateString()}
                            </span>
                          )}
                          <Badge className={`text-[10px] ${
                            task.status === "completed" ? "bg-emerald-100 text-emerald-700" :
                            task.status === "in_progress" ? "bg-blue-100 text-blue-700" :
                            "bg-amber-100 text-amber-700"
                          }`}>
                            {task.status.replace("_", " ")}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400 text-center py-8">No tasks assigned to this client</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* HIPAA Compliance */}
        <Card className="border-0 shadow-sm bg-emerald-50/50">
          <CardContent className="p-4 flex items-center gap-3">
            <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0" />
            <div>
              <p className="text-sm font-medium text-emerald-800">HIPAA Consent Granted</p>
              <p className="text-xs text-emerald-600">
                Consent recorded at {client.hipaaConsentAt ? new Date(client.hipaaConsentAt).toLocaleString() : "N/A"}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
