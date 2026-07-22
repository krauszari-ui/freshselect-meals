/**
 * ClientChatTab — Professional per-client staff chat thread.
 * WhatsApp/Teams-style bubble UI with real-time polling, file attachments,
 * emoji reactions, message deletion, and read receipts.
 */
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Send, Paperclip, Smile, Trash2, Download, FileText,
  MessageSquare, Loader2, X, Check, CheckCheck,
} from "lucide-react";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Message {
  id: number;
  submissionId: number;
  senderId: number;
  senderName: string;
  senderRole: string;
  content: string;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
  attachmentType?: string | null;
  reactions?: unknown;
  isDeleted: number;
  createdAt: Date | string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const EMOJI_REACTIONS = ["👍", "❤️", "😂", "😮", "🙏", "✅"];

function formatTime(date: Date | string) {
  const d = new Date(date);
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function formatDateSeparator(date: Date | string) {
  const d = new Date(date);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

function getRoleColor(role: string) {
  switch (role) {
    case "super_admin": return "bg-purple-500";
    case "admin": return "bg-blue-500";
    case "worker": return "bg-emerald-500";
    case "assessor": return "bg-amber-500";
    default: return "bg-slate-400";
  }
}

function getRoleBadge(role: string) {
  switch (role) {
    case "super_admin": return "Super Admin";
    case "admin": return "Admin";
    case "worker": return "Worker";
    case "assessor": return "Assessor";
    default: return role;
  }
}

function getInitials(name: string) {
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

function isImageType(type?: string | null) {
  return type?.startsWith("image/");
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

function Avatar({ name, role, size = "md" }: { name: string; role: string; size?: "sm" | "md" }) {
  const sz = size === "sm" ? "w-7 h-7 text-xs" : "w-9 h-9 text-sm";
  return (
    <div className={`${sz} rounded-full ${getRoleColor(role)} flex items-center justify-center text-white font-semibold flex-shrink-0 select-none`}>
      {getInitials(name)}
    </div>
  );
}

// ─── Message Bubble ───────────────────────────────────────────────────────────

function MessageBubble({
  msg,
  isMine,
  currentUserId,
  onDelete,
  onReact,
  onOpenAttachment,
}: {
  msg: Message;
  isMine: boolean;
  currentUserId: number;
  onDelete: (id: number) => void;
  onReact: (id: number, emoji: string) => void;
  onOpenAttachment: (url: string, name: string) => void;
}) {
  const [showActions, setShowActions] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const reactionCounts = useMemo(() => {
    const map: Record<string, { count: number; mine: boolean }> = {};
    for (const r of (msg.reactions as Array<{ userId: number; emoji: string }> | null) ?? []) {
      if (!map[r.emoji]) map[r.emoji] = { count: 0, mine: false };
      map[r.emoji].count++;
      if (r.userId === currentUserId) map[r.emoji].mine = true;
    }
    return map;
  }, [msg.reactions, currentUserId]);

  if (msg.isDeleted) {
    return (
      <div className={`flex ${isMine ? "justify-end" : "justify-start"} mb-1`}>
        <span className="text-xs text-slate-400 italic px-3 py-1.5 bg-slate-100 rounded-full">
          Message deleted
        </span>
      </div>
    );
  }

  return (
    <div
      className={`flex gap-2.5 mb-3 group ${isMine ? "flex-row-reverse" : "flex-row"}`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => { setShowActions(false); setShowEmojiPicker(false); }}
    >
      {/* Avatar */}
      {!isMine && <Avatar name={msg.senderName} role={msg.senderRole} />}

      <div className={`flex flex-col max-w-[72%] ${isMine ? "items-end" : "items-start"}`}>
        {/* Sender name + role */}
        {!isMine && (
          <div className="flex items-center gap-1.5 mb-1 ml-1">
            <span className="text-xs font-semibold text-slate-700">{msg.senderName}</span>
            <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">
              {getRoleBadge(msg.senderRole)}
            </span>
          </div>
        )}

        {/* Bubble */}
        <div className="relative">
          <div
            className={`rounded-2xl px-4 py-2.5 shadow-sm ${
              isMine
                ? "bg-emerald-500 text-white rounded-tr-sm"
                : "bg-white border border-slate-200 text-slate-800 rounded-tl-sm"
            }`}
          >
            {/* Attachment */}
            {msg.attachmentUrl && (
              <div className="mb-2">
                {isImageType(msg.attachmentType) ? (
                  <img
                    src={msg.attachmentUrl}
                    alt={msg.attachmentName ?? "attachment"}
                    className="max-w-[240px] rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                    onClick={() => onOpenAttachment(msg.attachmentUrl!, msg.attachmentName ?? "image")}
                  />
                ) : (
                  <button
                    onClick={() => onOpenAttachment(msg.attachmentUrl!, msg.attachmentName ?? "file")}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                      isMine ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                    }`}
                  >
                    <FileText className="h-4 w-4 flex-shrink-0" />
                    <span className="truncate max-w-[180px]">{msg.attachmentName ?? "File"}</span>
                    <Download className="h-3.5 w-3.5 flex-shrink-0" />
                  </button>
                )}
              </div>
            )}

            {/* Text content */}
            {msg.content && (
              <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{msg.content}</p>
            )}

            {/* Timestamp */}
            <div className={`flex items-center gap-1 mt-1 ${isMine ? "justify-end" : "justify-start"}`}>
              <span className={`text-[10px] ${isMine ? "text-emerald-100" : "text-slate-400"}`}>
                {formatTime(msg.createdAt)}
              </span>
              {isMine && <CheckCheck className="h-3 w-3 text-emerald-200" />}
            </div>
          </div>

          {/* Reactions */}
          {Object.keys(reactionCounts).length > 0 && (
            <div className={`flex flex-wrap gap-1 mt-1 ${isMine ? "justify-end" : "justify-start"}`}>
              {Object.entries(reactionCounts).map(([emoji, { count, mine }]) => (
                <button
                  key={emoji}
                  onClick={() => onReact(msg.id, emoji)}
                  className={`flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs border transition-colors ${
                    mine ? "bg-emerald-50 border-emerald-300 text-emerald-700" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <span>{emoji}</span>
                  {count > 1 && <span className="font-medium">{count}</span>}
                </button>
              ))}
            </div>
          )}

          {/* Action buttons (hover) */}
          {showActions && (
            <div className={`absolute top-0 ${isMine ? "right-full mr-2" : "left-full ml-2"} flex items-center gap-1 bg-white border border-slate-200 rounded-full px-2 py-1 shadow-md z-10`}>
              {/* Emoji picker trigger */}
              <div className="relative">
                <button
                  onClick={() => setShowEmojiPicker(p => !p)}
                  className="p-1 rounded-full hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors"
                  title="React"
                >
                  <Smile className="h-3.5 w-3.5" />
                </button>
                {showEmojiPicker && (
                  <div className={`absolute bottom-full mb-1 ${isMine ? "right-0" : "left-0"} flex gap-1 bg-white border border-slate-200 rounded-full px-2 py-1.5 shadow-lg z-20`}>
                    {EMOJI_REACTIONS.map(e => (
                      <button
                        key={e}
                        onClick={() => { onReact(msg.id, e); setShowEmojiPicker(false); }}
                        className="text-base hover:scale-125 transition-transform"
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {/* Delete */}
              {isMine && (
                <button
                  onClick={() => onDelete(msg.id)}
                  className="p-1 rounded-full hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
                  title="Delete"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Date Separator ───────────────────────────────────────────────────────────

function DateSeparator({ date }: { date: Date | string }) {
  return (
    <div className="flex items-center gap-3 my-4">
      <div className="flex-1 h-px bg-slate-200" />
      <span className="text-xs text-slate-400 font-medium px-2">{formatDateSeparator(date)}</span>
      <div className="flex-1 h-px bg-slate-200" />
    </div>
  );
}

// ─── Typing Indicator ─────────────────────────────────────────────────────────

function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-3 py-2">
      {[0, 1, 2].map(i => (
        <div
          key={i}
          className="w-2 h-2 rounded-full bg-slate-400 animate-bounce"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ClientChatTab({ submissionId, clientName }: { submissionId: number; clientName: string }) {
  const { user } = useAuth();
  const utils = trpc.useUtils();

  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [attachFile, setAttachFile] = useState<File | null>(null);
  const [attachPreview, setAttachPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [lastSeenId, setLastSeenId] = useState(0);

  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // ── Load messages ──────────────────────────────────────────────────────────
  const { data: messages = [], isLoading, refetch } = trpc.chat.list.useQuery(
    { submissionId, limit: 50 },
    { refetchOnWindowFocus: false, staleTime: 0 }
  );

  // ── Real-time polling (every 3 seconds) ────────────────────────────────────
  const { data: newMessages = [] } = trpc.chat.poll.useQuery(
    { submissionId, afterId: lastSeenId },
    {
      refetchInterval: 3000,
      enabled: lastSeenId > 0,
      refetchOnWindowFocus: true,
    }
  );

  // Merge new polled messages into the list
  const allMessages = useMemo(() => {
    if (!newMessages.length) return messages;
    const existingIds = new Set(messages.map((m: Message) => m.id));
    const fresh = newMessages.filter((m: Message) => !existingIds.has(m.id));
    if (!fresh.length) return messages;
    return [...messages, ...fresh];
  }, [messages, newMessages]);

  // ── Track last message ID for polling ─────────────────────────────────────
  useEffect(() => {
    if (allMessages.length > 0) {
      const maxId = Math.max(...allMessages.map((m: Message) => m.id));
      setLastSeenId(maxId);
    }
  }, [allMessages]);

  // ── Auto-scroll to bottom on new messages ─────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [allMessages.length]);

  // ── Mark thread as read when tab is active ────────────────────────────────
  const markReadMutation = trpc.chat.markRead.useMutation();
  useEffect(() => {
    if (allMessages.length > 0) {
      const maxId = Math.max(...allMessages.map((m: Message) => m.id));
      markReadMutation.mutate({ submissionId, lastReadMessageId: maxId });
    }
  }, [allMessages.length, submissionId]);

  // ── Send message ──────────────────────────────────────────────────────────
  const sendMutation = trpc.chat.send.useMutation({
    onSuccess: () => {
      utils.chat.list.invalidate({ submissionId });
      utils.chat.allUnreadCounts.invalidate();
      utils.chat.inbox.invalidate();
    },
    onError: (err) => toast.error(err.message ?? "Failed to send message"),
  });

  const uploadAttachmentMutation = trpc.chat.uploadAttachment.useMutation({
    onError: (err) => toast.error(err.message ?? "Failed to upload file"),
  });

  const handleSend = useCallback(async () => {
    const content = text.trim();
    if (!content && !attachFile) return;
    setSending(true);
    try {
      let attachmentUrl: string | undefined;
      let attachmentName: string | undefined;
      let attachmentType: string | undefined;

      if (attachFile) {
        setUploading(true);
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve((reader.result as string).split(",")[1]);
          reader.onerror = reject;
          reader.readAsDataURL(attachFile);
        });
        const uploaded = await uploadAttachmentMutation.mutateAsync({
          submissionId,
          fileName: attachFile.name,
          fileData: base64,
          contentType: attachFile.type,
        });
        attachmentUrl = uploaded.url;
        attachmentName = uploaded.fileName;
        attachmentType = uploaded.contentType;
        setUploading(false);
      }

      await sendMutation.mutateAsync({
        submissionId,
        content: content || (attachFile ? "" : ""),
        attachmentUrl,
        attachmentName,
        attachmentType,
      });

      setText("");
      setAttachFile(null);
      setAttachPreview(null);
      textareaRef.current?.focus();
      await refetch();
    } catch {
      // errors handled in mutation callbacks
    } finally {
      setSending(false);
      setUploading(false);
    }
  }, [text, attachFile, submissionId, sendMutation, uploadAttachmentMutation, refetch]);

  // ── Delete message ────────────────────────────────────────────────────────
  const deleteMutation = trpc.chat.delete.useMutation({
    onSuccess: () => utils.chat.list.invalidate({ submissionId }),
    onError: (err) => toast.error(err.message ?? "Failed to delete message"),
  });

  // ── React to message ──────────────────────────────────────────────────────
  const reactMutation = trpc.chat.react.useMutation({
    onSuccess: () => utils.chat.list.invalidate({ submissionId }),
    onError: (err) => toast.error(err.message ?? "Failed to add reaction"),
  });

  // ── File attachment ───────────────────────────────────────────────────────
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 16 * 1024 * 1024) { toast.error("File must be under 16 MB"); return; }
    setAttachFile(file);
    if (file.type.startsWith("image/")) {
      const url = URL.createObjectURL(file);
      setAttachPreview(url);
    } else {
      setAttachPreview(null);
    }
  };

  // ── Keyboard shortcut: Enter to send, Shift+Enter for newline ─────────────
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ── Open attachment ───────────────────────────────────────────────────────
  const handleOpenAttachment = (url: string, name: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
  };

  // ── Group messages by date ────────────────────────────────────────────────
  const grouped = useMemo(() => {
    const result: Array<{ type: "separator"; date: Date } | { type: "message"; msg: Message }> = [];
    let lastDate = "";
    for (const msg of allMessages as Message[]) {
      const d = new Date(msg.createdAt).toDateString();
      if (d !== lastDate) {
        result.push({ type: "separator", date: new Date(msg.createdAt) });
        lastDate = d;
      }
      result.push({ type: "message", msg });
    }
    return result;
  }, [allMessages]);

  const canSend = user?.role !== "viewer";

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-[calc(100vh-280px)] min-h-[500px] bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 bg-white">
        <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
          <MessageSquare className="h-5 w-5 text-emerald-600" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Team Chat — {clientName}</h2>
          <p className="text-xs text-slate-400">Staff-only thread for this client</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-xs text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Live
          </span>
        </div>
      </div>

      {/* Messages area */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto px-5 py-4 bg-slate-50/40"
        style={{ backgroundImage: "radial-gradient(circle at 1px 1px, rgba(148,163,184,0.08) 1px, transparent 0)", backgroundSize: "24px 24px" }}
      >
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-slate-300" />
            <p className="text-sm text-slate-400">Loading messages...</p>
          </div>
        ) : grouped.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center">
              <MessageSquare className="h-8 w-8 text-emerald-300" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-slate-600">No messages yet</p>
              <p className="text-xs text-slate-400 mt-1">Start the conversation about {clientName}</p>
            </div>
          </div>
        ) : (
          <>
            {grouped.map((item, idx) =>
              item.type === "separator" ? (
                <DateSeparator key={`sep-${idx}`} date={item.date} />
              ) : (
                <MessageBubble
                  key={item.msg.id}
                  msg={item.msg}
                  isMine={item.msg.senderId === user?.id}
                  currentUserId={user?.id ?? 0}
                  onDelete={(id) => deleteMutation.mutate({ messageId: id, submissionId })}
                  onReact={(id, emoji) => reactMutation.mutate({ messageId: id, submissionId, emoji })}
                  onOpenAttachment={handleOpenAttachment}
                />
              )
            )}
          </>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Attachment preview */}
      {attachFile && (
        <div className="px-4 py-2 border-t border-slate-100 bg-white">
          <div className="flex items-center gap-3 bg-slate-50 rounded-lg px-3 py-2">
            {attachPreview ? (
              <img src={attachPreview} alt="preview" className="w-10 h-10 rounded object-cover" />
            ) : (
              <div className="w-10 h-10 rounded bg-slate-200 flex items-center justify-center">
                <FileText className="h-5 w-5 text-slate-500" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-700 truncate">{attachFile.name}</p>
              <p className="text-xs text-slate-400">{(attachFile.size / 1024).toFixed(1)} KB</p>
            </div>
            <button
              onClick={() => { setAttachFile(null); setAttachPreview(null); }}
              className="p-1 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Input area */}
      {canSend ? (
        <div className="px-4 py-3 border-t border-slate-200 bg-white">
          <div className="flex items-end gap-2">
            {/* File attach button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex-shrink-0 p-2.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors mb-0.5"
              title="Attach file"
              disabled={sending}
            >
              <Paperclip className="h-4.5 w-4.5" />
            </button>
            <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv" />

            {/* Text input */}
            <div className="flex-1 relative">
              <Textarea
                ref={textareaRef}
                value={text}
                onChange={e => setText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`Message ${clientName} thread... (Enter to send, Shift+Enter for new line)`}
                className="resize-none min-h-[44px] max-h-[120px] rounded-2xl border-slate-200 bg-slate-50 focus:bg-white text-sm pr-4 py-3 transition-colors"
                rows={1}
                disabled={sending}
              />
            </div>

            {/* Send button */}
            <button
              onClick={handleSend}
              disabled={sending || uploading || (!text.trim() && !attachFile)}
              className="flex-shrink-0 w-10 h-10 rounded-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-200 disabled:cursor-not-allowed text-white flex items-center justify-center transition-colors shadow-sm mb-0.5"
              title="Send (Enter)"
            >
              {sending || uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </div>
          <p className="text-[10px] text-slate-400 mt-1.5 ml-12">
            Press <kbd className="px-1 py-0.5 bg-slate-100 rounded text-[10px]">Enter</kbd> to send &middot; <kbd className="px-1 py-0.5 bg-slate-100 rounded text-[10px]">Shift+Enter</kbd> for new line
          </p>
        </div>
      ) : (
        <div className="px-4 py-3 border-t border-slate-200 bg-slate-50 text-center">
          <p className="text-xs text-slate-400">Viewers cannot send messages</p>
        </div>
      )}
    </div>
  );
}
