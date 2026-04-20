import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Users,
  Shield,
  ShieldCheck,
  UserPlus,
  Eye,
  Pencil,
  Download,
  ChevronLeft,
  ToggleLeft,
  ToggleRight,
  Trash2,
  Loader2,
  Settings2,
  KeyRound,
  Crown,
  Link2,
} from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";

type Role = "admin" | "worker" | "viewer";

const ROLE_LABELS: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  super_admin: { label: "Super Admin", color: "bg-purple-100 text-purple-800", icon: Crown },
  admin: { label: "Admin", color: "bg-blue-100 text-blue-800", icon: ShieldCheck },
  worker: { label: "Worker", color: "bg-green-100 text-green-800", icon: Shield },
  viewer: { label: "Viewer", color: "bg-stone-100 text-stone-700", icon: Eye },
};

const DEFAULT_PERMISSIONS = { canView: true, canEdit: false, canExport: false, canDelete: false, showReferralLinks: true };

const PERM_LIST = [
  { key: "canView" as const, label: "View Applications", icon: Eye },
  { key: "canEdit" as const, label: "Edit Status & Notes", icon: Pencil },
  { key: "canExport" as const, label: "Export CSV Reports", icon: Download },
  { key: "canDelete" as const, label: "Delete Records", icon: Trash2 },
  { key: "showReferralLinks" as const, label: "Show Referral Links in Sidebar", icon: Link2 },
];

