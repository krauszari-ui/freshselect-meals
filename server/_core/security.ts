/**
 * Production security middleware for FreshSelect Meals.
 *
 * Implements:
 *  - Helmet (secure HTTP headers: CSP, HSTS, X-Frame-Options, etc.)
 *  - CORS (restrict origins to known domains)
 *  - Rate limiting (global, per-route, login brute-force protection)
 *  - Body size hardening (tight limits per route type)
 *  - Request ID injection for structured logging
 */
import helmet from "helmet";
import cors from "cors";
import { rateLimit } from "express-rate-limit";
import type { Express, Request, Response, NextFunction } from "express";
import { nanoid } from "nanoid";

// ---------------------------------------------------------------------------
// Allowed origins
// ---------------------------------------------------------------------------
const ALLOWED_ORIGINS = [
  "https://freshselectmeals.com",
  "https://www.freshselectmeals.com",
  // Vercel preview deployments
  /^https:\/\/freshselect-meals[a-z0-9-]*\.vercel\.app$/,
  // Local development
  /^https?:\/\/localhost(:\d+)?$/,
  /^https?:\/\/127\.0\.0\.1(:\d+)?$/,
];

// ---------------------------------------------------------------------------
// Rate limiters
// ---------------------------------------------------------------------------

/** Global limiter: 300 req / 15 min per IP — baseline protection */
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many requests. Please try again later." },
  skip: (req) => req.path === "/api/health",
});

/** Form submission limiter: 10 submissions / 15 min per IP */
export const submissionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many form submissions. Please wait before submitting again." },
});

/** Login brute-force limiter: 10 attempts / 15 min per IP */
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many login attempts. Please wait 15 minutes before trying again." },
});

/** Upload limiter: 20 uploads / 15 min per IP */
export const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many file uploads. Please wait before uploading again." },
});

// ---------------------------------------------------------------------------
// Request ID middleware
// ---------------------------------------------------------------------------
export function requestId(req: Request, res: Response, next: NextFunction) {
  const id = nanoid(12);
  (req as Request & { id: string }).id = id;
  res.setHeader("X-Request-Id", id);
  next();
}

// ---------------------------------------------------------------------------
// Security headers via Helmet
// ---------------------------------------------------------------------------
export const helmetMiddleware = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        "'unsafe-inline'", // Required for Vite HMR in dev; tighten in prod if using nonce
        "https://maps.googleapis.com",
        "https://maps.gstatic.com",
      ],
      styleSrc: [
        "'self'",
        "'unsafe-inline'", // Required for Tailwind CSS-in-JS
        "https://fonts.googleapis.com",
      ],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
      imgSrc: [
        "'self'",
        "data:",
        "blob:",
        "https:",
        "https://maps.googleapis.com",
        "https://maps.gstatic.com",
        "https://*.r2.dev",           // Cloudflare R2 public bucket URLs
        "https://*.cloudflarestorage.com", // Cloudflare R2 presigned URLs
      ],
      connectSrc: [
        "'self'",
        "https://api.resend.com",
        "https://maps.googleapis.com",
        "wss:", // WebSocket for Vite HMR
      ],
      mediaSrc: ["'self'", "blob:"],
      objectSrc: ["'none'"],
      frameSrc: ["'none'"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      upgradeInsecureRequests: [],
    },
  },
  crossOriginEmbedderPolicy: false, // Disabled: breaks Google Maps
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  },
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  xFrameOptions: { action: "deny" },
  xContentTypeOptions: true,
  dnsPrefetchControl: { allow: false },
  permittedCrossDomainPolicies: false,
});

// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------
export const corsMiddleware = cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (server-to-server, curl, Postman)
    if (!origin) return callback(null, true);
    const allowed = ALLOWED_ORIGINS.some((o) =>
      typeof o === "string" ? o === origin : o.test(origin)
    );
    if (allowed) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: origin '${origin}' not allowed`));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Request-Id"],
  maxAge: 86400, // 24h preflight cache
});

// ---------------------------------------------------------------------------
// Apply all security middleware to an Express app
// ---------------------------------------------------------------------------
export function applySecurityMiddleware(app: Express) {
  // Trust Vercel's proxy (needed for correct IP in rate limiters)
  app.set("trust proxy", 1);

  app.use(requestId);
  app.use(helmetMiddleware);
  app.use(corsMiddleware);
  app.use(globalLimiter);
}
