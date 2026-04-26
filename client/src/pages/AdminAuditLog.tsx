import { useState } from "react";
import { Link } from "wouter";
import AdminLayout from "@/components/AdminLayout";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollText, ChevronLeft, ChevronRight, Search, RefreshCw } from "lucide-react";

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  stage_changed:         { label: "Stage Changed",         color: "bg-blue-100 text-blue-800" },
  assessment_completed:  { label: "Assessment Completed",  color: "bg-green-100 text-green-800" },
  assessment_incomplete: { label: "Assessment Incomplete", color: "bg-yellow-100 text-yellow-800" },
  scn_edited:            { label: "SCN Edited",            color: "bg-purple-100 text-purple-800" },
  notes_edited:          { label: "Notes Edited",          color: "bg-orange-100 text-orange-800" },
  client_deleted:        { label: "Client Deleted",        color: "bg-red-100 text-red-800" },
  client_approved:       { label: "Client Approved",       color: "bg-emerald-100 text-emerald-800" },
  client_rejected:       { label: "Client Rejected",       color: "bg-rose-100 text-rose-800" },
};

const PAGE_SIZE = 25;

export default function AdminAuditLog() {
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [searchText, setSearchText] = useState("");
  const [searchInput, setSearchInput] = useState("");

  const { data, isLoading, refetch } = trpc.auditLog.list.useQuery(
    { page, pageSize: PAGE_SIZE, action: actionFilter !== "all" ? actionFilter : undefined },
    { keepPreviousData: true } as any
  );

  const rows = (data?.rows ?? []) as any[];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const filtered = searchText
    ? rows.filter((r: any) =>
        (r.actorName ?? "").toLowerCase().includes(searchText.toLowerCase()) ||
        (r.clientName ?? "").toLowerCase().includes(searchText.toLowerCase())
      )
    : rows;

  function handleSearch() { setSearchText(searchInput); setPage(1); }
  function handleActionChange(val: string) { setActionFilter(val); setPage(1); }

  function formatDetails(action: string, details: unknown): string {
    if (!details || typeof details !== "object") return "";
    const d = details as Record<string, unknown>;
    if (action === "stage_changed") return String(d.from ?? "—") + " → " + String(d.to ?? "—");
    if (action === "client_rejected" && d.reason) return "Reason: " + String(d.reason);
    return JSON.stringify(details);
  }

  return (
    <AdminLayout>
      <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ScrollText className="h-6 w-6 text-green-700" />
            <div>
              <h1 className="text-2xl font-bold text-slate-800">Audit Log</h1>
              <p className="text-sm text-slate-500">Immutable record of every admin action on client records</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
        </div>

        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex flex-wrap gap-3 items-end">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-600">Action Type</label>
                <Select value={actionFilter} onValueChange={handleActionChange}>
                  <SelectTrigger className="w-52"><SelectValue placeholder="All actions" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Actions</SelectItem>
                    {Object.entries(ACTION_LABELS).map(([key, { label }]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
                <label className="text-xs font-medium text-slate-600">Search Staff / Client</label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Staff name or client name…"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    className="flex-1"
                  />
                  <Button size="sm" onClick={handleSearch} className="gap-1 bg-green-700 hover:bg-green-800 text-white">
                    <Search className="h-4 w-4" /> Search
                  </Button>
                </div>
              </div>
              <div className="text-sm text-slate-500 self-end pb-1">
                {total.toLocaleString()} event{total !== 1 ? "s" : ""}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Events</CardTitle></CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 text-center text-slate-400">Loading…</div>
            ) : filtered.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                No audit events found. Events will appear here as staff take actions on client records.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-slate-50 text-slate-600">
                      <th className="text-left px-4 py-3 font-medium w-40">Timestamp</th>
                      <th className="text-left px-4 py-3 font-medium w-44">Action</th>
                      <th className="text-left px-4 py-3 font-medium w-40">Staff Member</th>
                      <th className="text-left px-4 py-3 font-medium">Client</th>
                      <th className="text-left px-4 py-3 font-medium">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((row: any, i: number) => {
                      const meta = ACTION_LABELS[row.action] ?? { label: row.action, color: "bg-slate-100 text-slate-700" };
                      const details = formatDetails(row.action, row.details);
                      return (
                        <tr key={row.id} className={"border-b last:border-0 hover:bg-slate-50 transition-colors " + (i % 2 === 0 ? "" : "bg-slate-50/40")}>
                          <td className="px-4 py-3 text-slate-500 whitespace-nowrap text-xs">
                            {new Date(row.createdAt).toLocaleString()}
                          </td>
                          <td className="px-4 py-3">
                            <span className={"inline-flex items-center px-2 py-0.5 rounded text-xs font-medium " + meta.color}>
                              {meta.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-700">
                            {row.actorName ?? <span className="text-slate-400 italic">System</span>}
                          </td>
                          <td className="px-4 py-3">
                            {row.clientId ? (
                              <Link href={"/admin/clients/" + row.clientId}>
                                <span className="text-green-700 hover:underline cursor-pointer font-medium">
                                  {row.clientName ?? "Client #" + row.clientId}
                                </span>
                              </Link>
                            ) : (
                              <span className="text-slate-400 italic">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-slate-600 text-xs">
                            {details || <span className="text-slate-400">—</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {totalPages > 1 && (
          <div className="flex items-center justify-between text-sm text-slate-600">
            <span>Page {page} of {totalPages} ({total.toLocaleString()} total events)</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="gap-1">
                <ChevronLeft className="h-4 w-4" /> Previous
              </Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="gap-1">
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
