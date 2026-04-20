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

  // Body parser — tight limits to prevent DoS
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ limit: "10mb", extended: true }));

  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);

  // Health check endpoint
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", ts: Date.now() });
  });

  // ─── Inbound email webhook (Resend forwards client replies here) ──────────
  // Resend sends a POST to /api/inbound-email when a client replies.
  // The To address is client-{submissionId}@inbound.freshselectmeals.com
  // which lets us match the reply to the correct client record.
  app.post("/api/inbound-email", async (req, res) => {
    try {
      const payload = req.body;
      // Resend inbound payload fields: from, to, subject, text, html, message_id, in_reply_to
      const toAddress: string = Array.isArray(payload.to) ? payload.to[0] : (payload.to ?? "");
      const match = toAddress.match(/client-(\d+)@/);
      if (!match) { res.status(200).json({ ok: true, skipped: true }); return; }
      const submissionId = parseInt(match[1], 10);
      const submission = await getSubmissionById(submissionId);
      if (!submission) { res.status(200).json({ ok: true, skipped: true }); return; }
      const fromEmail: string = Array.isArray(payload.from) ? payload.from[0] : (payload.from ?? "");
      const subject: string = payload.subject ?? "(no subject)";
      const body: string = payload.text ?? payload.html ?? "";
      await createClientEmail({
        submissionId,
        direction: "inbound",
        subject,
        body,
        fromEmail,
        toEmail: toAddress,
        resendMessageId: payload.message_id ?? null,
        inReplyTo: payload.in_reply_to ?? null,
      });
      console.log(`[Inbound Email] Stored reply from ${fromEmail} for client #${submissionId}`);
      res.status(200).json({ ok: true });
    } catch (err) {
      console.error("[Inbound Email] Error processing webhook:", err);
      res.status(200).json({ ok: true }); // Always 200 to prevent Resend retries
    }
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
