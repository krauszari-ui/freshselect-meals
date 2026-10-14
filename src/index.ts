import "dotenv/config";
import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "../server/_core/oauth";
import { appRouter } from "../server/routers";
import { createContext } from "../server/_core/context";
import { serveStatic } from "../server/_core/vite";
import {
  applySecurityMiddleware,
  submissionLimiter,
  loginLimiter,
  loginHardLimiter,
  uploadLimiter,
  referrerLoginLimiter,
  referrerLoginHardLimiter,
  passwordResetLimiter,
  referrerCodeLimiter,
} from "../server/_core/security";
import { requestLogger } from "../server/_core/logger";
import { sdk } from "../server/_core/sdk";
import { createClientEmail, getSubmissionById } from "../server/db";
import { Webhook } from "svix";
import { Resend } from "resend";

const app = express();

// Security middleware (helmet, CORS, global rate limiting, request ID)
applySecurityMiddleware(app);

// Request logger
app.use(requestLogger);

// ─── Inbound email webhook (Resend forwards client replies here) ──────────
// IMPORTANT: Registered BEFORE the global express.json() middleware so that
// express.raw() captures the raw bytes Svix needs for signature verification.
//
// Resend sends a POST to this endpoint when a client replies to an email.
// Payload format (email.received event):
//   { type: "email.received", data: { email_id, from, to, subject, message_id, ... } }
// NOTE: The webhook payload does NOT include the email body/text/html.
//   We must call resend.emails.receiving.get(email_id) to fetch the full content.
app.post("/api/inbound-email", express.raw({ type: "*/*" }), async (req, res) => {
  try {
    // ── Signature verification ──────────────────────────────────────────────
    const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error("[Inbound Email] RESEND_WEBHOOK_SECRET is not set — rejecting webhook request");
      res.status(500).json({ ok: false, error: "webhook_secret_not_configured" });
      return;
    }
    const svixId = req.headers["svix-id"] as string | undefined;
    const svixTimestamp = req.headers["svix-timestamp"] as string | undefined;
    const svixSignature = req.headers["svix-signature"] as string | undefined;
    if (!svixId || !svixTimestamp || !svixSignature) {
      console.warn("[Inbound Email] Missing Svix headers — rejecting request");
      res.status(400).json({ ok: false, error: "missing_svix_headers" });
      return;
    }
    try {
      const wh = new Webhook(webhookSecret);
      wh.verify(req.body, { "svix-id": svixId, "svix-timestamp": svixTimestamp, "svix-signature": svixSignature });
    } catch (verifyErr) {
      console.warn("[Inbound Email] Invalid webhook signature — rejecting request");
      res.status(400).json({ ok: false, error: "invalid_signature" });
      return;
    }
    // Parse the raw body
    const rawBody = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : String(req.body);
    const event = JSON.parse(rawBody);
    // Only handle email.received events
    if (event.type !== "email.received") {
      res.status(200).json({ ok: true, skipped: true, reason: "not_email_received" });
      return;
    }
    const data = event.data ?? {};
    const emailId: string = data.email_id ?? "";
    // ── Extract To addresses from the webhook metadata ──────────────────────
    // data.to is an array of strings like ["reply-1950042@inbound.freshselectmeals.com"]
    const rawTo: unknown = data.to;
    const toList: string[] = [];
    if (typeof rawTo === "string") toList.push(rawTo);
    else if (Array.isArray(rawTo)) {
      for (const t of rawTo) {
        if (typeof t === "string") toList.push(t);
        else if (t && typeof t === "object" && "email" in t) toList.push((t as { email: string }).email);
      }
    }
    // Try to extract submissionId and optional blastId from any of the To addresses
    // Matches: blast-{blastId}-{submissionId}@..., reply-{id}@..., or client-{id}@...
    let submissionId: number | null = null;
    let blastId: number | null = null;
    let matchedTo = "";
    for (const addr of toList) {
      // blast-specific reply-to: blast-{blastId}-{submissionId}@inbound.freshselectmeals.com
      const blastMatch = addr.match(/blast-(\d+)-(\d+)@/);
      if (blastMatch) {
        blastId = parseInt(blastMatch[1], 10);
        submissionId = parseInt(blastMatch[2], 10);
        matchedTo = addr;
        break;
      }
      // generic reply-to: reply-{submissionId}@... or client-{submissionId}@...
      const m = addr.match(/(?:reply|client)-(\d+)@/);
      if (m) { submissionId = parseInt(m[1], 10); matchedTo = addr; break; }
    }
    if (!submissionId) {
      console.log("[Inbound Email] No submission ID found in To addresses:", toList);
      res.status(200).json({ ok: true, skipped: true, reason: "no_match" });
      return;
    }
    const { getEmailBlastById } = await import("../server/db");
    const submission = await getSubmissionById(submissionId);
    if (!submission) {
      res.status(200).json({ ok: true, skipped: true, reason: "no_submission" });
      return;
    }
    // SECURITY: validate blastId exists in the DB before tagging the email.
    // Without this check, a spoofed To address like blast-99999-1@inbound.freshselectmeals.com
    // would store a phantom blastId on the email row, polluting blast reply counts.
    if (blastId !== null) {
      const blast = await getEmailBlastById(blastId);
      if (!blast) {
        console.warn(`[Inbound Email] blastId ${blastId} not found in DB — clearing blastId`);
        blastId = null;
      }
    }
    // ── Fetch full email content via Resend API ─────────────────────────────
    // The webhook payload does NOT include body text/html — must fetch separately
    const fromEmail: string = typeof data.from === "string" ? data.from : "";
    const subject: string = data.subject ?? "(no subject)";
    let body = "";
    let resendMessageId = data.message_id ?? null;
    if (emailId) {
      try {
        const resend = new Resend(process.env.RESEND_API_KEY);
        const { data: emailContent, error } = await resend.emails.receiving.get(emailId);
        if (error) {
          console.warn("[Inbound Email] Failed to fetch email content:", error);
        } else if (emailContent) {
          // Prefer plain text; fall back to HTML stripped of tags
          body = (emailContent as { text?: string; html?: string }).text ?? "";
          if (!body && (emailContent as { html?: string }).html) {
            body = ((emailContent as { html: string }).html)
              .replace(/<[^>]+>/g, " ")
              .replace(/\s{2,}/g, " ")
              .trim();
          }
          resendMessageId = (emailContent as { message_id?: string }).message_id ?? resendMessageId;
        }
      } catch (fetchErr) {
        console.warn("[Inbound Email] Error fetching email content:", fetchErr);
      }
    }
    // Strip quoted reply history and signatures
    body = body
      .split("\n")
      .filter((line: string) => !line.trimStart().startsWith(">"))
      .join("\n")
      .replace(/\n*On .+ wrote:[\s\S]*/i, "")
      .replace(/_{5,}[\s\S]*/g, "")
      .trim();
    await createClientEmail({
      submissionId,
      direction: "inbound",
      subject,
      body,
      fromEmail,
      toEmail: matchedTo,
      resendMessageId,
      inReplyTo: data.in_reply_to ?? null,
      ...(blastId ? { blastId } : {}),
    });
    console.log(`[Inbound Email] Stored reply from ${fromEmail} for client #${submissionId}${blastId ? ` (blast #${blastId})` : ""} (subject: "${subject}")`);
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error("[Inbound Email] Error processing webhook:", err);
    // Retryable persistence/provider failures must be non-2xx so Resend can redeliver the reply.
    res.status(500).json({ ok: false, error: "internal_error" });
  }
});

// Body parser — tight limits to prevent DoS.
// SECURITY: global limit is 256kb for all API/tRPC routes.
// Upload routes use base64 so they get a separate 10mb limit applied per-path.
app.use("/api/trpc/upload", express.json({ limit: "10mb" }));
app.use("/api/trpc/admin.uploadDocument", express.json({ limit: "10mb" }));
app.use(express.json({ limit: "256kb" }));
app.use(express.urlencoded({ limit: "256kb", extended: true }));

// OAuth callback under /api/oauth/callback
registerOAuthRoutes(app);

// Health check (no auth required, excluded from rate limiting)
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", ts: Date.now() });
});

