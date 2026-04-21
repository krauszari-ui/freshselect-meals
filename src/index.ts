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
  uploadLimiter,
} from "../server/_core/security";
import { requestLogger } from "../server/_core/logger";
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
    if (webhookSecret) {
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
    // Try to extract submissionId from any of the To addresses
    // Matches: reply-{id}@... or client-{id}@...
    let submissionId: number | null = null;
    let matchedTo = "";
    for (const addr of toList) {
      const m = addr.match(/(?:reply|client)-(\d+)@/);
      if (m) { submissionId = parseInt(m[1], 10); matchedTo = addr; break; }
    }
    if (!submissionId) {
      console.log("[Inbound Email] No submission ID found in To addresses:", toList);
      res.status(200).json({ ok: true, skipped: true, reason: "no_match" });
      return;
    }
    const submission = await getSubmissionById(submissionId);
    if (!submission) {
      res.status(200).json({ ok: true, skipped: true, reason: "no_submission" });
      return;
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
    });
    console.log(`[Inbound Email] Stored reply from ${fromEmail} for client #${submissionId} (subject: "${subject}")`);
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error("[Inbound Email] Error processing webhook:", err);
    res.status(200).json({ ok: true }); // Always 200 to prevent Resend retries
  }
});

// Body parser — tight limits to prevent DoS.
// Upload route uses base64 so 10mb covers large documents.
// Registered AFTER the raw inbound-email route so Svix gets raw bytes.
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

// OAuth callback under /api/oauth/callback
registerOAuthRoutes(app);

// Health check (no auth required, excluded from rate limiting)
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", ts: Date.now() });
});

// Per-route rate limiters applied before tRPC handles the request
// tRPC procedure names are in the URL path: /api/trpc/submission.submit
app.use("/api/trpc/submission.submit", submissionLimiter);
app.use("/api/trpc/auth.adminLogin", loginLimiter);
app.use("/api/trpc/referrer.login", loginLimiter);
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
