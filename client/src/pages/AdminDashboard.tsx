import AdminLayout from "@/components/AdminLayout";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Users, UserPlus, ClipboardCheck, AlertTriangle, TrendingUp,
  ArrowRight, Clock, Loader2
} from "lucide-react";
import { Link } from "wouter";

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
  on_hold: "bg-slate-100 text-slate-700",
};

export default function AdminDashboard() {
  const { data: stats, isLoading: statsLoading } = trpc.admin.stats.useQuery();
  const { data: taskStats } = trpc.admin.taskStats.useQuery();
  const { data: recentClients } = trpc.admin.recentClients.useQuery({ days: 7, limit: 8 });
  const { data: addedThisWeek } = trpc.admin.addedCount.useQuery({ days: 7 });

  const totalClients = (stats as any)?.total ?? 0;
  const stages = (stats as any)?.stages ?? {};
  const openTasks = taskStats?.open ?? 0;

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-500 text-sm mt-1">Overview of your SCN client management</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Total Clients</p>
                  <p className="text-3xl font-bold text-slate-900 mt-1">
                    {statsLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : totalClients}
                  </p>
                </div>
                <div className="h-12 w-12 rounded-xl bg-blue-50 flex items-center justify-center">
                  <Users className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">New This Week</p>
                  <p className="text-3xl font-bold text-slate-900 mt-1">{addedThisWeek ?? 0}</p>
                </div>
                <div className="h-12 w-12 rounded-xl bg-emerald-50 flex items-center justify-center">
                  <UserPlus className="h-6 w-6 text-emerald-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Open Tasks</p>
                  <p className="text-3xl font-bold text-slate-900 mt-1">{openTasks}</p>
                </div>
                <div className="h-12 w-12 rounded-xl bg-amber-50 flex items-center justify-center">
                  <ClipboardCheck className="h-6 w-6 text-amber-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Flagged</p>
                  <p className="text-3xl font-bold text-slate-900 mt-1">{stages.flagged ?? 0}</p>
                </div>
                <div className="h-12 w-12 rounded-xl bg-red-50 flex items-center justify-center">
                  <AlertTriangle className="h-6 w-6 text-red-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Stage Pipeline */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Client Pipeline</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {Object.entries(STAGE_LABELS).map(([key, { label, color }]) => (
                <Link key={key} href={`/admin/clients?stage=${key}`}>
                  <div className="min-w-[140px] p-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer border border-slate-200">
                    <Badge className={`${color} text-[10px] font-medium px-1.5 py-0 mb-2`}>{label}</Badge>
                    <p className="text-2xl font-bold text-slate-900">{stages[key] ?? 0}</p>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Clients */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-base font-semibold">Recent Clients</CardTitle>
            <Link href="/admin/clients">
              <Button variant="ghost" size="sm" className="text-emerald-600 hover:text-emerald-700">
                View All <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {!recentClients ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
            ) : recentClients.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-8">No recent clients</p>
            ) : (
              <div className="space-y-2">
                {recentClients.map((client) => (
                  <Link key={client.id} href={`/admin/clients/${client.id}`}>
                    <div className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-medium text-sm">
                          {client.firstName?.[0]}{client.lastName?.[0]}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-900">{client.firstName} {client.lastName}</p>
                          <p className="text-xs text-slate-500">{client.medicaidId} &middot; {client.supermarket}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={`${STAGE_LABELS[client.stage]?.color ?? "bg-slate-100 text-slate-700"} text-[10px]`}>
                          {STAGE_LABELS[client.stage]?.label ?? client.stage}
                        </Badge>
                        <Badge className={`${STATUS_COLORS[client.status] ?? "bg-slate-100"} text-[10px]`}>
                          {client.status.replace("_", " ")}
                        </Badge>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Link href="/admin/clients?stage=referral">
            <Card className="border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-900">New Referrals</p>
                  <p className="text-xs text-slate-500">{stages.referral ?? 0} pending assessment</p>
                </div>
              </CardContent>
            </Card>
          </Link>
          <Link href="/admin/tasks">
            <Card className="border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="h-10 w-10 rounded-lg bg-amber-50 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-900">Open Tasks</p>
                  <p className="text-xs text-slate-500">{openTasks} tasks need attention</p>
                </div>
              </CardContent>
            </Card>
          </Link>
          <Link href="/admin/documents">
            <Card className="border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="h-10 w-10 rounded-lg bg-purple-50 flex items-center justify-center">
                  <ClipboardCheck className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-900">Document Library</p>
                  <p className="text-xs text-slate-500">Manage templates & forms</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>
    </AdminLayout>
  );
}
