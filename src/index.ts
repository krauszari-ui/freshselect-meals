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

const app = express();

// Security middleware (helmet, CORS, global rate limiting, request ID)
applySecurityMiddleware(app);

// Request logger
app.use(requestLogger);

// Body parser — tight limits to prevent DoS.
// Upload route uses base64 so 10mb covers large documents.
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