export default function AdminWorkers() {
  const { user, loading: authLoading } = useAuth();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    email: "", name: "", password: "", role: "worker" as Role,
    permissions: { ...DEFAULT_PERMISSIONS },
  });

  const [showEditModal, setShowEditModal] = useState(false);
  const [editTarget, setEditTarget] = useState<{ id: number; name: string; email: string; role: string } | null>(null);
  const [editForm, setEditForm] = useState({
    name: "", role: "worker" as Role, newPassword: "",
    permissions: { ...DEFAULT_PERMISSIONS },
  });

  const utils = trpc.useUtils();
  const staffQuery = trpc.admin.workers.listStaff.useQuery();

  const toggleActiveMutation = trpc.admin.workers.toggleActive.useMutation({
    onSuccess: () => { toast.success("Account status updated"); utils.admin.workers.listStaff.invalidate(); },
    onError: (err) => toast.error(err.message),
  });
  const demoteMutation = trpc.admin.workers.demote.useMutation({
    onSuccess: () => { toast.success("Staff access revoked"); utils.admin.workers.listStaff.invalidate(); },
    onError: (err) => toast.error(err.message),
  });
  const createMutation = trpc.admin.workers.createStaff.useMutation({
    onSuccess: () => {
      toast.success("Staff account created");
      utils.admin.workers.listStaff.invalidate();
      setShowCreateModal(false);
      setCreateForm({ email: "", name: "", password: "", role: "worker", permissions: { ...DEFAULT_PERMISSIONS } });
    },
    onError: (err) => toast.error(err.message),
  });
  const updateMutation = trpc.admin.workers.updateStaff.useMutation({
    onSuccess: () => { toast.success("Staff member updated"); utils.admin.workers.listStaff.invalidate(); setShowEditModal(false); },
    onError: (err) => toast.error(err.message),
  });

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-green-700" /></div>;
  }

  const isSuperAdmin = user?.role === "super_admin";
  const staffList = staffQuery.data ?? [];

  const openEdit = (member: typeof staffList[0]) => {
    setEditTarget({ id: member.id, name: member.name || "", email: member.email || "", role: member.role || "worker" });
    const perms = (member.permissions as Record<string, boolean> | null) ?? {};
    setEditForm({
      name: member.name || "",
      role: (member.role as Role) || "worker",
      newPassword: "",
      permissions: {
        canView: perms.canView ?? true,
        canEdit: perms.canEdit ?? false,
        canExport: perms.canExport ?? false,
        canDelete: perms.canDelete ?? false,
        showReferralLinks: perms.showReferralLinks ?? true,
      },
    });
    setShowEditModal(true);
  };

  return (
    <div className="min-h-screen bg-[#faf8f5]">
      {/* Header */}
      <header className="bg-white border-b border-stone-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/admin/dashboard">
              <button className="p-2 hover:bg-stone-100 rounded-lg transition-colors">
                <ChevronLeft className="w-5 h-5 text-stone-600" />
              </button>
            </Link>
            <div>
              <h1 className="text-xl font-bold text-stone-800 flex items-center gap-2">
                <Users className="w-5 h-5 text-green-700" /> Staff Management
              </h1>
              <p className="text-xs text-stone-500">Manage team access, roles, and permissions</p>
            </div>
          </div>
          {isSuperAdmin && (
            <Button onClick={() => setShowCreateModal(true)} className="bg-green-700 hover:bg-green-800 text-white gap-2">
              <UserPlus className="w-4 h-4" /> Add Staff Member
            </Button>
          )}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        {/* Role legend */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Object.entries(ROLE_LABELS).map(([role, { label, color, icon: Icon }]) => (
            <div key={role} className="bg-white border border-stone-200 rounded-xl p-4 flex items-center gap-3">
              <Icon className="w-5 h-5 text-stone-500 shrink-0" />
              <div>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${color}`}>{label}</span>
                <p className="text-xs text-stone-500 mt-1">
                  {role === "super_admin" && "Full control, manages staff"}
                  {role === "admin" && "Manage applications & data"}
                  {role === "worker" && "Custom per-permission access"}
                  {role === "viewer" && "Read-only access"}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Staff table */}
        <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-stone-100">
            <h2 className="font-semibold text-stone-800">Team Members ({staffList.length})</h2>
          </div>

          {staffQuery.isLoading ? (
            <div className="p-12 text-center"><Loader2 className="w-8 h-8 animate-spin text-green-700 mx-auto" /></div>
          ) : staffList.length === 0 ? (
            <div className="p-12 text-center text-stone-500">
              <Users className="w-10 h-10 mx-auto mb-3 text-stone-300" />
              <p className="font-medium">No staff members yet</p>
              {isSuperAdmin && <p className="text-sm mt-1">Click "Add Staff Member" to create the first account.</p>}
            </div>
          ) : (
            <div className="divide-y divide-stone-100">
              {staffList.map((member) => {
                const roleInfo = ROLE_LABELS[member.role ?? "worker"] ?? ROLE_LABELS.worker;
                const RoleIcon = roleInfo.icon;
                const perms = (member.permissions as Record<string, boolean> | null) ?? {};
                const isSelf = user?.id === member.id;
                const isMemberSuperAdmin = member.role === "super_admin";

                return (
                  <div key={member.id} className={`px-6 py-4 flex items-center gap-4 ${!member.isActive ? "opacity-50" : ""}`}>
                    <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                      <span className="text-sm font-bold text-green-700">
                        {(member.name || member.email || "?")[0].toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-stone-800 truncate">{member.name || "Unnamed"}</span>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${roleInfo.color} flex items-center gap-1`}>
                          <RoleIcon className="w-3 h-3" /> {roleInfo.label}
                        </span>
                        {!member.isActive && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-semibold">Inactive</span>}
                        {isSelf && <span className="text-xs bg-stone-100 text-stone-500 px-2 py-0.5 rounded-full">You</span>}
                      </div>
                      <p className="text-sm text-stone-500 truncate">{member.email}</p>
                      {member.role === "worker" && (
                        <div className="flex gap-2 mt-1 flex-wrap">
                          {perms.canView && <span className="text-xs text-stone-400 flex items-center gap-1"><Eye className="w-3 h-3" /> View</span>}
                          {perms.canEdit && <span className="text-xs text-stone-400 flex items-center gap-1"><Pencil className="w-3 h-3" /> Edit</span>}
                          {perms.canExport && <span className="text-xs text-stone-400 flex items-center gap-1"><Download className="w-3 h-3" /> Export</span>}
                          {perms.canDelete && <span className="text-xs text-stone-400 flex items-center gap-1"><Trash2 className="w-3 h-3" /> Delete</span>}
                          {perms.showReferralLinks === false && <span className="text-xs text-amber-600 flex items-center gap-1"><Link2 className="w-3 h-3" /> No Referral Links</span>}
                        </div>
                      )}
                    </div>
                    {isSuperAdmin && !isSelf && !isMemberSuperAdmin && (
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          title={member.isActive ? "Deactivate" : "Activate"}
                          onClick={() => toggleActiveMutation.mutate({ userId: member.id, isActive: !member.isActive })}
                          className="p-2 hover:bg-stone-100 rounded-lg text-stone-500 hover:text-stone-700 transition-colors"
                        >
                          {member.isActive ? <ToggleRight className="w-5 h-5 text-green-600" /> : <ToggleLeft className="w-5 h-5" />}
                        </button>
                        <button
                          title="Edit"
                          onClick={() => openEdit(member)}
                          className="p-2 hover:bg-stone-100 rounded-lg text-stone-500 hover:text-stone-700 transition-colors"
                        >
                          <Settings2 className="w-4 h-4" />
                        </button>
                        <button
                          title="Revoke staff access"
                          onClick={() => {
                            if (confirm(`Revoke staff access for ${member.name || member.email}?`))
                              demoteMutation.mutate({ userId: member.id });
                          }}
                          className="p-2 hover:bg-red-50 rounded-lg text-stone-400 hover:text-red-600 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Permission guide */}
        <div className="bg-white border border-stone-200 rounded-xl p-6">
          <h3 className="font-bold text-stone-700 mb-3 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-green-700" /> Permission Guide
          </h3>
          <div className="grid md:grid-cols-4 gap-4 text-sm">
            {PERM_LIST.map(({ icon: Icon, label, key }) => (
              <div key={key} className="flex items-start gap-3">
                <Icon className="w-5 h-5 text-green-600 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-stone-800">{label.split(" ")[0]}</p>
                  <p className="text-stone-500 text-xs">{label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* ─── Create Staff Modal ─── */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-stone-800 mb-5 flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-green-700" /> Create Staff Account
            </h3>
            <div className="space-y-4">
              <div className="space-y-1">
                <Label>Full Name</Label>
                <Input placeholder="Jane Smith" value={createForm.name} onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Email Address</Label>
                <Input type="email" placeholder="jane@example.com" value={createForm.email} onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Temporary Password</Label>
                <Input type="password" placeholder="Min. 8 characters" value={createForm.password} onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))} />
                <p className="text-xs text-stone-500">Staff can reset this via "Forgot Password" on first login.</p>
              </div>
              <div className="space-y-1">
                <Label>Role</Label>
                <select
                  value={createForm.role}
                  onChange={(e) => setCreateForm((f) => ({ ...f, role: e.target.value as Role }))}
                  className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500"
                >
                  <option value="admin">Admin — full access to all applications</option>
                  <option value="worker">Worker — custom permissions below</option>
                  <option value="viewer">Viewer — read-only access</option>
                </select>
              </div>
              {createForm.role === "worker" && (
                <div className="space-y-2">
                  <Label>Permissions</Label>
                  {PERM_LIST.map(({ key, label, icon: Icon }) => (
                    <label key={key} className="flex items-center gap-3 p-2 rounded-lg hover:bg-stone-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={createForm.permissions[key]}
                        onChange={(e) => setCreateForm((f) => ({ ...f, permissions: { ...f.permissions, [key]: e.target.checked } }))}
                        className="w-4 h-4 text-green-600 border-stone-300 rounded"
                      />
                      <Icon className="w-4 h-4 text-stone-500" />
                      <span className="text-sm text-stone-700">{label}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
            <div className="flex gap-3 mt-6">
              <Button variant="outline" onClick={() => setShowCreateModal(false)} className="flex-1">Cancel</Button>
              <Button
                onClick={() => createMutation.mutate(createForm)}
                disabled={createMutation.isPending || !createForm.email || !createForm.name || !createForm.password}
                className="flex-1 bg-green-700 hover:bg-green-800 text-white"
              >
                {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create Account"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Edit Staff Modal ─── */}
      {showEditModal && editTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-stone-800 mb-1 flex items-center gap-2">
              <Settings2 className="w-5 h-5 text-green-700" /> Edit Staff Member
            </h3>
            <p className="text-sm text-stone-500 mb-5">{editTarget.email}</p>
            <div className="space-y-4">
              <div className="space-y-1">
                <Label>Full Name</Label>
                <Input value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Role</Label>
                <select
                  value={editForm.role}
                  onChange={(e) => setEditForm((f) => ({ ...f, role: e.target.value as Role }))}
                  className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500"
                >
                  <option value="admin">Admin</option>
                  <option value="worker">Worker</option>
                  <option value="viewer">Viewer</option>
                </select>
              </div>
              {editForm.role === "worker" && (
                <div className="space-y-2">
                  <Label>Permissions</Label>
                  {PERM_LIST.map(({ key, label, icon: Icon }) => (
                    <label key={key} className="flex items-center gap-3 p-2 rounded-lg hover:bg-stone-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editForm.permissions[key]}
                        onChange={(e) => setEditForm((f) => ({ ...f, permissions: { ...f.permissions, [key]: e.target.checked } }))}
                        className="w-4 h-4 text-green-600 border-stone-300 rounded"
                      />
                      <Icon className="w-4 h-4 text-stone-500" />
                      <span className="text-sm text-stone-700">{label}</span>
                    </label>
                  ))}
                </div>
              )}
              <div className="space-y-1 border-t border-stone-100 pt-4">
                <Label className="flex items-center gap-2"><KeyRound className="w-4 h-4" /> Reset Password (optional)</Label>
                <Input
                  type="password"
                  placeholder="Leave blank to keep current password"
                  value={editForm.newPassword}
                  onChange={(e) => setEditForm((f) => ({ ...f, newPassword: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <Button variant="outline" onClick={() => setShowEditModal(false)} className="flex-1">Cancel</Button>
              <Button
                onClick={() => updateMutation.mutate({
                  userId: editTarget.id,
                  name: editForm.name || undefined,
                  role: editForm.role,
                  permissions: editForm.role === "worker" ? editForm.permissions : undefined,
                  newPassword: editForm.newPassword || undefined,
                })}
                disabled={updateMutation.isPending}
                className="flex-1 bg-green-700 hover:bg-green-800 text-white"
              >
                {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Changes"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
