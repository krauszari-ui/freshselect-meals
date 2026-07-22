import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, Search, LogOut, Building2, Users, MessageSquare, Bell,
  ChevronRight, Clock, CheckCircle2,
} from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import { getLoginUrl } from "@/const";
// OrgGroupChat component - defined below

export default function OrgPortal() {
  const { user, loading, logout } = useAuth();
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [activeView, setActiveView] = useState<"clients" | "chat">("clients");

  // ── Auth guard ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!user) {
    window.location.href = getLoginUrl();
    return null as never;
  }
  // Only org staff (assessor/worker with an orgId) can access this portal
  if (!user.orgId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <div className="text-center space-y-3 max-w-sm p-8 bg-card rounded-xl border shadow-sm">
          <Building2 className="w-12 h-12 text-muted-foreground mx-auto" />
          <h2 className="text-xl font-semibold">No Organization Assigned</h2>
          <p className="text-sm text-muted-foreground">
            Your account is not assigned to any organization. Please contact your administrator.
          </p>
          <Button variant="outline" onClick={() => logout()}>Sign Out</Button>
        </div>
      </div>
    );
  }

  return <OrgPortalContent user={user} logout={logout} activeView={activeView} setActiveView={setActiveView} search={search} setSearch={setSearch} searchInput={searchInput} setSearchInput={setSearchInput} />;
}

