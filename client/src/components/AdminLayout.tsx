import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { useLocation, Link } from "wouter";
import {
  LayoutDashboard, Users, ClipboardList, FileText, Building2,
  LogOut, Loader2, ShieldCheck, ChevronRight, Leaf, Link2, UserCog,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { type ReactNode } from "react";

const NAV_ITEMS = [
  { path: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { path: "/admin/agency", label: "Agency Overview", icon: Building2 },
  { path: "/admin/clients", label: "Clients", icon: Users },
  { path: "/admin/tasks", label: "Tasks", icon: ClipboardList },
  { path: "/admin/documents", label: "Document Library", icon: FileText },
  { path: "/admin/referrals", label: "Referral Links", icon: Link2 },
];

const ADMIN_ONLY_NAV_ITEMS = [
  { path: "/admin/workers", label: "Staff Management", icon: UserCog },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { user, loading, isAuthenticated, logout } = useAuth();
  const [location] = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-green-900">
        <Loader2 className="h-8 w-8 animate-spin text-green-300" />
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    window.location.href = getLoginUrl();
    return null;
  }

  const staffRoles = ["super_admin", "admin", "worker", "viewer"];
  if (!staffRoles.includes(user.role)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-green-900 text-white">
        <div className="text-center space-y-4">
          <ShieldCheck className="h-16 w-16 mx-auto text-red-400" />
          <h1 className="text-2xl font-bold">Access Denied</h1>
          <p className="text-green-200">You do not have permission to access the admin panel.</p>
          <Link href="/">
            <Button variant="outline" className="border-green-400 text-green-100 hover:bg-green-800">
              Return to Home
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const initials = user.name ? user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) : "U";

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Sidebar - Green theme matching FreshSelect branding */}
      <aside className="w-56 bg-green-900 text-white flex flex-col shrink-0 sticky top-0 h-screen">
        {/* Logo */}
        <div className="p-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center shrink-0">
            <Leaf className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-sm leading-tight">FreshSelect</h1>
            <p className="text-[10px] text-green-300">Social Care Network</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-2 px-2 space-y-0.5">
          {[...NAV_ITEMS, ...((["super_admin", "admin"].includes(user.role)) ? ADMIN_ONLY_NAV_ITEMS : [])].map((item) => {
            const active = location === item.path || (item.path !== "/admin/dashboard" && location.startsWith(item.path));
            const Icon = item.icon;
            return (
              <Link key={item.path} href={item.path}>
                <button
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-colors ${
                    active
                      ? "bg-green-600 text-white font-medium"
                      : "text-green-200 hover:text-white hover:bg-green-800"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="h-[18px] w-[18px] shrink-0" />
                    <span>{item.label}</span>
                  </div>
                  {active && <ChevronRight className="h-4 w-4 opacity-60" />}
                </button>
              </Link>
            );
          })}
        </nav>

        {/* User section at bottom */}
        <div className="p-3 border-t border-green-700">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-8 w-8 rounded-full bg-green-600 flex items-center justify-center text-white font-medium text-xs shrink-0">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{user.name || "Admin"}</p>
              <p className="text-[10px] text-green-300 truncate">FreshSelect Meals</p>
            </div>
          </div>
          <button
            onClick={() => logout()}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-green-300 hover:text-red-300 hover:bg-green-800 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0 overflow-auto bg-slate-50">
        {children}
      </main>
    </div>
  );
}