// ─── Daily staff digest ─────────────────────────────────────────────────────
// Called by the Manus scheduled task at 08:00 America/New_York. This route must
// live in the Vercel entrypoint as well as the development server; otherwise a
// successful local preview would leave production daily reports unsent.
app.post("/api/scheduled/daily-digest", async (req, res) => {
  try {
    const cronSecret = process.env.CRON_SECRET;
    const headerSecret = req.headers["x-cron-secret"] as string | undefined;
    const hasSecretBypass = Boolean(cronSecret && headerSecret && headerSecret === cronSecret);
    if (!hasSecretBypass) {
      const user = await sdk.authenticateRequest(req).catch(() => null);
      if (!user || !user.isCron) {
        res.status(401).json({ ok: false, error: "cron-only" });
        return;
      }
    }

    const { getDailyDigestData } = await import("../server/db");
    const { sendEmail } = await import("../server/email");
    const targetDate = new Date();
    targetDate.setUTCDate(targetDate.getUTCDate() - 1);
    const data = await getDailyDigestData(targetDate.toISOString().slice(0, 10));
    const esc = (value: unknown) => String(value ?? "")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const fmtTime = (value: Date) => new Date(value).toLocaleTimeString("en-US", {
      timeZone: "America/New_York", hour: "2-digit", minute: "2-digit",
    });
    const section = (title: string, rows: string[]) => rows.length === 0
      ? `<tr><td style="padding:12px 20px"><b>${esc(title)}</b><br/><span style="color:#6b7280;font-size:13px">Nothing to report.</span></td></tr>`
      : `<tr><td style="padding:12px 20px"><b>${esc(title)}</b><ul style="margin:6px 0 0;padding-left:20px;font-size:13px">${rows.map((row) => `<li>${row}</li>`).join("")}</ul></td></tr>`;

    const meaningfulActions = new Set([
      "stage_changed", "task_created", "task_completed", "task_updated", "task_deleted",
      "document_uploaded", "document_deleted", "message_sent", "note_added", "note_updated",
      "client_updated", "client_created", "referral_sent", "assessment_submitted",
      "org_message_sent", "task_assigned",
    ]);
    const staffActions = new Map<string, Array<{ action: string; clientName: string | null; createdAt: Date }>>();
    for (const action of data.allActions) {
      if (!action.actorName || !meaningfulActions.has(action.action)) continue;
      const entries = staffActions.get(action.actorName) ?? [];
      entries.push({ action: action.action, clientName: action.clientName, createdAt: action.createdAt });
      staffActions.set(action.actorName, entries);
    }
    const staffSections = [...staffActions.entries()].map(([name, entries]) => section(
      `${name} (${entries.length} action${entries.length === 1 ? "" : "s"})`,
      entries.map((entry) => `${fmtTime(entry.createdAt)} — ${esc(entry.action.replace(/_/g, " "))}${entry.clientName ? ` — <i>${esc(entry.clientName)}</i>` : ""}`),
    )).join("");

    const html = `<!doctype html><html><body style="font-family:sans-serif;background:#f9fafb;padding:20px"><div style="max-width:680px;margin:auto;background:#fff;border-radius:8px;overflow:hidden"><div style="background:#16a34a;padding:20px;color:#fff"><h1 style="margin:0;font-size:20px">FreshSelect Meals — Daily Report</h1><p style="margin:4px 0 0">${esc(data.date)} · New York time</p></div><table style="width:100%;border-collapse:collapse">${section(`New Clients (${data.newClients.length})`, data.newClients.map((client) => `<b>${esc(client.name)}</b> — ${esc(client.referralSource ?? "Unknown source")} → ${esc(client.stage)}`))}${section(`Stage Changes (${data.stageChanges.length})`, data.stageChanges.map((change) => `<b>${esc(change.clientName ?? "Unknown")}</b>: ${esc(change.fromStage ?? "start")} → ${esc(change.toStage)} <span style="color:#6b7280">(${esc(change.actorName ?? "Staff")}, ${fmtTime(change.createdAt)})</span>`))}${section(`Tasks Created (${data.tasksCreated.length})`, data.tasksCreated.map((task) => `${esc(task.title)}${task.clientName ? ` — <i>${esc(task.clientName)}</i>` : ""}`))}${section(`Tasks Completed (${data.tasksCompleted.length})`, data.tasksCompleted.map((task) => `${esc(task.title)}${task.clientName ? ` — <i>${esc(task.clientName)}</i>` : ""}`))}${section(`Documents Uploaded (${data.documentsUploaded.length})`, data.documentsUploaded.map((document) => `${esc(document.fileName)}${document.clientName ? ` — <i>${esc(document.clientName)}</i>` : ""}`))}</table>${staffSections ? `<div style="border-top:2px solid #16a34a"><div style="padding:10px 20px;background:#f0fdf4"><b>Staff Activity Breakdown</b></div><table style="width:100%;border-collapse:collapse">${staffSections}</table></div>` : ""}<div style="padding:12px 20px;background:#f9fafb;border-top:1px solid #e5e7eb;color:#6b7280;font-size:11px">FreshSelect Meals automated daily digest</div></div></body></html>`;
    const ok = await sendEmail({
      to: "a.krausz@levelupresources.org",
      subject: `FreshSelect Meals Daily Report — ${data.date}`,
      html,
      idempotencyKey: `daily-digest-${data.date}`,
    });
    console.log(`[DailyDigest] ${data.date} sent=${ok} actions=${data.totalActions}`);
    res.json({ ok, date: data.date, totalActions: data.totalActions });
  } catch (err: any) {
    console.error("[DailyDigest] Error:", err);
    res.status(500).json({ ok: false, error: err?.message ?? "Unknown error" });
  }
});