function OrgPortalContent({ user, logout, activeView, setActiveView, search, setSearch, searchInput, setSearchInput }: {
  user: any; logout: () => void;
  activeView: "clients" | "chat"; setActiveView: (v: "clients" | "chat") => void;
  search: string; setSearch: (s: string) => void;
  searchInput: string; setSearchInput: (s: string) => void;
}) {
  const [, navigate] = useLocation();

  // ── Org info ─────────────────────────────────────────────────────────────────
  const { data: orgInfo } = trpc.org.myOrg.useQuery();

  // ── Referred clients ─────────────────────────────────────────────────────────
  const { data: clientsData, isLoading: clientsLoading } = trpc.org.listReferredClients.useQuery({
    search: search.trim() || undefined,
  }, { enabled: !!user?.orgId });
  const clients = clientsData ?? [];

  // ── Unread notification count ─────────────────────────────────────────────────
  const { data: unreadData } = trpc.notifications.unreadCount.useQuery(undefined, {
    refetchInterval: 30_000,
  });
  const unreadCount = unreadData?.count ?? 0;

  const handleSearch = () => setSearch(searchInput.trim());

  return (
    <div className="min-h-screen bg-muted/20 flex flex-col">
      {/* Top nav */}
      <header className="bg-card border-b sticky top-0 z-40 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Building2 className="w-6 h-6 text-primary" />
            <div>
              <div className="font-semibold text-sm leading-tight">{orgInfo?.name ?? "Organization Portal"}</div>
              <div className="text-xs text-muted-foreground">FreshSelect Meals</div>
            </div>
          </div>

          <nav className="flex items-center gap-1">
            <Button
              variant={activeView === "clients" ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveView("clients")}
              className="gap-1.5"
            >
              <Users className="w-4 h-4" /> Clients
            </Button>
            <Button
              variant={activeView === "chat" ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveView("chat")}
              className="gap-1.5 relative"
            >
              <MessageSquare className="w-4 h-4" /> Group Chat
            </Button>
            <Link href="/admin/notifications">
              <Button variant="ghost" size="sm" className="relative gap-1.5">
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </Button>
            </Link>
          </nav>

          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground hidden sm:block">{user.name ?? user.email}</span>
            <Button variant="ghost" size="sm" onClick={() => logout()} className="gap-1.5">
              <LogOut className="w-4 h-4" /> Sign Out
            </Button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6">
        {activeView === "clients" && (
          <div className="space-y-5">
            {/* Search */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Search referred clients by name, ID, or phone…"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
              </div>
              <Button onClick={handleSearch}>Search</Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="bg-card rounded-lg border p-4">
                <div className="text-2xl font-bold">{clients.length}</div>
                <div className="text-sm text-muted-foreground">Referred Clients</div>
              </div>
              <div className="bg-card rounded-lg border p-4">
                <div className="text-2xl font-bold">{clients.filter((c: any) => c.stage === "assessment_pending").length}</div>
                <div className="text-sm text-muted-foreground">Pending Assessment</div>
              </div>
              <div className="bg-card rounded-lg border p-4">
                <div className="text-2xl font-bold">{clients.filter((c: any) => c.stage === "assessment_recorded").length}</div>
                <div className="text-sm text-muted-foreground">Assessment Recorded</div>
              </div>
            </div>

            {/* Client list */}
            {clientsLoading && (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            )}
            {!clientsLoading && clients.length === 0 && (
              <div className="text-center py-16 text-muted-foreground">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No clients referred to your organization yet</p>
                <p className="text-sm mt-1">Clients will appear here once a FreshSelect admin refers them to your organization.</p>
              </div>
            )}
            <div className="space-y-2">
              {clients.map((client: any) => (
                <Link key={client.id} href={`/org/clients/${client.id}`}>
                  <div className="bg-card border rounded-lg px-4 py-3 flex items-center justify-between hover:bg-accent/40 transition-colors cursor-pointer group">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm">
                        {(client.firstName?.[0] ?? "?").toUpperCase()}
                      </div>
                      <div>
                        <div className="font-medium text-sm">{client.firstName} {client.lastName}</div>
                        <div className="text-xs text-muted-foreground">
                          ID: {client.id}
                          {client.referralNote && <span className="ml-2 italic">"{client.referralNote}"</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <StageBadge stage={client.stage} />
                      <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {activeView === "chat" && (
          <OrgGroupChatPanel orgId={user.orgId!} orgName={orgInfo?.name ?? "Organization"} userId={user.id} userName={user.name ?? user.email ?? ""} />
        )}
      </main>
    </div>
  );
}

function StageBadge({ stage }: { stage: string }) {
  const map: Record<string, { label: string; className: string }> = {
    assessment_pending: { label: "Pending", className: "bg-amber-100 text-amber-700" },
    assessment_recorded: { label: "Recorded", className: "bg-sky-100 text-sky-700" },
    missing_information: { label: "Missing Info", className: "bg-orange-100 text-orange-700" },
    not_eligible: { label: "Not Eligible", className: "bg-rose-100 text-rose-700" },
    approved: { label: "Approved", className: "bg-green-100 text-green-700" },
  };
  const cfg = map[stage] ?? { label: stage, className: "bg-muted text-muted-foreground" };
  return <Badge className={`text-xs font-medium ${cfg.className}`}>{cfg.label}</Badge>;
}

// ─── Org Group Chat Panel ─────────────────────────────────────────────────────
function OrgGroupChatPanel({ orgId, orgName, userId, userName }: {
  orgId: number; orgName: string; userId: number; userName: string;
}) {
  const [text, setText] = useState("");
  const utils = trpc.useUtils();
  const { data: messages = [], isLoading } = trpc.org.groupMessages.useQuery(
    { orgId },
    { refetchInterval: 8000 },
  );
  const sendMsg = trpc.org.sendGroupMessage.useMutation({
    onSuccess: () => {
      utils.org.groupMessages.invalidate({ orgId });
      setText("");
    },
    onError: (e) => toast.error(e.message),
  });

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    sendMsg.mutate({ orgId, content: trimmed });
  };

  return (
    <div className="flex flex-col h-[calc(100vh-180px)] max-w-3xl mx-auto">
      <div className="mb-4">
        <h2 className="text-lg font-semibold">{orgName} — Group Chat</h2>
        <p className="text-sm text-muted-foreground">Messages visible to all {orgName} staff and FreshSelect workers</p>
      </div>
      <div className="flex-1 overflow-y-auto space-y-3 bg-card rounded-xl border p-4 mb-4">
        {isLoading && <div className="text-center text-muted-foreground text-sm py-8">Loading messages…</div>}
        {!isLoading && messages.length === 0 && (
          <div className="text-center text-muted-foreground text-sm py-8">No messages yet. Start the conversation!</div>
        )}
        {messages.map((msg: any) => {
          const isMe = msg.senderId === userId;
          return (
            <div key={msg.id} className={`flex gap-3 ${isMe ? "flex-row-reverse" : ""}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${isMe ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                {(msg.senderName ?? "?").charAt(0).toUpperCase()}
              </div>
              <div className={`max-w-[70%] ${isMe ? "items-end" : "items-start"} flex flex-col gap-1`}>
                <span className="text-xs text-muted-foreground">{isMe ? "You" : msg.senderName}</span>
                <div className={`rounded-2xl px-4 py-2 text-sm ${isMe ? "bg-primary text-primary-foreground rounded-tr-sm" : "bg-muted rounded-tl-sm"}`}>
                  {msg.content}
                </div>
                <span className="text-xs text-muted-foreground">{new Date(msg.createdAt).toLocaleString()}</span>
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex gap-2">
        <input
          className="flex-1 border rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-background"
          placeholder="Type a message…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
        />
        <Button onClick={handleSend} disabled={!text.trim() || sendMsg.isPending} size="sm">
          Send
        </Button>
      </div>
    </div>
  );
}
