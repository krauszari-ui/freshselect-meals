import AdminLayout from "@/components/AdminLayout";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Search, Loader2, Plus, ChevronDown, ChevronUp, ChevronLeft, ChevronRight,
} from "lucide-react";
import { useEffect, useState, useMemo } from "react";
import { Link, useSearch } from "wouter";

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

export default function AdminClients() {
  const searchParams = useSearch();
  const urlParams = new URLSearchParams(searchParams);
  const initialStage = urlParams.get("stage") || "all";

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [stageFilter, setStageFilter] = useState(initialStage);
  const [languageFilter, setLanguageFilter] = useState("all");
  const [boroughFilter, setBoroughFilter] = useState("all");
  const [programFilter, setProgramFilter] = useState("all");
  const [workerFilter, setWorkerFilter] = useState("all");
  const [repFilter, setRepFilter] = useState("all");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [search]);

  const listQuery = trpc.admin.list.useQuery({
    search: debouncedSearch || undefined,
    stage: stageFilter !== "all" ? stageFilter : undefined,
    language: languageFilter !== "all" ? languageFilter : undefined,
    borough: boroughFilter !== "all" ? boroughFilter : undefined,
    assignedTo: workerFilter !== "all" ? parseInt(workerFilter) : undefined,
    intakeRep: repFilter !== "all" ? parseInt(repFilter) : undefined,
    page,
    pageSize: 25,
  });

  const staffQuery = trpc.admin.staffList.useQuery();

  const listData = listQuery.data as any;
  const rows = listData?.rows ?? [];
  const totalPages = listData?.totalPages ?? 1;
  const totalCount = listData?.total ?? 0;

  // Sort rows by date
  const sortedRows = useMemo(() => {
    if (!rows.length) return rows;
    return [...rows].sort((a: any, b: any) => {
      const da = new Date(a.createdAt).getTime();
      const db = new Date(b.createdAt).getTime();
      return sortDir === "desc" ? db - da : da - db;
    });
  }, [rows, sortDir]);

  // Filter by program client-side (since backend doesn't have program filter yet)
  const filteredRows = useMemo(() => {
    if (programFilter === "all") return sortedRows;
    return sortedRows.filter((r: any) => r.program === programFilter);
  }, [sortedRows, programFilter]);

  const staffList = (staffQuery.data ?? []) as any[];

  const getWorkerName = (id: number | null) => {
    if (!id) return "Unassigned";
    const w = staffList.find((s: any) => s.id === id);
    return w?.name || "Unknown";
  };

  return (
    <AdminLayout>
      <div className="p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Clients</h1>
            <p className="text-slate-500 text-sm mt-0.5">{totalCount} total clients</p>
          </div>
          <Button className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5 h-9 px-4 text-sm">
            <Plus className="h-4 w-4" />
            Add Client
          </Button>
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

        {/* Filter Row */}
        <div className="flex flex-wrap gap-2">
          <Select value={stageFilter} onValueChange={(v) => { setStageFilter(v); setPage(1); }}>
            <SelectTrigger className="w-[140px] h-9 text-sm bg-white border-slate-200">
              <SelectValue placeholder="Stage" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Stages</SelectItem>
              {Object.entries(STAGE_CONFIG).map(([key, { label }]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
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
        </div>

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
                    <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-4 py-3">Client</th>
                    <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-4 py-3">CIN</th>
                    <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-4 py-3">DOB</th>
                    <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-4 py-3">Language</th>
                    <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-4 py-3">Household</th>
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
                    const dob = fd.dateOfBirth ? new Date(fd.dateOfBirth).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "—";
                    const householdMembers = fd.householdMembers || [];
                    const householdDisplay = householdMembers.length > 0 ? householdMembers[0]?.name || "—" : "—";

                    return (
                      <tr key={client.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                        <td className="px-4 py-3">
                          <Link href={`/admin/clients/${client.id}`}>
                            <div className="flex items-center gap-3 cursor-pointer">
                              <div className={`h-9 w-9 rounded-full ${avatarColor} flex items-center justify-center text-white font-medium text-xs shrink-0`}>
                                {initials}
                              </div>
                              <div>
                                <p className="text-sm font-medium text-blue-600 hover:text-blue-700">{client.firstName} {client.lastName}</p>
                                <p className="text-xs text-slate-400">{workerName}</p>
                              </div>
                            </div>
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600">{client.medicaidId}</td>
                        <td className="px-4 py-3 text-sm text-slate-600">{dob}</td>
                        <td className="px-4 py-3 text-sm text-slate-600">{client.language || "English"}</td>
                        <td className="px-4 py-3 text-sm text-slate-600">{householdDisplay}</td>
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
    </AdminLayout>
  );
}