// ─── Vercel Cron: fire due email blasts ────────────────────────────────────
// Vercel calls GET /api/cron/send-blasts every minute (configured in vercel.json).
// Protected by CRON_SECRET env var. Finds all blasts due to send and fires them.
app.get("/api/cron/send-blasts", async (req, res) => {
  const secret = process.env.CRON_SECRET;
  const authHeader = req.headers["authorization"];
  if (secret && authHeader !== `Bearer ${secret}`) {
    res.status(401).json({ ok: false, error: "Unauthorized" });
    return;
  }
  try {
    const { listEmailBlasts, updateEmailBlastStatus, getClientEmailsForBlast, getBlastAlreadySentIds } = await import("../server/db");
    const { sendEmail } = await import("../server/email");
    const blasts = await listEmailBlasts();
    const now = Date.now();
    // Pick up scheduled blasts that are due, PLUS any blasts stuck in 'sending' for >30 minutes
    // (stuck 'sending' means the previous cron run crashed after setting the status)
    // IMPORTANT: use updatedAt (set when status changed to 'sending'), NOT scheduledAt.
    // scheduledAt is the intended send time — a large blast can take >5 min to send,
    // so comparing against scheduledAt would trigger a false stale-recovery and double-send.
    const STALE_SENDING_MS = 30 * 60 * 1000; // 30 minutes — safely above Vercel's 180s timeout
    const due = blasts.filter((b: any) => {
      if (b.blastStatus === "scheduled" && b.scheduledAt && new Date(b.scheduledAt).getTime() <= now) return true;
      // A blast is stale if it has been in 'sending' for longer than the Vercel timeout window.
      // Use updatedAt (the timestamp of the last status change) as the reference point.
      if (b.blastStatus === "sending") {
        const sendingStarted = b.updatedAt ? new Date(b.updatedAt).getTime() : (b.scheduledAt ? new Date(b.scheduledAt).getTime() : 0);
        if (now - sendingStarted > STALE_SENDING_MS) return true;
      }
      return false;
    });
    if (due.length === 0) {
      res.json({ ok: true, fired: 0 });
      return;
    }
    const escHtml = (s: string) =>
      s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    const INBOUND_DOMAIN = process.env.RESEND_INBOUND_DOMAIN ?? "inbound.freshselectmeals.com";
    let totalFired = 0;
    for (const blast of due) {
      // Wrap each blast in its own try/catch so one failure doesn't block others
      try {
        // Atomic claim: only proceed if the blast is still in its expected state.
        // This prevents two concurrent Vercel cron invocations from both processing
        // the same blast (race condition that caused the duplicate-send incident).
        const fromStatus = blast.blastStatus as "scheduled" | "sending";
        const claimed = await updateEmailBlastStatus(blast.id, "sending", undefined, fromStatus);
        if (!claimed) {
          console.log(`[CronBlast] Blast ${blast.id} already claimed by another invocation — skipping`);
          continue;
        }
        const [clients, alreadySentIds] = await Promise.all([
          getClientEmailsForBlast(blast.filterStatus),
          getBlastAlreadySentIds(blast.id),
        ]);
        let sentCount = 0;
        let failedCount = 0;
        for (const client of clients) {
          if (!client.email) { failedCount++; continue; }
          // Skip clients who already received this blast (idempotent retry)
          if (alreadySentIds.has(client.id)) { continue; }
          const replyTo = `blast-${blast.id}-${client.id}@${INBOUND_DOMAIN}`;
          const html = `<div style="font-family:sans-serif;max-width:600px;margin:0 auto">
            <p>Dear ${escHtml(client.firstName ?? "")} ${escHtml(client.lastName ?? "")},</p>
            <p>${escHtml(blast.body).replace(/\n/g, "<br/>")}</p>
            <p style="margin-top:24px;font-size:12px;color:#888">FreshSelect Meals &mdash; freshselectmeals.com</p>
          </div>`;
          const ok = await sendEmail({ to: client.email, subject: blast.subject, html, replyTo });
          if (ok) {
            sentCount++;
            // Record the outbound blast email so replies can be linked back to this blast
            try {
              await createClientEmail({
                submissionId: client.id,
                direction: "outbound",
                subject: blast.subject,
                body: blast.body,
                fromEmail: `noreply@freshselectmeals.com`,
                toEmail: client.email,
                blastId: blast.id,
              });
            } catch (dbErr) {
              console.warn(`[CronBlast] Failed to record outbound email for client #${client.id}:`, dbErr);
            }
          } else { failedCount++; }
        }
        await updateEmailBlastStatus(blast.id, "sent", { sentCount, failedCount, sentAt: new Date() });
        console.log(`[CronBlast] Blast ${blast.id} sent: ${sentCount} ok, ${failedCount} failed`);
        totalFired++;
      } catch (blastErr: any) {
        // Mark as failed so it doesn't get stuck in 'sending' forever
        console.error(`[CronBlast] Blast ${blast.id} failed:`, blastErr);
        try { await updateEmailBlastStatus(blast.id, "failed"); } catch (_) { /* ignore */ }
      }
    }
    res.json({ ok: true, fired: totalFired });
  } catch (err: any) {
    console.error("[CronBlast] Error:", err);
    res.status(500).json({ ok: false, error: err?.message ?? "Unknown error" });
  }
});

