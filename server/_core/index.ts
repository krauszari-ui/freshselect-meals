import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { applySecurityMiddleware, submissionLimiter, loginLimiter, uploadLimiter, referrerLoginLimiter } from "./security";
import { requestLogger } from "./logger";
import { createClientEmail, getSubmissionById, createNotification } from "../db";
import { sdk } from "./sdk";
import { Webhook } from "svix";
import { Resend } from "resend";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);

  // Security middleware (helmet, CORS, rate limiting, request ID)
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

      // Create in-app notification for staff
      const clientName = [submission.firstName, submission.lastName].filter(Boolean).join(" ") || `Client #${submissionId}`;
      createNotification({
        type: "inbound_email",
        title: `Email reply from ${clientName}`,
        body: `Subject: ${subject}${body ? " — " + body.slice(0, 120) + (body.length > 120 ? "…" : "") : ""}`,
        link: `/admin/clients/${submissionId}`,
        submissionId,
      }).catch((e: unknown) => console.warn("[Notification] Failed to create inbound email notification:", e));

      res.status(200).json({ ok: true });

    } catch (err) {
      console.error("[Inbound Email] Error processing webhook:", err);
      res.status(200).json({ ok: true }); // Always 200 to prevent Resend retries
    }
  });

  // Body parser — tight limits to prevent DoS (registered AFTER the raw inbound route)
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ limit: "10mb", extended: true }));

  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);

  // Health check endpoint
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", ts: Date.now() });
  });

  // ─── Scheduled QA health check endpoint ──────────────────────────────────
  // Called daily by the Manus scheduled task agent via:
  //   curl -X POST $SCHEDULED_TASK_ENDPOINT_BASE/api/scheduled/qa-health \
  //     -H "Cookie: app_session_id=$SCHEDULED_TASK_COOKIE"
  // The endpoint checks DB connectivity, counts submissions, and sends an
  // owner notification with the daily health summary.
  app.post("/api/scheduled/qa-health", async (req, res) => {
    // Require a valid session cookie (the Manus scheduled task injects
    // $SCHEDULED_TASK_COOKIE automatically). This prevents unauthenticated
    // callers from triggering DB queries and owner notifications.
    try {
      const user = await sdk.authenticateRequest(req).catch(() => null);
      if (!user) {
        res.status(401).json({ ok: false, error: "Unauthorized" });
        return;
      }
    } catch {
      res.status(401).json({ ok: false, error: "Unauthorized" });
      return;
    }
    try {
      const { getSubmissionStats, getTaskStats } = await import("../db");
      const { notifyOwner } = await import("./notification");

      // Run checks
      const [stats, taskStats] = await Promise.all([
        getSubmissionStats().catch(() => null),
        getTaskStats().catch(() => null),
      ]);

      const now = new Date().toLocaleString("en-US", { timeZone: "America/New_York" });
      const s = stats as any;
      const lines: string[] = [
        `Daily QA Health Check \u2014 ${now} (ET)`,
        "",
        "## Database",
        s ? `\u2705 Connected \u2014 ${s.total ?? 0} total clients` : "\u274c DB query failed",
        "",
        "## Clients by Stage",
      ];

      if (s) {
        const stages = s.stages ?? {};
        for (const [stage, count] of Object.entries(stages)) {
          lines.push(`  ${stage}: ${count}`);
        }
      }

      lines.push("", "## Tasks");
      if (taskStats) {
        const ts = taskStats as any;
        lines.push(`  Open: ${ts.open ?? 0}`);
        lines.push(`  Completed: ${ts.completed ?? 0}`);
      } else {
        lines.push("  (task stats unavailable)");
      }

      lines.push("", "## Status", "\u2705 Server is up and responding");

      const content = lines.join("\n");

      try {
        await notifyOwner({ title: "FreshSelect Daily QA Report", content });
      } catch {
        // Notification failure is non-fatal
      }

      console.log("[QA Health] Daily check completed successfully");
      res.json({ ok: true, summary: content });
    } catch (err: any) {
      console.error("[QA Health] Error:", err);
      res.status(500).json({ ok: false, error: err?.message ?? "Unknown error" });
    }
  });

  // Per-route rate limiters (applied before tRPC handler)
  app.use("/api/trpc/submission.submit", submissionLimiter);
  app.use("/api/trpc/auth.adminLogin", loginLimiter);
  app.use("/api/trpc/referrer.login", referrerLoginLimiter);
  app.use("/api/trpc/upload.document", uploadLimiter);

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
