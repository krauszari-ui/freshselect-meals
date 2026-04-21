import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, Search, LogOut, ClipboardList } from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function AssessorPortal() {
  const { user, loading, logout } = useAuth();
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [confirmName, setConfirmName] = useState("");

  const { data: clients, isLoading, refetch } = trpc.admin.assessorList.useQuery(
    { search: search || undefined },
    { enabled: !!user }
  );

  const approveClientMutation = trpc.admin.approveClient.useMutation({
    onSuccess: () => {
      toast.success("Client approved successfully");
      refetch();
      setConfirmId(null);
    },
    onError: (err) => toast.error(err.message),
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  if (!user || (user.role !== "assessor" && user.role !== "admin" && user.role !== "super_admin")) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="text-center">
          <p className="text-slate-500 mb-4">Access denied. Assessor login required.</p>
          <Button onClick={() => navigate("/admin/login")}>Go to Login</Button>
        </div>
      </div>
    );
  }

  const rows = (clients as any[]) || [];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-emerald-500 flex items-center justify-center">
            <ClipboardList className="h-4 w-4 text-white" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-slate-900">Assessor Portal</h1>
            <p className="text-xs text-slate-500">FreshSelect Meals — Assessment Review</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-600">{user.name}</span>
          <Button variant="outline" size="sm" onClick={logout} className="gap-1.5 text-xs">
            <LogOut className="h-3.5 w-3.5" /> Sign Out
          </Button>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-slate-900 mb-1">Clients Pending Approval</h2>
          <p className="text-sm text-slate-500">
            These clients have completed their SCN assessment and are awaiting your approval.
          </p>
        </div>

        {/* Search */}
        <div className="relative mb-5 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            className="pl-9"
            placeholder="Search by name or CIN..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : rows.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <CheckCircle2 className="h-10 w-10 text-emerald-400 mx-auto mb-3" />
            <p className="text-slate-600 font-medium">No clients pending approval</p>
            <p className="text-sm text-slate-400 mt-1">All assessment-completed clients have been reviewed.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Client</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">CIN / Medicaid ID</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Assessment Completed</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((client: any) => (
                  <tr key={client.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3.5">
                      <Link href={`/admin/clients/${client.id}`}>
                        <span className="font-medium text-slate-900 hover:text-emerald-600 cursor-pointer">
                          {client.firstName} {client.lastName}
                        </span>
                      </Link>
                      {client.cellPhone && (
                        <p className="text-xs text-slate-400 mt-0.5">{client.cellPhone}</p>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-slate-600">
                      {client.medicaidId || "—"}
                    </td>
                    <td className="px-5 py-3.5 text-slate-500 text-xs">
                      {client.assessmentCompletedAt
                        ? new Date(client.assessmentCompletedAt).toLocaleDateString("en-US", {
                            month: "short", day: "numeric", year: "numeric",
                          })
                        : "—"}
                    </td>
                    <td className="px-5 py-3.5">
                      {client.status === "approved" ? (
                        <Badge className="bg-emerald-100 text-emerald-700 text-xs">Approved</Badge>
                      ) : (
                        <Badge className="bg-amber-100 text-amber-700 text-xs">Pending Review</Badge>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      {client.status === "approved" ? (
                        <span className="text-xs text-emerald-600 flex items-center justify-end gap-1">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Approved
                        </span>
                      ) : (
                        <Button
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-7 px-3"
                          onClick={() => {
                            setConfirmId(client.id);
                            setConfirmName(`${client.firstName} ${client.lastName}`);
                          }}
                        >
                          Approve
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="text-xs text-slate-400 mt-4 text-center">
          Showing {rows.length} client{rows.length !== 1 ? "s" : ""} with completed assessments
        </p>
      </main>

      {/* Confirm Approve Dialog */}
      <AlertDialog open={confirmId !== null} onOpenChange={(open) => { if (!open) setConfirmId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve Client</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to approve <strong>{confirmName}</strong>? This will mark their status as Approved in the system.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={() => confirmId !== null && approveClientMutation.mutate({ id: confirmId })}
              disabled={approveClientMutation.isPending}
            >
              {approveClientMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Approve"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
