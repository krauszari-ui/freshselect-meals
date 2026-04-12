import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Leaf,
  Users,
  Shield,
  ShieldCheck,
  ShieldX,
  UserPlus,
  Eye,
  Pencil,
  Download,
  ChevronLeft,
  ToggleLeft,
  ToggleRight,
  Trash2,
  Loader2,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { useState } from "react";

export default function AdminWorkers() {
  const { user, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const [showPromoteModal, setShowPromoteModal] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [permissions, setPermissions] = useState({ canView: true, canEdit: false, canExport: false });

  const workersQuery = trpc.admin.workers.list.useQuery();
  const allUsersQuery = trpc.admin.workers.allUsers.useQuery();
  const utils = trpc.useUtils();

  const promoteMutation = trpc.admin.workers.promote.useMutation({
    onSuccess: () => {
      toast.success("User promoted to worker");
      utils.admin.workers.list.invalidate();
      utils.admin.workers.allUsers.invalidate();
      setShowPromoteModal(false);
      setSelectedUserId(null);
    },
    onError: (err) => toast.error(err.message),
  });

  const updatePermsMutation = trpc.admin.workers.updatePermissions.useMutation({
    onSuccess: () => {
      toast.success("Permissions updated");
      utils.admin.workers.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const toggleActiveMutation = trpc.admin.workers.toggleActive.useMutation({
    onSuccess: () => {
      toast.success("Worker status updated");
      utils.admin.workers.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const demoteMutation = trpc.admin.workers.demote.useMutation({
    onSuccess: () => {
      toast.success("Worker removed");
      utils.admin.workers.list.invalidate();
      utils.admin.workers.allUsers.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <Loader2 className="w-8 h-8 animate-spin text-green-700" />
      </div>
    );
  }

  if (!user || user.role !== "admin") {
    navigate("/admin");
    return null;
  }

  const workers = workersQuery.data ?? [];
  const allUsers = allUsersQuery.data ?? [];
  const nonWorkerUsers = allUsers.filter(
    (u) => u.role === "user" && u.id !== user.id
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-50 to-white">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-stone-200 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-700 rounded-xl flex items-center justify-center">
              <Leaf className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-green-800 font-serif">Worker Management</h1>
              <p className="text-xs text-stone-500">Manage staff access and permissions</p>
            </div>
          </div>
          <Link href="/admin/dashboard" className="flex items-center gap-1 text-sm text-stone-600 hover:text-green-700">
            <ChevronLeft className="w-4 h-4" /> Back to Dashboard
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Add Worker Button */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-green-700" />
            <h2 className="text-xl font-bold text-stone-800 font-serif">
              Active Workers ({workers.length})
            </h2>
          </div>
          <Button
            onClick={() => setShowPromoteModal(true)}
            className="bg-green-700 hover:bg-green-800 text-white"
            disabled={nonWorkerUsers.length === 0}
          >
            <UserPlus className="w-4 h-4 mr-2" /> Add Worker
          </Button>
        </div>

        {nonWorkerUsers.length === 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6 text-sm text-amber-800">
            No eligible users to promote. Users must first log in to the site via the Manus login to appear here.
          </div>
        )}

        {/* Workers Table */}
        {workers.length === 0 ? (
          <div className="bg-white border border-stone-200 rounded-xl p-12 text-center">
            <Shield className="w-12 h-12 text-stone-300 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-stone-700 mb-2">No Workers Yet</h3>
            <p className="text-stone-500 text-sm">
              Add workers to give them access to view and manage applications.
            </p>
          </div>
        ) : (
          <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-stone-50 border-b border-stone-200">
                    <th className="text-left px-6 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider">Worker</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider">View</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider">Edit</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider">Export</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider">Status</th>
                    <th className="text-right px-6 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {workers.map((w) => {
                    const perms = (w as unknown as { permissions: { canView: boolean; canEdit: boolean; canExport: boolean } | null }).permissions;
                    const isActive = (w as unknown as { isActive: boolean | null }).isActive !== false;
                    return (
                      <tr key={w.id} className="border-b border-stone-100 hover:bg-stone-50/50">
                        <td className="px-6 py-4">
                          <div className="font-medium text-stone-800">{w.name || "Unnamed"}</div>
                          <div className="text-xs text-stone-500">{w.email || "No email"}</div>
                        </td>
                        <td className="text-center px-4 py-4">
                          <button
                            onClick={() => {
                              const newPerms = { canView: !perms?.canView, canEdit: perms?.canEdit ?? false, canExport: perms?.canExport ?? false };
                              updatePermsMutation.mutate({ userId: w.id, permissions: newPerms });
                            }}
                            className={`inline-flex items-center justify-center w-8 h-8 rounded-lg ${perms?.canView ? "bg-green-100 text-green-700" : "bg-stone-100 text-stone-400"}`}
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                        <td className="text-center px-4 py-4">
                          <button
                            onClick={() => {
                              const newPerms = { canView: perms?.canView ?? true, canEdit: !perms?.canEdit, canExport: perms?.canExport ?? false };
                              updatePermsMutation.mutate({ userId: w.id, permissions: newPerms });
                            }}
                            className={`inline-flex items-center justify-center w-8 h-8 rounded-lg ${perms?.canEdit ? "bg-green-100 text-green-700" : "bg-stone-100 text-stone-400"}`}
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                        </td>
                        <td className="text-center px-4 py-4">
                          <button
                            onClick={() => {
                              const newPerms = { canView: perms?.canView ?? true, canEdit: perms?.canEdit ?? false, canExport: !perms?.canExport };
                              updatePermsMutation.mutate({ userId: w.id, permissions: newPerms });
                            }}
                            className={`inline-flex items-center justify-center w-8 h-8 rounded-lg ${perms?.canExport ? "bg-green-100 text-green-700" : "bg-stone-100 text-stone-400"}`}
                          >
                            <Download className="w-4 h-4" />
                          </button>
                        </td>
                        <td className="text-center px-4 py-4">
                          <button
                            onClick={() => toggleActiveMutation.mutate({ userId: w.id, isActive: !isActive })}
                            className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}
                          >
                            {isActive ? <ToggleRight className="w-3 h-3" /> : <ToggleLeft className="w-3 h-3" />}
                            {isActive ? "Active" : "Inactive"}
                          </button>
                        </td>
                        <td className="text-right px-6 py-4">
                          <button
                            onClick={() => {
                              if (confirm("Remove this worker? They will lose all staff access.")) {
                                demoteMutation.mutate({ userId: w.id });
                              }
                            }}
                            className="text-red-500 hover:text-red-700 p-2 rounded-lg hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Permission Legend */}
        <div className="mt-6 bg-white border border-stone-200 rounded-xl p-6">
          <h3 className="font-bold text-stone-700 mb-3 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-green-700" /> Permission Guide
          </h3>
          <div className="grid md:grid-cols-3 gap-4 text-sm">
            <div className="flex items-start gap-3">
              <Eye className="w-5 h-5 text-green-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-stone-800">View</p>
                <p className="text-stone-500">Can view application list and details</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Pencil className="w-5 h-5 text-green-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-stone-800">Edit</p>
                <p className="text-stone-500">Can update application status and notes</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Download className="w-5 h-5 text-green-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-stone-800">Export</p>
                <p className="text-stone-500">Can download CSV reports</p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Promote Modal */}
      {showPromoteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-stone-800 mb-4 flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-green-700" /> Add New Worker
            </h3>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-stone-700 block mb-1">Select User</label>
                <select
                  value={selectedUserId ?? ""}
                  onChange={(e) => setSelectedUserId(Number(e.target.value) || null)}
                  className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                >
                  <option value="">Choose a user...</option>
                  {nonWorkerUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name || "Unnamed"} ({u.email || "No email"})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-stone-700 block mb-2">Permissions</label>
                <div className="space-y-2">
                  {[
                    { key: "canView" as const, label: "View Applications", icon: Eye },
                    { key: "canEdit" as const, label: "Edit Status & Notes", icon: Pencil },
                    { key: "canExport" as const, label: "Export CSV Reports", icon: Download },
                  ].map(({ key, label, icon: Icon }) => (
                    <label key={key} className="flex items-center gap-3 p-2 rounded-lg hover:bg-stone-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={permissions[key]}
                        onChange={(e) => setPermissions((p) => ({ ...p, [key]: e.target.checked }))}
                        className="w-4 h-4 text-green-600 border-stone-300 rounded focus:ring-green-500"
                      />
                      <Icon className="w-4 h-4 text-stone-500" />
                      <span className="text-sm text-stone-700">{label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <Button
                variant="outline"
                onClick={() => {
                  setShowPromoteModal(false);
                  setSelectedUserId(null);
                }}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (!selectedUserId) {
                    toast.error("Please select a user");
                    return;
                  }
                  promoteMutation.mutate({ userId: selectedUserId, permissions });
                }}
                disabled={!selectedUserId || promoteMutation.isPending}
                className="flex-1 bg-green-700 hover:bg-green-800 text-white"
              >
                {promoteMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Add Worker"
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
