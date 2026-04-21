import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { applySecurityMiddleware } from "./security";
import { requestLogger } from "./logger";
import { createClientEmail, getSubmissionById } from "../db";
import { Webhook } from "svix";

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
  // Resend sends a POST to /api/inbound-email when a client replies.
  // Supported To address patterns:
  //   reply-{submissionId}@freshselectmeals.com   ← preferred format
  //   client-{submissionId}@inbound.freshselectmeals.com  ← legacy format
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
          // req.body is a Buffer when express.raw() is used
          wh.verify(req.body, { "svix-id": svixId, "svix-timestamp": svixTimestamp, "svix-signature": svixSignature });
        } catch (verifyErr) {
          console.warn("[Inbound Email] Invalid webhook signature — rejecting request");
          res.status(400).json({ ok: false, error: "invalid_signature" });
          return;
        }
      }

      // Parse the raw body into a JSON object
      const rawBody = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : String(req.body);
      const payload = JSON.parse(rawBody);

      // Resend inbound payload fields: from, to, subject, text, html, message_id, in_reply_to
      // "to" can be a string, an array of strings, or an array of {email, name} objects
      const rawTo: unknown = payload.to;
      const toList: string[] = [];
      if (typeof rawTo === "string") toList.push(rawTo);
      else if (Array.isArray(rawTo)) {
        for (const t of rawTo) {
          if (typeof t === "string") toList.push(t);
          else if (t && typeof t === "object" && "email" in t) toList.push((t as { email: string }).email);
        }
      }

      // Try to extract submissionId from any of the To addresses
      let submissionId: number | null = null;
      let matchedTo = "";
      for (const addr of toList) {
        // Match reply-{id}@... or client-{id}@...
        const m = addr.match(/(?:reply|client)-(\d+)@/);
        if (m) { submissionId = parseInt(m[1], 10); matchedTo = addr; break; }
      }
      if (!submissionId) { res.status(200).json({ ok: true, skipped: true, reason: "no_match" }); return; }

      const submission = await getSubmissionById(submissionId);
      if (!submission) { res.status(200).json({ ok: true, skipped: true, reason: "no_submission" }); return; }

      const fromEmail: string = (() => {
        const f = payload.from;
        if (typeof f === "string") return f;
        if (Array.isArray(f) && f.length > 0) return typeof f[0] === "string" ? f[0] : (f[0] as { email?: string }).email ?? "";
        return "";
      })();

      const subject: string = payload.subject ?? "(no subject)";

      // Prefer plain text; strip quoted reply history (lines starting with >) and email signatures
      let body: string = payload.text ?? "";
      if (!body && payload.html) {
        // Very basic HTML-to-text: strip tags
        body = payload.html.replace(/<[^>]+>/g, " ").replace(/\s{2,}/g, " ").trim();
      }
      // Remove quoted reply blocks (lines starting with > or On ... wrote:)
      body = body
        .split("\n")
        .filter((line: string) => !line.trimStart().startsWith(">"))
        .join("\n")
        .replace(/\n*On .+ wrote:[\s\S]*/i, "") // strip "On [date], [name] wrote:" and everything after
        .replace(/_{5,}[\s\S]*/g, "")            // strip signature separator lines
        .trim();

      await createClientEmail({
        submissionId,
        direction: "inbound",
        subject,
        body,
        fromEmail,
        toEmail: matchedTo,
        resendMessageId: payload.message_id ?? null,
        inReplyTo: payload.in_reply_to ?? null,
      });
      console.log(`[Inbound Email] Stored reply from ${fromEmail} for client #${submissionId} (subject: "${subject}")`);
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
