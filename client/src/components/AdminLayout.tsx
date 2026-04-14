import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { useLocation, Link } from "wouter";
import {
  LayoutDashboard, Users, ClipboardList, FileText, Building2,
  LogOut, ChevronLeft, ChevronRight, Loader2, ShieldCheck, UserCog
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useState, type ReactNode } from "react";

const NAV_ITEMS = [
  { path: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { path: "/admin/agency", label: "Agency Overview", icon: Building2 },
  { path: "/admin/clients", label: "Clients", icon: Users },
  { path: "/admin/tasks", label: "Tasks", icon: ClipboardList },
  { path: "/admin/documents", label: "Document Library", icon: FileText },
  { path: "/admin/workers", label: "Staff Management", icon: UserCog },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { user, loading, isAuthenticated, logout } = useAuth();
  const [location] = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    window.location.href = getLoginUrl();
    return null;
  }

  if (user.role !== "admin" && user.role !== "worker") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
        <div className="text-center space-y-4">
          <ShieldCheck className="h-16 w-16 mx-auto text-red-400" />
          <h1 className="text-2xl font-bold">Access Denied</h1>
          <p className="text-slate-400">You do not have permission to access the admin panel.</p>
          <Link href="/">
            <Button variant="outline" className="border-slate-600 text-slate-300 hover:bg-slate-800">
              Return to Home
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const initials = user.name ? user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) : "U";

  return (
    <div className="min-h-screen flex bg-slate-100">
      {/* Sidebar */}
      <aside
        className={`${collapsed ? "w-16" : "w-60"} bg-slate-900 text-white flex flex-col transition-all duration-200 shrink-0 sticky top-0 h-screen`}
      >
        {/* Logo */}
        <div className={`p-4 border-b border-slate-700 flex items-center ${collapsed ? "justify-center" : "gap-3"}`}>
          <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center font-bold text-sm shrink-0">
            FS
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <h1 className="font-bold text-sm leading-tight">CareFlow</h1>
              <p className="text-[10px] text-slate-400">FreshSelect Meals</p>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 space-y-0.5 px-2 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            // Workers page only for admin
            if (item.path === "/admin/workers" && user.role !== "admin") return null;
            const active = location === item.path || (item.path !== "/admin/dashboard" && location.startsWith(item.path));
            const Icon = item.icon;
            return (
              <Tooltip key={item.path} delayDuration={collapsed ? 100 : 9999}>
                <TooltipTrigger asChild>
                  <Link href={item.path}>
                    <button
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                        active
                          ? "bg-emerald-600/20 text-emerald-400 font-medium"
                          : "text-slate-400 hover:text-white hover:bg-slate-800"
                      } ${collapsed ? "justify-center" : ""}`}
                    >
                      <Icon className="h-4.5 w-4.5 shrink-0" />
                      {!collapsed && <span>{item.label}</span>}
                    </button>
                  </Link>
                </TooltipTrigger>
                {collapsed && (
                  <TooltipContent side="right" className="bg-slate-800 text-white border-slate-700">
                    {item.label}
                  </TooltipContent>
                )}
              </Tooltip>
            );
          })}
        </nav>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-3 border-t border-slate-700 text-slate-400 hover:text-white flex items-center justify-center"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>

        {/* User */}
        <div className={`p-3 border-t border-slate-700 flex items-center ${collapsed ? "justify-center" : "gap-3"}`}>
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarFallback className="bg-emerald-600 text-white text-xs">{initials}</AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user.name || "Admin"}</p>
              <p className="text-[10px] text-slate-400 truncate capitalize">{user.role}</p>
            </div>
          )}
          <Tooltip delayDuration={100}>
            <TooltipTrigger asChild>
              <button
                onClick={() => logout()}
                className={`text-slate-400 hover:text-red-400 transition-colors ${collapsed ? "" : "ml-auto"}`}
              >
                <LogOut className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="bg-slate-800 text-white border-slate-700">
              Sign Out
            </TooltipContent>
          </Tooltip>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0 overflow-auto">
        {children}
      </main>
    </div>
  );
}
