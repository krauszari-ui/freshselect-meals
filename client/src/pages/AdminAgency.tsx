import AdminLayout from "@/components/AdminLayout";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, Loader2, Building2 } from "lucide-react";

const STAGE_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  referral: { label: "Referral", color: "text-blue-700", bg: "bg-blue-500" },
  assessment: { label: "Assessment", color: "text-amber-700", bg: "bg-amber-500" },
  level_one_only: { label: "Level 1 Only", color: "text-purple-700", bg: "bg-purple-500" },
  level_one_household: { label: "Level 1 Household", color: "text-indigo-700", bg: "bg-indigo-500" },
  level_2_active: { label: "Level 2 Active", color: "text-emerald-700", bg: "bg-emerald-500" },
  ineligible: { label: "Ineligible", color: "text-red-700", bg: "bg-red-500" },
  provider_attestation_required: { label: "Provider Attestation", color: "text-orange-700", bg: "bg-orange-500" },
  flagged: { label: "Flagged", color: "text-rose-700", bg: "bg-rose-500" },
};

const SUPERMARKETS = ["Foodoo", "Rosemary Kosher Supermarket", "Chestnut Supermarket", "Central Market"];

export default function AdminAgency() {
  const { data: stats, isLoading } = trpc.admin.stats.useQuery();
  const { data: addedThisWeek } = trpc.admin.addedCount.useQuery({ days: 7 });
  const { data: addedThisMonth } = trpc.admin.addedCount.useQuery({ days: 30 });
  const { data: taskStats } = trpc.admin.taskStats.useQuery();

  const exportCsvMutation = trpc.admin.exportCsv.useMutation({
    onSuccess: (data) => {
      const blob = new Blob([data.csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `freshselect-agency-report-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
  });

  const total = (stats as any)?.total ?? 0;
  const stages = (stats as any)?.stages ?? {};
  const supermarkets = (stats as any)?.supermarkets ?? {};

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Agency Overview</h1>
            <p className="text-slate-500 text-sm mt-1">FreshSelect Meals SCN Program Analytics</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportCsvMutation.mutate({})}
            disabled={exportCsvMutation.isPending}
            className="gap-1.5"
          >
            {exportCsvMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Export Report
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-5 text-center">
              <p className="text-3xl font-bold text-slate-900">{isLoading ? "..." : total}</p>
              <p className="text-sm text-slate-500 mt-1">Total Clients</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-5 text-center">
              <p className="text-3xl font-bold text-emerald-600">{addedThisWeek ?? 0}</p>
              <p className="text-sm text-slate-500 mt-1">Added This Week</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-5 text-center">
              <p className="text-3xl font-bold text-blue-600">{addedThisMonth ?? 0}</p>
              <p className="text-sm text-slate-500 mt-1">Added This Month</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-5 text-center">
              <p className="text-3xl font-bold text-amber-600">{taskStats?.open ?? 0}</p>
              <p className="text-sm text-slate-500 mt-1">Open Tasks</p>
            </CardContent>
          </Card>
        </div>

        {/* Stage Breakdown */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Client Stage Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(STAGE_LABELS).map(([key, { label, color, bg }]) => {
                const count = stages[key] ?? 0;
                const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                return (
                  <div key={key} className="flex items-center gap-3">
                    <div className="w-40 text-sm font-medium text-slate-700 shrink-0">{label}</div>
                    <div className="flex-1 h-7 bg-slate-100 rounded-full overflow-hidden relative">
                      <div
                        className={`h-full ${bg} rounded-full transition-all duration-500`}
                        style={{ width: `${Math.max(pct, 1)}%` }}
                      />
                      <span className="absolute inset-0 flex items-center justify-center text-xs font-medium text-slate-700">
                        {count} ({pct}%)
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Supermarket Distribution */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Supermarket Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {SUPERMARKETS.map((name) => {
                const count = supermarkets[name] ?? 0;
                const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                return (
                  <div key={name} className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-slate-500" />
                        <span className="text-sm font-medium text-slate-700">{name}</span>
                      </div>
                      <Badge variant="secondary" className="text-xs">{count} clients</Badge>
                    </div>
                    <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                        style={{ width: `${Math.max(pct, 2)}%` }}
                      />
                    </div>
                    <p className="text-xs text-slate-500 mt-1">{pct}% of total</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Task Summary */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Task Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="text-center p-3 rounded-lg bg-amber-50">
                <p className="text-2xl font-bold text-amber-700">{taskStats?.open ?? 0}</p>
                <p className="text-xs text-amber-600">Open</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-blue-50">
                <p className="text-2xl font-bold text-blue-700">{taskStats?.inProgress ?? 0}</p>
                <p className="text-xs text-blue-600">In Progress</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-emerald-50">
                <p className="text-2xl font-bold text-emerald-700">{taskStats?.completed ?? 0}</p>
                <p className="text-xs text-emerald-600">Completed</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-red-50">
                <p className="text-2xl font-bold text-red-700">{taskStats?.overdue ?? 0}</p>
                <p className="text-xs text-red-600">Overdue</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