// Per-route rate limiters applied before tRPC handles the request
// tRPC procedure names are in the URL path: /api/trpc/submission.submit
app.use("/api/trpc/submission.submit", submissionLimiter);
// Admin login — Tier 1 (15-min block) + Tier 2 (24-hour hard block)
app.use("/api/trpc/auth.adminLogin", loginLimiter);
app.use("/api/trpc/auth.adminLogin", loginHardLimiter);
// Referrer portal login — dedicated stricter limiters
app.use("/api/trpc/admin.referrerPortal.login", referrerLoginLimiter);
app.use("/api/trpc/admin.referrerPortal.login", referrerLoginHardLimiter);
// Referrer portal code-gated endpoints — prevent code enumeration
app.use("/api/trpc/admin.referrerPortal.myClients", referrerCodeLimiter);
app.use("/api/trpc/admin.referrerPortal.myStats", referrerCodeLimiter);
app.use("/api/trpc/admin.referrerPortal.myMessages", referrerCodeLimiter);
app.use("/api/trpc/admin.referrerPortal.reply", referrerCodeLimiter);
app.use("/api/trpc/admin.referrerPortal.markAllRead", referrerCodeLimiter);
app.use("/api/trpc/admin.referrerPortal.deleteMessage", referrerCodeLimiter);
// Password reset — prevent email bombing
app.use("/api/trpc/passwordReset.forgotPassword", passwordResetLimiter);
app.use("/api/trpc/upload.document", uploadLimiter);
app.use("/api/trpc/admin.uploadDocument", uploadLimiter);

// tRPC API
app.use(
  "/api/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext,
  })
);

// Serve static files and SPA catch-all.
// On Vercel: express.static() is ignored (CDN serves public/**),
// but the catch-all still handles SPA routing via res.sendFile().
// On other platforms: express.static() serves assets normally.
serveStatic(app);

// Export the Express app — Vercel handles invoking it as a serverless function
export default app;
