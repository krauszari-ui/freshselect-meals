import { trpc } from "@/lib/trpc";
import AdminLayout from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, Users, BarChart3, Store, MapPin, Layers, RefreshCw, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

const STAGE_LABELS: Record<string, string> = {
  referral: "Referral",
  assessment: "Assessment",
  active: "Active",
  inactive: "Inactive",
  ineligible: "Ineligible",
  waitlist: "Waitlist",
  pending: "Pending",
};

const STAGE_COLORS: Record<string, string> = {
  referral: "bg-blue-500",
  assessment: "bg-amber-500",
  active: "bg-emerald-500",
  inactive: "bg-slate-400",
  ineligible: "bg-red-400",
  waitlist: "bg-purple-400",
  pending: "bg-orange-400",
};

function CompletionRow({
  label,
  total,
  completed,
  pending,
  color = "bg-emerald-500",
}: {
  label: string;
  total: number;
  completed: number;
  pending: number;
  color?: string;
}) {
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-slate-100 last:border-0">
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-medium text-slate-800 truncate">{label}</span>
          <span className="text-xs text-slate-500 ml-2 shrink-0">{completed}/{total}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
            <div
              className={`h-2 rounded-full transition-all ${color}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-xs font-semibold text-slate-600 w-10 text-right">{pct}%</span>
        </div>
      </div>
      <div className="flex gap-1.5 shrink-0">
        <Badge variant="outline" className="text-xs h-5 px-1.5 border-emerald-200 text-emerald-700 bg-emerald-50">
          <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />{completed}
        </Badge>
        <Badge variant="outline" className="text-xs h-5 px-1.5 border-amber-200 text-amber-700 bg-amber-50">
          <Clock className="h-2.5 w-2.5 mr-0.5" />{pending}
        </Badge>
      </div>
    </div>
  );
}

export default function AdminAssessmentReport() {
  const { data, isLoading, isError, error, refetch } = trpc.admin.assessmentReport.useQuery();

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="p-6 space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-48 bg-slate-100 rounded-xl animate-pulse" />
          ))}
        </div>
      </AdminLayout>
    );
  }

  if (isError) {
    return (
      <AdminLayout>
        <div className="p-6 flex flex-col items-center justify-center min-h-[300px] gap-4">
          <AlertCircle className="h-10 w-10 text-red-400" />
          <div className="text-center">
            <p className="text-slate-700 font-medium">Failed to load assessment report</p>
            <p className="text-sm text-slate-500 mt-1">{(error as any)?.message || "An error occurred"}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
            <RefreshCw className="h-4 w-4" /> Retry
          </Button>
        </div>
      </AdminLayout>
    );
  }

  if (!data) return <AdminLayout><div className="p-6 text-slate-500">No data available</div></AdminLayout>;

  const { grandTotal, grandCompleted, grandPending, byStage, byVendor, byNeighborhood } = data;
  const grandPct = grandTotal > 0 ? Math.round((grandCompleted / grandTotal) * 100) : 0;

  return (
    <AdminLayout>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-emerald-600" />
            Assessment Completion Report
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Overview of SCN screening assessment completion across all clients
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="border-slate-200">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center">
                  <Users className="h-5 w-5 text-slate-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-slate-900">{grandTotal}</div>
                  <div className="text-xs text-slate-500">Total Clients</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-emerald-200 bg-emerald-50/50">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-emerald-700">{grandCompleted}</div>
                  <div className="text-xs text-emerald-600">Assessments Completed</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-amber-200 bg-amber-50/50">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-amber-700">{grandPending}</div>
                  <div className="text-xs text-amber-600">Pending Assessment</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Overall Progress Bar */}
        <Card className="border-slate-200">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-slate-700">Overall Completion Rate</span>
              <span className="text-lg font-bold text-emerald-600">{grandPct}%</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
              <div
                className="h-3 rounded-full bg-emerald-500 transition-all"
                style={{ width: `${grandPct}%` }}
              />
            </div>
            <div className="flex justify-between mt-1.5 text-xs text-slate-400">
              <span>{grandCompleted} completed</span>
              <span>{grandPending} pending</span>
            </div>
          </CardContent>
        </Card>

        {/* By Stage */}
        <Card className="border-slate-200">
          <CardHeader className="pb-2 pt-4 px-5">
            <CardTitle className="text-base font-semibold text-slate-800 flex items-center gap-2">
              <Layers className="h-4 w-4 text-blue-500" />
              By Stage
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-4">
            {Object.entries(byStage)
              .sort((a, b) => b[1].total - a[1].total)
              .map(([stage, counts]) => (
                <CompletionRow
                  key={stage}
                  label={STAGE_LABELS[stage] || stage}
                  total={counts.total}
                  completed={counts.completed}
                  pending={counts.pending}
                  color={STAGE_COLORS[stage] || "bg-slate-400"}
                />
              ))}
          </CardContent>
        </Card>

        {/* By Vendor */}
        <Card className="border-slate-200">
          <CardHeader className="pb-2 pt-4 px-5">
            <CardTitle className="text-base font-semibold text-slate-800 flex items-center gap-2">
              <Store className="h-4 w-4 text-purple-500" />
              By Vendor / Supermarket
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-4">
            {Object.entries(byVendor)
              .sort((a, b) => b[1].total - a[1].total)
              .map(([vendor, counts]) => (
                <CompletionRow
                  key={vendor}
                  label={vendor}
                  total={counts.total}
                  completed={counts.completed}
                  pending={counts.pending}
                  color="bg-purple-500"
                />
              ))}
          </CardContent>
        </Card>

        {/* By Neighborhood */}
        <Card className="border-slate-200">
          <CardHeader className="pb-2 pt-4 px-5">
            <CardTitle className="text-base font-semibold text-slate-800 flex items-center gap-2">
              <MapPin className="h-4 w-4 text-rose-500" />
              By Neighborhood
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-4">
            {Object.entries(byNeighborhood)
              .sort((a, b) => b[1].total - a[1].total)
              .map(([hood, counts]) => (
                <CompletionRow
                  key={hood}
                  label={hood}
                  total={counts.total}
                  completed={counts.completed}
                  pending={counts.pending}
                  color="bg-rose-500"
                />
              ))}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
