import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock,
  Download,
  Eye,
  Loader2,
  LogOut,
  PauseCircle,
  RefreshCw,
  Search,
  ShieldCheck,
  Store,
  Users,
  UserCog,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";

type StatusKey = "all" | "new" | "in_review" | "approved" | "rejected" | "on_hold";
type SupermarketKey = "all" | "Foodoo" | "Rosemary Kosher Supermarket" | "Chestnut Supermarket" | "Central Market";

const STATUS_CONFIG: Record<
  Exclude<StatusKey, "all">,
  { label: string; color: string; icon: React.ReactNode }
> = {
  new: {
    label: "New",
    color: "bg-blue-100 text-blue-700 border-blue-200",
    icon: <ClipboardList className="w-3 h-3" />,
  },
  in_review: {
    label: "In Review",
    color: "bg-amber-100 text-amber-700 border-amber-200",
    icon: <Clock className="w-3 h-3" />,
  },
  approved: {
    label: "Approved",
    color: "bg-green-100 text-green-700 border-green-200",
    icon: <CheckCircle2 className="w-3 h-3" />,
  },
  rejected: {
    label: "Rejected",
    color: "bg-red-100 text-red-700 border-red-200",
    icon: <XCircle className="w-3 h-3" />,
  },
  on_hold: {
    label: "On Hold",
    color: "bg-gray-100 text-gray-700 border-gray-200",
    icon: <PauseCircle className="w-3 h-3" />,
  },
};

