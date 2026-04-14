import AdminLayout from "@/components/AdminLayout";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Search, ChevronLeft, ChevronRight, Loader2, Download, RefreshCw, Eye
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useSearch } from "wouter";

const STAGE_LABELS: Record<string, { label: string; color: string }> = {
  referral: { label: "Referral", color: "bg-blue-100 text-blue-700" },
  assessment: { label: "Assessment", color: "bg-amber-100 text-amber-700" },
  level_one_only: { label: "Level 1 Only", color: "bg-purple-100 text-purple-700" },
  level_one_household: { label: "Level 1 Household", color: "bg-indigo-100 text-indigo-700" },
  level_2_active: { label: "Level 2 Active", color: "bg-emerald-100 text-emerald-700" },
  ineligible: { label: "Ineligible", color: "bg-red-100 text-red-700" },
  provider_attestation_required: { label: "Provider Attestation", color: "bg-orange-100 text-orange-700" },
  flagged: { label: "Flagged", color: "bg-rose-100 text-rose-700" },
};

const STATUS_COLORS: Record<string, string> = {
  new: "bg-blue-100 text-blue-700",
  in_review: "bg-amber-100 text-amber-700",
  approved: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-700",
  on_hold: "bg-slate-200 text-slate-700",
};

export default function AdminClients() {
  const searchParams = useSearch();
  const urlParams = new URLSearchParams(searchParams);
  const initialStage = urlParams.get("stage") || "all";

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [stageFilter, setStageFilter] = useState(initialStage);
  const [supermarketFilter, setSupermarketFilter] = useState("all");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [search]);

  const listQuery = trpc.admin.list.useQuery({
    search: debouncedSearch || undefined,
    status: statusFilter as any,
    stage: stageFilter !== "all" ? stageFilter : undefined,
    supermarket: supermarketFilter !== "all" ? supermarketFilter : undefined,
    page,
    pageSize: 20,
  });

  const exportCsvMutation = trpc.admin.exportCsv.useMutation({
    onSuccess: (data) => {
      const blob = new Blob([data.csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `freshselect-clients-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
  });

  const listData = listQuery.data as any;
  const rows = listData?.rows ?? [];
  const totalPages = listData?.totalPages ?? 1;

  return (
    <AdminLayout>
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Clients</h1>
            <p className="text-slate-500 text-sm mt-1">{listData?.total ?? 0} total clients</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline" size="sm"
              onClick={() => exportCsvMutation.mutate({
                status: statusFilter !== "all" ? statusFilter : undefined,
                supermarket: supermarketFilter !== "all" ? supermarketFilter : undefined,
              })}
              disabled={exportCsvMutation.isPending}
              className="gap-1.5"
            >
              {exportCsvMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Export
            </Button>
            <Button variant="ghost" size="sm" onClick={() => listQuery.refetch()} className="gap-1.5 text-slate-500">
              <RefreshCw className={`h-4 w-4 ${listQuery.isFetching ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search by name, email, Medicaid ID..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 h-9 text-sm"
                />
              </div>
              <Select value={stageFilter} onValueChange={(v) => { setStageFilter(v); setPage(1); }}>
                <SelectTrigger className="w-[160px] h-9 text-sm">
                  <SelectValue placeholder="Stage" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Stages</SelectItem>
                  {Object.entries(STAGE_LABELS).map(([key, { label }]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
                <SelectTrigger className="w-[140px] h-9 text-sm">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="in_review">In Review</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="on_hold">On Hold</SelectItem>
                </SelectContent>
              </Select>
              <Select value={supermarketFilter} onValueChange={(v) => { setSupermarketFilter(v); setPage(1); }}>
                <SelectTrigger className="w-[180px] h-9 text-sm">
                  <SelectValue placeholder="Supermarket" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Supermarkets</SelectItem>
                  <SelectItem value="Foodoo">Foodoo</SelectItem>
                  <SelectItem value="Rosemary Kosher Supermarket">Rosemary Kosher</SelectItem>
                  <SelectItem value="Chestnut Supermarket">Chestnut</SelectItem>
                  <SelectItem value="Central Market">Central Market</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Client Table */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-0">
            {listQuery.isLoading ? (
              <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-slate-400" /></div>
            ) : rows.length === 0 ? (
              <div className="text-center py-16 text-slate-500">
                <p className="text-sm">No clients found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="text-left text-xs font-medium text-slate-500 px-4 py-3">Client</th>
                      <th className="text-left text-xs font-medium text-slate-500 px-4 py-3">Medicaid ID</th>
                      <th className="text-left text-xs font-medium text-slate-500 px-4 py-3">Supermarket</th>
                      <th className="text-left text-xs font-medium text-slate-500 px-4 py-3">Stage</th>
                      <th className="text-left text-xs font-medium text-slate-500 px-4 py-3">Status</th>
                      <th className="text-left text-xs font-medium text-slate-500 px-4 py-3">Date</th>
                      <th className="text-right text-xs font-medium text-slate-500 px-4 py-3">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((client: any) => (
                      <tr key={client.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-medium text-xs shrink-0">
                              {client.firstName?.[0]}{client.lastName?.[0]}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-slate-900">{client.firstName} {client.lastName}</p>
                              <p className="text-xs text-slate-500">{client.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600 font-mono">{client.medicaidId}</td>
                        <td className="px-4 py-3 text-sm text-slate-600">{client.supermarket}</td>
                        <td className="px-4 py-3">
                          <Badge className={`${STAGE_LABELS[client.stage]?.color ?? "bg-slate-100 text-slate-700"} text-[10px]`}>
                            {STAGE_LABELS[client.stage]?.label ?? client.stage}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <Badge className={`${STATUS_COLORS[client.status] ?? "bg-slate-100"} text-[10px]`}>
                            {client.status.replace("_", " ")}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500">
                          {new Date(client.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link href={`/admin/clients/${client.id}`}>
                            <Button variant="ghost" size="sm" className="gap-1 text-emerald-600 hover:text-emerald-700">
                              <Eye className="h-3.5 w-3.5" /> View
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200">
                <p className="text-xs text-slate-500">
                  Page {page} of {totalPages} ({listData?.total ?? 0} clients)
                </p>
                <div className="flex gap-1">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