function StatusBadge({ status }: { status: Exclude<StatusKey, "all"> }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.color}`}
    >
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

export default function AdminDashboard() {
  const { user, loading, logout } = useAuth();
  const [, navigate] = useLocation();

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusKey>("all");
  const [supermarketFilter, setSupermarketFilter] = useState<SupermarketKey>("all");
  const [page, setPage] = useState(1);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [search]);

  // Redirect if not admin
  useEffect(() => {
    if (!loading && !user) navigate("/admin");
    if (!loading && user && user.role !== "admin") navigate("/admin");
  }, [user, loading, navigate]);

  const statsQuery = trpc.admin.stats.useQuery(undefined, {
    refetchInterval: 30000,
  });
  const listQuery = trpc.admin.list.useQuery({
    search: debouncedSearch || undefined,
    status: statusFilter,
    supermarket: supermarketFilter === "all" ? undefined : supermarketFilter,
    page,
    pageSize: 15,
  });

  const exportCsvMutation = trpc.admin.exportCsv.useMutation({
    onSuccess: (data) => {
      const blob = new Blob([data.csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `freshselect-submissions-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
  });

  type ListData = {
    rows: {
      id: number;
      referenceNumber: string;
      firstName: string;
      lastName: string;
      email: string;
      cellPhone: string;
      medicaidId: string;
      supermarket: string;
      referralSource: string | null;
      status: "new" | "in_review" | "approved" | "rejected" | "on_hold";
      adminNotes: string | null;
      formData: unknown;
      hipaaConsentAt: Date;
      clickupTaskId: string | null;
      createdAt: Date;
      updatedAt: Date;
    }[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };

  const listData = listQuery.data as ListData | undefined;
  const stats = statsQuery.data;

  const statCards = useMemo(
    () => [
      {
        label: "Total Applications",
        value: stats?.total ?? 0,
        icon: <Users className="w-5 h-5" />,
        color: "text-primary",
        bg: "bg-primary/10",
      },
      {
        label: "New",
        value: stats?.new ?? 0,
        icon: <ClipboardList className="w-5 h-5" />,
        color: "text-blue-600",
        bg: "bg-blue-50",
      },
      {
        label: "In Review",
        value: stats?.in_review ?? 0,
        icon: <Clock className="w-5 h-5" />,
        color: "text-amber-600",
        bg: "bg-amber-50",
      },
      {
        label: "Approved",
        value: stats?.approved ?? 0,
        icon: <CheckCircle2 className="w-5 h-5" />,
        color: "text-green-600",
        bg: "bg-green-50",
      },
    ],
    [stats]
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Top Nav */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-border/50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <ShieldCheck className="w-4 h-4 text-primary-foreground" />
            </div>
            <div>
              <span className="font-semibold text-foreground text-sm">FreshSelect Admin</span>
              <span className="hidden sm:inline text-xs text-muted-foreground ml-2">
                — Applications Dashboard
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/admin/workers" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
              <UserCog className="w-4 h-4" />
              <span className="hidden sm:inline">Workers</span>
            </Link>
            <span className="hidden sm:block text-xs text-muted-foreground">
              {user?.name || user?.email}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => logout().then(() => navigate("/admin"))}
              className="text-muted-foreground hover:text-foreground gap-1.5"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Sign Out</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {statCards.map((card) => (
            <Card key={card.label} className="border-border/50">
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg ${card.bg} flex items-center justify-center flex-shrink-0`}>
                  <span className={card.color}>{card.icon}</span>
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{card.value}</p>
                  <p className="text-xs text-muted-foreground">{card.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Submissions Table */}
        <Card className="border-border/50">
          <CardHeader className="pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <CardTitle className="text-base font-semibold">Applications</CardTitle>
              <div className="flex items-center gap-2 self-start sm:self-auto">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    exportCsvMutation.mutate({
                      status: statusFilter !== "all" ? statusFilter : undefined,
                      supermarket: supermarketFilter !== "all" ? supermarketFilter : undefined,
                    });
                  }}
                  disabled={exportCsvMutation.isPending}
                  className="gap-1.5"
                >
                  {exportCsvMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  Export CSV
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => listQuery.refetch()}
                  className="gap-1.5 text-muted-foreground"
                >
                  <RefreshCw className={`w-4 h-4 ${listQuery.isFetching ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
              </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3 mt-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, email, Medicaid ID, or ref #..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 h-9 text-sm"
                />
              </div>
              <Select
                value={statusFilter}
                onValueChange={(v) => { setStatusFilter(v as StatusKey); setPage(1); }}
              >
                <SelectTrigger className="w-full sm:w-40 h-9 text-sm">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="in_review">In Review</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="on_hold">On Hold</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={supermarketFilter}
                onValueChange={(v) => { setSupermarketFilter(v as SupermarketKey); setPage(1); }}
              >
                <SelectTrigger className="w-full sm:w-48 h-9 text-sm">
                  <SelectValue placeholder="All Supermarkets" />
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
          </CardHeader>

          <CardContent className="p-0">
            {listQuery.isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : listData?.rows.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <ClipboardList className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No applications found</p>
                <p className="text-sm mt-1">
                  {debouncedSearch || statusFilter !== "all" || supermarketFilter !== "all"
                    ? "Try adjusting your filters"
                    : "Applications will appear here once submitted"}
                </p>
              </div>
            ) : (
              <>
                {/* Desktop Table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/50 bg-muted/30">
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Ref #</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Applicant</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Supermarket</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Submitted</th>
                        <th className="text-right px-4 py-3 font-medium text-muted-foreground">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {listData?.rows.map((row) => (
                        <tr
                          key={row.id}
                          className="border-b border-border/30 hover:bg-muted/20 transition-colors"
                        >
                          <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                            {row.referenceNumber}
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-medium text-foreground">
                              {row.firstName} {row.lastName}
                            </div>
                            <div className="text-xs text-muted-foreground">{row.email}</div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                              <Store className="w-3.5 h-3.5" />
                              <span className="text-xs">{row.supermarket}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge status={row.status} />
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">
                            {new Date(row.createdAt).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => navigate(`/admin/application/${row.id}`)}
                              className="gap-1.5 h-7 text-xs"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              View
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Cards */}
                <div className="md:hidden divide-y divide-border/30">
                  {listData?.rows.map((row) => (
                    <div key={row.id} className="p-4 hover:bg-muted/20 transition-colors">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-foreground">
                              {row.firstName} {row.lastName}
                            </span>
                            <StatusBadge status={row.status} />
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {row.email} · Ref: {row.referenceNumber}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {row.supermarket} ·{" "}
                            {new Date(row.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigate(`/admin/application/${row.id}`)}
                          className="gap-1 h-8 text-xs flex-shrink-0"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          View
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Pagination */}
                {listData && listData.totalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t border-border/30">
                    <span className="text-xs text-muted-foreground">
                      Showing {(page - 1) * 15 + 1}–
                      {Math.min(page * 15, listData.total)} of {listData.total}
                    </span>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="h-7 w-7 p-0"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <span className="text-xs text-muted-foreground">
                        {page} / {listData.totalPages}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setPage((p) => Math.min(listData.totalPages, p + 1))}
                        disabled={page === listData.totalPages}
                        className="h-7 w-7 p-0"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
