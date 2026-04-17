// api/index.ts
import "dotenv/config";
import express2 from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";

// server/_core/oauth.ts
function registerOAuthRoutes(_app) {
}

// server/routers.ts
import { TRPCError as TRPCError3 } from "@trpc/server";

// shared/const.ts
var COOKIE_NAME = "app_session_id";
var ONE_YEAR_MS = 1e3 * 60 * 60 * 24 * 365;
var UNAUTHED_ERR_MSG = "Please login (10001)";
var NOT_ADMIN_ERR_MSG = "You do not have required permission (10002)";

// server/_core/cookies.ts
function isSecureRequest(req) {
  if (req.protocol === "https") return true;
  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;
  const protoList = Array.isArray(forwardedProto) ? forwardedProto : forwardedProto.split(",");
  return protoList.some((proto) => proto.trim().toLowerCase() === "https");
}
function getSessionCookieOptions(req) {
  return {
    httpOnly: true,
    path: "/",
    sameSite: "none",
    secure: isSecureRequest(req)
  };
}

// server/_core/systemRouter.ts
import { z } from "zod";

// server/_core/notification.ts
import { TRPCError } from "@trpc/server";

// server/_core/env.ts
var ENV = {
  /** Used as the JWT audience claim */
  appId: process.env.VITE_APP_ID ?? "freshselect-meals",
  /** Secret used to sign / verify session JWTs — must be set in production */
  cookieSecret: process.env.JWT_SECRET ?? "",
  /** MySQL / PlanetScale connection string */
  databaseUrl: process.env.DATABASE_URL ?? "",
  /** Production flag */
  isProduction: process.env.NODE_ENV === "production",
  /** Resend API key for transactional email */
  resendApiKey: process.env.RESEND_API_KEY ?? "",
  // ── Forge API fields kept for _core framework compatibility (unused in app) ─
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? ""
};

// server/_core/notification.ts
var TITLE_MAX_LENGTH = 1200;
var CONTENT_MAX_LENGTH = 2e4;
var trimValue = (value) => value.trim();
var isNonEmptyString = (value) => typeof value === "string" && value.trim().length > 0;
var buildEndpointUrl = (baseUrl) => {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL(
    "webdevtoken.v1.WebDevService/SendNotification",
    normalizedBase
  ).toString();
};
var validatePayload = (input) => {
  if (!isNonEmptyString(input.title)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification title is required."
    });
  }
  if (!isNonEmptyString(input.content)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification content is required."
    });
  }
  const title = trimValue(input.title);
  const content = trimValue(input.content);
  if (title.length > TITLE_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification title must be at most ${TITLE_MAX_LENGTH} characters.`
    });
  }
  if (content.length > CONTENT_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification content must be at most ${CONTENT_MAX_LENGTH} characters.`
    });
  }
  return { title, content };
};
async function notifyOwner(payload) {
  const { title, content } = validatePayload(payload);
  if (!ENV.forgeApiUrl) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service URL is not configured."
    });
  }
  if (!ENV.forgeApiKey) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service API key is not configured."
    });
  }
  const endpoint = buildEndpointUrl(ENV.forgeApiUrl);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${ENV.forgeApiKey}`,
        "content-type": "application/json",
        "connect-protocol-version": "1"
      },
      body: JSON.stringify({ title, content })
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.warn(
        `[Notification] Failed to notify owner (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`
      );
      return false;
    }
    return true;
  } catch (error) {
    console.warn("[Notification] Error calling notification service:", error);
    return false;
  }
}

// server/_core/trpc.ts
import { initTRPC, TRPCError as TRPCError2 } from "@trpc/server";
import superjson from "superjson";
var t = initTRPC.context().create({
  transformer: superjson
});
var router = t.router;
var publicProcedure = t.procedure;
var requireUser = t.middleware(async (opts) => {
  const { ctx, next } = opts;
  if (!ctx.user) {
    throw new TRPCError2({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user
    }
  });
});
var protectedProcedure = t.procedure.use(requireUser);
var adminProcedure = t.procedure.use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;
    if (!ctx.user || ctx.user.role !== "admin") {
      throw new TRPCError2({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }
    return next({
      ctx: {
        ...ctx,
        user: ctx.user
      }
    });
  })
);

// server/_core/systemRouter.ts
var systemRouter = router({
  health: publicProcedure.input(
    z.object({
      timestamp: z.number().min(0, "timestamp cannot be negative")
    })
  ).query(() => ({
    ok: true
  })),
  notifyOwner: adminProcedure.input(
    z.object({
      title: z.string().min(1, "title is required"),
      content: z.string().min(1, "content is required")
    })
  ).mutation(async ({ input }) => {
    const delivered = await notifyOwner(input);
    return {
      success: delivered
    };
  })
});

// server/db.ts
import { and, desc, eq, like, or, sql, isNull, gte } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";

// drizzle/schema.ts
import { int, json, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";
var users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin", "worker"]).default("user").notNull(),
  /** Worker-specific: permissions JSON (e.g. { canView: true, canEdit: false, canExport: false }) */
  permissions: json("permissions"),
  /** Hashed password for internal bcrypt authentication (null for legacy OAuth users) */
  passwordHash: varchar("passwordHash", { length: 256 }),
  /** Worker-specific: whether the worker account is active */
  isActive: int("isActive").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull()
});
var submissions = mysqlTable("submissions", {
  id: int("id").autoincrement().primaryKey(),
  referenceNumber: varchar("referenceNumber", { length: 16 }).notNull().unique(),
  firstName: varchar("firstName", { length: 128 }).notNull(),
  lastName: varchar("lastName", { length: 128 }).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  cellPhone: varchar("cellPhone", { length: 32 }).notNull(),
  medicaidId: varchar("medicaidId", { length: 32 }).notNull(),
  supermarket: varchar("supermarket", { length: 128 }).notNull(),
  referralSource: varchar("referralSource", { length: 128 }),
  /** CareFlow-style stage for intake journey */
  stage: mysqlEnum("stage", [
    "referral",
    "assessment",
    "level_one_only",
    "level_one_household",
    "level_2_active",
    "ineligible",
    "provider_attestation_required",
    "flagged"
  ]).default("referral").notNull(),
  status: mysqlEnum("status", ["new", "in_review", "approved", "rejected", "on_hold"]).default("new").notNull(),
  adminNotes: text("adminNotes"),
  /** Full form payload stored as JSON (includes screening answers, uploads, etc.) */
  formData: json("formData").notNull(),
  hipaaConsentAt: timestamp("hipaaConsentAt").notNull(),
  emailSentAt: timestamp("emailSentAt"),
  /** Assigned worker user ID */
  assignedTo: int("assignedTo"),
  /** Intake rep user ID */
  intakeRep: int("intakeRep"),
  /** Language preference */
  language: varchar("language", { length: 32 }).default("English"),
  /** Borough */
  borough: varchar("borough", { length: 64 }),
  /** Neighborhood (e.g. Williamsburg, Borough Park, Flatbush, Monsey, Monroe) */
  neighborhood: varchar("neighborhood", { length: 64 }),
  /** Number of additional household members */
  additionalMembersCount: int("additionalMembersCount").default(0),
  /** Program */
  program: varchar("program", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var tasks = mysqlTable("tasks", {
  id: int("id").autoincrement().primaryKey(),
  /** The client (submission) this task relates to */
  submissionId: int("submissionId").notNull(),
  /** Task description */
  description: text("description").notNull(),
  /** Area: intake_rep or assigned_worker */
  area: mysqlEnum("area", ["intake_rep", "assigned_worker"]).default("intake_rep").notNull(),
  /** Assigned to user ID */
  assignedTo: int("assignedTo"),
  /** Status */
  status: mysqlEnum("status", ["open", "completed", "verified"]).default("open").notNull(),
  /** Created by user ID */
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  completedAt: timestamp("completedAt")
});
var caseNotes = mysqlTable("caseNotes", {
  id: int("id").autoincrement().primaryKey(),
  submissionId: int("submissionId").notNull(),
  content: text("content").notNull(),
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var documents = mysqlTable("documents", {
  id: int("id").autoincrement().primaryKey(),
  /** If null, it's a library document; if set, it's client-specific */
  submissionId: int("submissionId"),
  /** Document name/filename */
  name: varchar("name", { length: 256 }).notNull(),
  /** Category: provider_attestation, consent, supporting_documentation, id, medicaid_card, forms, uncategorized */
  category: mysqlEnum("category", [
    "provider_attestation",
    "consent",
    "supporting_documentation",
    "id_document",
    "medicaid_card",
    "birth_certificate",
    "marriage_license",
    "forms",
    "uncategorized"
  ]).default("uncategorized").notNull(),
  /** S3 URL */
  url: varchar("url", { length: 1024 }).notNull(),
  /** S3 file key */
  fileKey: varchar("fileKey", { length: 512 }).notNull(),
  /** MIME type */
  mimeType: varchar("mimeType", { length: 128 }),
  /** File size in bytes */
  fileSize: int("fileSize"),
  /** Uploaded by user ID */
  uploadedBy: int("uploadedBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var services = mysqlTable("services", {
  id: int("id").autoincrement().primaryKey(),
  submissionId: int("submissionId").notNull(),
  name: varchar("name", { length: 256 }).notNull(),
  description: text("description"),
  startDate: timestamp("startDate"),
  endDate: timestamp("endDate"),
  status: mysqlEnum("status", ["active", "completed", "cancelled"]).default("active").notNull(),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var referralLinks = mysqlTable("referralLinks", {
  id: int("id").autoincrement().primaryKey(),
  /** Unique code used in the URL (e.g., ?ref=abc123) */
  code: varchar("code", { length: 64 }).notNull().unique(),
  /** Human-readable name for the referrer (e.g., "John Smith", "Community Center") */
  referrerName: varchar("referrerName", { length: 256 }).notNull(),
  /** Optional description/notes */
  description: text("description"),
  /** Referrer login email */
  email: varchar("email", { length: 320 }),
  /** Hashed password for referrer portal login */
  passwordHash: varchar("passwordHash", { length: 256 }),
  /** Number of times this link was used (submissions with this ref code) */
  usageCount: int("usageCount").default(0).notNull(),
  /** Whether this link is active */
  isActive: int("isActive").default(1).notNull(),
  /** Created by admin user ID */
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});

// server/db.ts
var _db = null;
async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      const url = new URL(process.env.DATABASE_URL);
      if (!url.searchParams.has("ssl")) {
        url.searchParams.set("ssl", JSON.stringify({ rejectUnauthorized: true }));
      }
      _db = drizzle(url.toString());
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}
async function upsertUser(user) {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }
  try {
    const values = { openId: user.openId };
    const updateSet = {};
    const textFields = ["name", "email", "loginMethod"];
    const assignNullable = (field) => {
      const value = user[field];
      if (value === void 0) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== void 0) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== void 0) {
      values.role = user.role;
      updateSet.role = user.role;
    }
    if (!values.lastSignedIn) values.lastSignedIn = /* @__PURE__ */ new Date();
    if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = /* @__PURE__ */ new Date();
    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}
async function getUserByOpenId(openId) {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : void 0;
}
async function getUserByEmail(email) {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result.length > 0 ? result[0] : void 0;
}
async function createSubmission(data) {
  const db = await getDb();
  if (!db) {
    const reason = process.env.DATABASE_URL ? "connection failed" : "DATABASE_URL env var is not set";
    console.error(`[Database] createSubmission failed: ${reason}`);
    throw new Error(`Database not available: ${reason}`);
  }
  await db.insert(submissions).values(data);
}
async function getSubmissionById(id) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.select().from(submissions).where(eq(submissions.id, id)).limit(1);
  return result[0];
}
async function listSubmissions(opts = {}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { search, status, stage, supermarket, language, borough, assignedTo, intakeRep, page = 1, pageSize = 20 } = opts;
  const offset = (page - 1) * pageSize;
  const conditions = [];
  if (search && search.trim()) {
    const q = `%${search.trim()}%`;
    conditions.push(or(
      like(submissions.firstName, q),
      like(submissions.lastName, q),
      like(submissions.email, q),
      like(submissions.medicaidId, q),
      like(submissions.referenceNumber, q),
      like(submissions.cellPhone, q)
    ));
  }
  if (status && status !== "all") conditions.push(eq(submissions.status, status));
  if (stage && stage !== "all") conditions.push(eq(submissions.stage, stage));
  if (supermarket && supermarket !== "all") conditions.push(eq(submissions.supermarket, supermarket));
  if (language && language !== "all") conditions.push(eq(submissions.language, language));
  if (borough && borough !== "all") conditions.push(eq(submissions.borough, borough));
  if (assignedTo) conditions.push(eq(submissions.assignedTo, assignedTo));
  if (intakeRep) conditions.push(eq(submissions.intakeRep, intakeRep));
  const where = conditions.length > 0 ? and(...conditions) : void 0;
  const [rows, countResult] = await Promise.all([
    db.select().from(submissions).where(where).orderBy(desc(submissions.createdAt)).limit(pageSize).offset(offset),
    db.select({ count: sql`count(*)` }).from(submissions).where(where)
  ]);
  const total = Number(countResult[0]?.count ?? 0);
  return { rows, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}
async function getAllSubmissions(opts = {}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const conditions = [];
  if (opts.status && opts.status !== "all") conditions.push(eq(submissions.status, opts.status));
  if (opts.supermarket && opts.supermarket !== "all") conditions.push(eq(submissions.supermarket, opts.supermarket));
  if (opts.stage && opts.stage !== "all") conditions.push(eq(submissions.stage, opts.stage));
  if (opts.language && opts.language !== "all") conditions.push(eq(submissions.language, opts.language));
  if (opts.borough && opts.borough !== "all") conditions.push(eq(submissions.borough, opts.borough));
  if (opts.neighborhood && opts.neighborhood !== "all") conditions.push(eq(submissions.neighborhood, opts.neighborhood));
  if (opts.search) {
    const term = `%${opts.search}%`;
    conditions.push(or(like(submissions.firstName, term), like(submissions.lastName, term), like(submissions.medicaidId, term)));
  }
  const where = conditions.length > 0 ? and(...conditions) : void 0;
  const rows = await db.select().from(submissions).where(where).orderBy(desc(submissions.createdAt));
  return rows;
}
async function updateSubmissionStatus(id, status, adminNotes) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const updateData = { status };
  if (adminNotes !== void 0) updateData.adminNotes = adminNotes;
  await db.update(submissions).set(updateData).where(eq(submissions.id, id));
}
async function updateSubmissionStage(id, stage) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(submissions).set({ stage }).where(eq(submissions.id, id));
}
async function updateSubmissionAssignment(id, assignedTo, intakeRep) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const data = { assignedTo };
  if (intakeRep !== void 0) data.intakeRep = intakeRep;
  await db.update(submissions).set(data).where(eq(submissions.id, id));
}
async function getSubmissionStats() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [statusResult, stageResult] = await Promise.all([
    db.select({ status: submissions.status, count: sql`count(*)` }).from(submissions).groupBy(submissions.status),
    db.select({ stage: submissions.stage, count: sql`count(*)` }).from(submissions).groupBy(submissions.stage)
  ]);
  const stats = { total: 0, new: 0, in_review: 0, approved: 0, rejected: 0, on_hold: 0 };
  for (const row of statusResult) {
    stats[row.status] = Number(row.count);
    stats.total += Number(row.count);
  }
  const stages = {};
  for (const row of stageResult) {
    stages[row.stage] = Number(row.count);
  }
  return { ...stats, stages };
}
async function getRecentSubmissions(days = 7, limit = 10) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1e3);
  return db.select().from(submissions).where(gte(submissions.createdAt, since)).orderBy(desc(submissions.createdAt)).limit(limit);
}
async function getRecentlyUpdated(days = 7, limit = 10) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1e3);
  return db.select().from(submissions).where(gte(submissions.updatedAt, since)).orderBy(desc(submissions.updatedAt)).limit(limit);
}
async function getAddedCount(days = 7) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1e3);
  const result = await db.select({ count: sql`count(*)` }).from(submissions).where(gte(submissions.createdAt, since));
  return Number(result[0]?.count ?? 0);
}
async function createTask(data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(tasks).values(data);
  return Number(result[0].insertId);
}
async function getTasksBySubmission(submissionId) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(tasks).where(eq(tasks.submissionId, submissionId)).orderBy(desc(tasks.createdAt));
}
async function listTasks(opts = {}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { search, status, area, assignedTo, page = 1, pageSize = 20 } = opts;
  const offset = (page - 1) * pageSize;
  const conditions = [];
  if (search && search.trim()) conditions.push(like(tasks.description, `%${search.trim()}%`));
  if (status && status !== "all") conditions.push(eq(tasks.status, status));
  if (area && area !== "all") conditions.push(eq(tasks.area, area));
  if (assignedTo) conditions.push(eq(tasks.assignedTo, assignedTo));
  const where = conditions.length > 0 ? and(...conditions) : void 0;
  const [rows, countResult] = await Promise.all([
    db.select().from(tasks).where(where).orderBy(desc(tasks.createdAt)).limit(pageSize).offset(offset),
    db.select({ count: sql`count(*)` }).from(tasks).where(where)
  ]);
  return { rows, total: Number(countResult[0]?.count ?? 0), page, pageSize };
}
async function getTaskStats() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.select({ status: tasks.status, count: sql`count(*)` }).from(tasks).groupBy(tasks.status);
  const stats = { open: 0, completed: 0, verified: 0, total: 0 };
  for (const row of result) {
    stats[row.status] = Number(row.count);
    stats.total += Number(row.count);
  }
  return stats;
}
async function updateTaskStatus(id, status) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const data = { status };
  if (status === "completed") data.completedAt = /* @__PURE__ */ new Date();
  await db.update(tasks).set(data).where(eq(tasks.id, id));
}
async function createCaseNote(data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(caseNotes).values(data);
  return Number(result[0].insertId);
}
async function getCaseNotesBySubmission(submissionId) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(caseNotes).where(eq(caseNotes.submissionId, submissionId)).orderBy(desc(caseNotes.createdAt));
}
async function createDocument(data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(documents).values(data);
  return Number(result[0].insertId);
}
async function getDocumentsBySubmission(submissionId) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(documents).where(eq(documents.submissionId, submissionId)).orderBy(desc(documents.createdAt));
}
async function getLibraryDocuments(category) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const conditions = [isNull(documents.submissionId)];
  if (category && category !== "all") conditions.push(eq(documents.category, category));
  return db.select().from(documents).where(and(...conditions)).orderBy(desc(documents.createdAt));
}
async function deleteDocument(id) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(documents).where(eq(documents.id, id));
}
async function createService(data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(services).values(data);
  return Number(result[0].insertId);
}
async function getServicesBySubmission(submissionId) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(services).where(eq(services.submissionId, submissionId)).orderBy(desc(services.createdAt));
}
async function updateServiceStatus(id, status) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(services).set({ status }).where(eq(services.id, id));
}
async function listWorkers() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(users).where(eq(users.role, "worker")).orderBy(desc(users.createdAt));
}
async function listStaffUsers() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(users).where(or(eq(users.role, "worker"), eq(users.role, "admin"))).orderBy(desc(users.createdAt));
}
async function updateWorkerPermissions(userId, permissions) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set({ permissions }).where(eq(users.id, userId));
}
async function toggleWorkerActive(userId, isActive) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set({ isActive: isActive ? 1 : 0 }).where(eq(users.id, userId));
}
async function setUserRole(userId, role) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set({ role }).where(eq(users.id, userId));
}
async function listAllUsers() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(users).orderBy(desc(users.createdAt));
}
async function updateSubmissionFields(id, data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(submissions).set(data).where(eq(submissions.id, id));
}
async function deleteSubmission(id) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(tasks).where(eq(tasks.submissionId, id));
  await db.delete(caseNotes).where(eq(caseNotes.submissionId, id));
  await db.delete(documents).where(eq(documents.submissionId, id));
  await db.delete(services).where(eq(services.submissionId, id));
  await db.delete(submissions).where(eq(submissions.id, id));
}
async function createReferralLink(data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(referralLinks).values(data);
  return Number(result[0].insertId);
}
async function listReferralLinks() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(referralLinks).orderBy(desc(referralLinks.createdAt));
}
async function getReferralLinkByCode(code) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.select().from(referralLinks).where(eq(referralLinks.code, code)).limit(1);
  return result[0];
}
async function updateReferralLink(id, data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(referralLinks).set(data).where(eq(referralLinks.id, id));
}
async function deleteReferralLink(id) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(referralLinks).where(eq(referralLinks.id, id));
}
async function incrementReferralUsage(code) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(referralLinks).set({ usageCount: sql`usageCount + 1` }).where(eq(referralLinks.code, code));
}
async function getReferralLinkByEmail(email) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.select().from(referralLinks).where(eq(referralLinks.email, email)).limit(1);
  return result[0];
}
async function getClientsByReferralCode(code) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(submissions).where(eq(submissions.referralSource, code)).orderBy(desc(submissions.createdAt));
}
async function getReferralStats() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const links = await db.select().from(referralLinks).orderBy(desc(referralLinks.usageCount));
  const totalReferrals = links.reduce((sum, l) => sum + l.usageCount, 0);
  return { links, totalReferrals, totalLinks: links.length };
}

// server/routers.ts
import bcrypt from "bcryptjs";

// shared/_core/errors.ts
var HttpError = class extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.name = "HttpError";
  }
};
var ForbiddenError = (msg) => new HttpError(403, msg);

// server/_core/sdk.ts
import { parse as parseCookieHeader } from "cookie";
import { SignJWT, jwtVerify } from "jose";
var isNonEmptyString2 = (value) => typeof value === "string" && value.length > 0;
var SDKServer = class {
  parseCookies(cookieHeader) {
    if (!cookieHeader) return /* @__PURE__ */ new Map();
    const parsed = parseCookieHeader(cookieHeader);
    return new Map(Object.entries(parsed));
  }
  getSessionSecret() {
    const secret = ENV.cookieSecret;
    return new TextEncoder().encode(secret);
  }
  async createSessionToken(openId, options = {}) {
    return this.signSession(
      { openId, appId: ENV.appId, name: options.name || "" },
      options
    );
  }
  async signSession(payload, options = {}) {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
    const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1e3);
    const secretKey = this.getSessionSecret();
    return new SignJWT({
      openId: payload.openId,
      appId: payload.appId,
      name: payload.name
    }).setProtectedHeader({ alg: "HS256", typ: "JWT" }).setExpirationTime(expirationSeconds).sign(secretKey);
  }
  async verifySession(cookieValue) {
    if (!cookieValue) {
      console.warn("[Auth] Missing session cookie");
      return null;
    }
    try {
      const secretKey = this.getSessionSecret();
      const { payload } = await jwtVerify(cookieValue, secretKey, {
        algorithms: ["HS256"]
      });
      const { openId, appId, name } = payload;
      if (!isNonEmptyString2(openId) || !isNonEmptyString2(appId) || !isNonEmptyString2(name)) {
        console.warn("[Auth] Session payload missing required fields");
        return null;
      }
      return { openId, appId, name };
    } catch (error) {
      console.warn("[Auth] Session verification failed", String(error));
      return null;
    }
  }
  async authenticateRequest(req) {
    const cookies = this.parseCookies(req.headers.cookie);
    const sessionCookie = cookies.get(COOKIE_NAME);
    const session = await this.verifySession(sessionCookie);
    if (!session) {
      throw ForbiddenError("Invalid session cookie");
    }
    const user = await getUserByOpenId(session.openId);
    if (!user) {
      throw ForbiddenError("User not found");
    }
    upsertUser({ openId: user.openId, lastSignedIn: /* @__PURE__ */ new Date() }).catch(
      (err) => console.warn("[Auth] Failed to update lastSignedIn:", err)
    );
    return user;
  }
};
var sdk = new SDKServer();

// server/email.ts
import { Resend } from "resend";
var _resend = null;
function getResend() {
  if (!_resend) {
    _resend = new Resend(ENV.resendApiKey);
  }
  return _resend;
}
var FROM_EMAIL = "FreshSelect Meals <onboarding@resend.dev>";
var ADMIN_EMAIL = "info@freshselectmeals.com";
function buildEmailHtml(data, isAdmin) {
  const fd = data.formData;
  const screeningQuestions = fd.screeningQuestions;
  const householdMembers = fd.householdMembers;
  const healthCategories = fd.healthCategories;
  const mealFocus = fd.mealFocus;
  let html = `
<!DOCTYPE html>
<html>
<head>
<style>
  body { font-family: 'Georgia', serif; color: #2d2d2d; background: #faf8f5; margin: 0; padding: 20px; }
  .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; padding: 32px; border: 1px solid #e8e0d4; }
  .header { text-align: center; border-bottom: 2px solid #2d5a27; padding-bottom: 16px; margin-bottom: 24px; }
  .header h1 { color: #2d5a27; font-size: 24px; margin: 0; }
  .header p { color: #6b7280; font-size: 14px; margin: 4px 0 0; }
  .section { margin-bottom: 20px; }
  .section h3 { color: #2d5a27; font-size: 16px; border-bottom: 1px solid #e8e0d4; padding-bottom: 6px; margin-bottom: 12px; }
  .field { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #f3f0eb; }
  .field-label { color: #6b7280; font-size: 13px; }
  .field-value { color: #2d2d2d; font-size: 13px; font-weight: 600; }
  .ref-box { background: #f0f7ef; border: 1px solid #2d5a27; border-radius: 8px; padding: 16px; text-align: center; margin-bottom: 20px; }
  .ref-box .ref { font-size: 24px; font-weight: bold; color: #2d5a27; letter-spacing: 2px; }
  .footer { text-align: center; color: #9ca3af; font-size: 12px; margin-top: 24px; padding-top: 16px; border-top: 1px solid #e8e0d4; }
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <h1>FreshSelect Meals</h1>
    <p>${isAdmin ? "New Application Received" : "Your Application Confirmation"}</p>
  </div>
  <div class="ref-box">
    <div style="font-size:12px;color:#6b7280;">Reference Number</div>
    <div class="ref">${data.referenceNumber}</div>
  </div>

  <div class="section">
    <h3>Primary Member Information</h3>
    <div class="field"><span class="field-label">Name</span><span class="field-value">${data.firstName} ${data.lastName}</span></div>
    <div class="field"><span class="field-label">Date of Birth</span><span class="field-value">${fd.dateOfBirth || "N/A"}</span></div>
    <div class="field"><span class="field-label">Medicaid ID</span><span class="field-value">${data.medicaidId}</span></div>
  </div>

  <div class="section">
    <h3>Contact Information</h3>
    <div class="field"><span class="field-label">Phone</span><span class="field-value">${data.cellPhone}</span></div>
    <div class="field"><span class="field-label">Email</span><span class="field-value">${data.email}</span></div>
    <div class="field"><span class="field-label">Address</span><span class="field-value">${fd.streetAddress || ""}, ${fd.city || "Brooklyn"}, ${fd.state || "NY"} ${fd.zipcode || ""}</span></div>
  </div>

  <div class="section">
    <h3>Vendor</h3>
    <div class="field"><span class="field-label">Selected Vendor</span><span class="field-value">${data.supermarket}</span></div>
  </div>`;
  if (screeningQuestions && Object.keys(screeningQuestions).length > 0) {
    html += `
  <div class="section">
    <h3>SCN Screening Questions</h3>`;
    const labels = {
      livingSituation: "Current Living Situation",
      utilityShutoff: "Utility Shutoff Threat",
      receivesSnap: "Receives SNAP",
      receivesWic: "Receives WIC",
      hasChronicIllness: "Has Chronic Illness",
      otherHealthIssues: "Other Health Issues",
      medicationsRequireRefrigeration: "Medications Require Refrigeration",
      pregnantOrPostpartum: "Pregnant or Postpartum",
      breastmilkRefrigeration: "Breastmilk Refrigeration Needed"
    };
    for (const [key, label] of Object.entries(labels)) {
      const val = screeningQuestions[key];
      if (val !== void 0 && val !== null && val !== "") {
        html += `<div class="field"><span class="field-label">${label}</span><span class="field-value">${val}</span></div>`;
      }
    }
    html += `</div>`;
  }
  if (healthCategories && healthCategories.length > 0) {
    html += `
  <div class="section">
    <h3>Health Categories</h3>
    <div class="field"><span class="field-label">Selected</span><span class="field-value">${healthCategories.join(", ")}</span></div>`;
    if (fd.dueDate) html += `<div class="field"><span class="field-label">Due Date</span><span class="field-value">${fd.dueDate}</span></div>`;
    if (fd.miscarriageDate) html += `<div class="field"><span class="field-label">Miscarriage Date</span><span class="field-value">${fd.miscarriageDate}</span></div>`;
    if (fd.infantName) html += `<div class="field"><span class="field-label">Infant Name</span><span class="field-value">${fd.infantName}</span></div>`;
    html += `</div>`;
  }
  if (fd.foodAllergies || fd.dietaryRestrictions) {
    html += `
  <div class="section">
    <h3>Food Allergies / Dietary Restrictions</h3>`;
    if (fd.foodAllergies) html += `<div class="field"><span class="field-label">Food Allergies</span><span class="field-value">${fd.foodAllergiesDetails || fd.foodAllergies}</span></div>`;
    if (fd.dietaryRestrictions) html += `<div class="field"><span class="field-label">Dietary Restrictions</span><span class="field-value">${fd.dietaryRestrictions}</span></div>`;
    html += `</div>`;
  }
  if (householdMembers && householdMembers.length > 0) {
    html += `
  <div class="section">
    <h3>Household Members</h3>`;
    householdMembers.forEach((m, i) => {
      html += `<div class="field"><span class="field-label">Member ${i + 1}</span><span class="field-value">${m.name || "N/A"} (DOB: ${m.dateOfBirth || "N/A"}, CIN: ${m.medicaidId || "N/A"})</span></div>`;
    });
    html += `</div>`;
  }
  if (mealFocus && mealFocus.length > 0) {
    html += `
  <div class="section">
    <h3>Meal Preferences</h3>
    <div class="field"><span class="field-label">Meal Focus</span><span class="field-value">${mealFocus.join(", ")}</span></div>
  </div>`;
  }
  html += `
  <div class="section">
    <h3>Household Appliances</h3>
    <div class="field"><span class="field-label">Needs Refrigerator</span><span class="field-value">${fd.needsRefrigerator || "N/A"}</span></div>
    <div class="field"><span class="field-label">Needs Microwave</span><span class="field-value">${fd.needsMicrowave || "N/A"}</span></div>
    <div class="field"><span class="field-label">Needs Cooking Utensils</span><span class="field-value">${fd.needsCookingUtensils || "N/A"}</span></div>
  </div>`;
  if (isAdmin) {
    const uploadUrls = fd.uploadedDocuments;
    if (uploadUrls && Object.keys(uploadUrls).length > 0) {
      html += `
  <div class="section">
    <h3>Uploaded Documents</h3>`;
      for (const [key, url] of Object.entries(uploadUrls)) {
        const label = key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase());
        html += `<div class="field"><span class="field-label">${label}</span><span class="field-value"><a href="${url}" style="color:#2d5a27;">View Document</a></span></div>`;
      }
      html += `</div>`;
    }
  }
  html += `
  <div class="footer">
    <p>${isAdmin ? "This is an automated notification from FreshSelect Meals." : "Thank you for your application. Our team will review it and contact you within 5 business days."}</p>
    <p>FreshSelect Meals &mdash; SCN Approved Vendor</p>
    <p>Contact: (718) 307-4664 | info@freshselectmeals.com</p>
  </div>
</div>
</body>
</html>`;
  return html;
}
async function sendApplicantConfirmation(data) {
  try {
    const resend = getResend();
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [data.email],
      subject: `FreshSelect Meals - Application Received (Ref: ${data.referenceNumber})`,
      html: buildEmailHtml(data, false)
    });
    if (error) {
      console.error("[Email] Failed to send applicant confirmation:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[Email] Error sending applicant confirmation:", err);
    return false;
  }
}
async function sendAdminNotification(data) {
  try {
    const resend = getResend();
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [ADMIN_EMAIL],
      subject: `New Application: ${data.firstName} ${data.lastName} (Ref: ${data.referenceNumber})`,
      html: buildEmailHtml(data, true)
    });
    if (error) {
      console.error("[Email] Failed to send admin notification:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[Email] Error sending admin notification:", err);
    return false;
  }
}

// server/storage.ts
function getS3Config() {
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  const region = process.env.AWS_REGION ?? "us-east-1";
  const bucket = process.env.AWS_S3_BUCKET;
  const endpoint = process.env.AWS_S3_ENDPOINT;
  if (!accessKeyId || !secretAccessKey || !bucket) {
    throw new Error(
      "S3 credentials missing: set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and AWS_S3_BUCKET"
    );
  }
  return { accessKeyId, secretAccessKey, region, bucket, endpoint };
}
async function signedFetch(method, url, headers, body) {
  const { accessKeyId, secretAccessKey, region } = getS3Config();
  const service = "s3";
  const now = /* @__PURE__ */ new Date();
  const dateStamp = now.toISOString().slice(0, 10).replace(/-/g, "");
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const host = url.host;
  const canonicalHeaders = `host:${host}
x-amz-date:${amzDate}
`;
  const signedHeaders = "host;x-amz-date";
  const bodyBytes = body ? typeof body === "string" ? new TextEncoder().encode(body).buffer : body instanceof Buffer ? body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength) : body.buffer : new ArrayBuffer(0);
  const payloadHashBuffer = await crypto.subtle.digest("SHA-256", bodyBytes);
  const payloadHash = Array.from(new Uint8Array(payloadHashBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
  const canonicalRequest = [
    method,
    url.pathname,
    url.searchParams.toString(),
    canonicalHeaders,
    signedHeaders,
    payloadHash
  ].join("\n");
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const canonicalRequestHash = Array.from(
    new Uint8Array(
      await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(canonicalRequest)
      )
    )
  ).map((b) => b.toString(16).padStart(2, "0")).join("");
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    canonicalRequestHash
  ].join("\n");
  async function hmac(key, data) {
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      key,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    return crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(data));
  }
  const kDate = await hmac(new TextEncoder().encode(`AWS4${secretAccessKey}`).buffer, dateStamp);
  const kRegion = await hmac(kDate, region);
  const kService = await hmac(kRegion, service);
  const kSigning = await hmac(kService, "aws4_request");
  const signatureBuffer = await hmac(kSigning, stringToSign);
  const signature = Array.from(new Uint8Array(signatureBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
  const authorization = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  return fetch(url.toString(), {
    method,
    headers: {
      ...headers,
      "x-amz-date": amzDate,
      Authorization: authorization
    },
    body: body ? body : void 0
  });
}
function buildS3Url(key) {
  const { region, bucket, endpoint } = getS3Config();
  if (endpoint) {
    const base = endpoint.endsWith("/") ? endpoint : `${endpoint}/`;
    return new URL(`${base}${bucket}/${key}`);
  }
  return new URL(`https://${bucket}.s3.${region}.amazonaws.com/${key}`);
}
async function storagePut(relKey, data, contentType = "application/octet-stream") {
  const key = relKey.replace(/^\/+/, "");
  const url = buildS3Url(key);
  const response = await signedFetch(
    "PUT",
    url,
    {
      "Content-Type": contentType,
      "x-amz-acl": "public-read"
    },
    typeof data === "string" ? Buffer.from(data) : data
  );
  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText);
    throw new Error(
      `S3 upload failed (${response.status} ${response.statusText}): ${message}`
    );
  }
  return { key, url: url.toString() };
}

// server/routers.ts
import { z as z2 } from "zod";
var adminProcedure2 = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") throw new TRPCError3({ code: "FORBIDDEN", message: "Admin access required" });
  return next({ ctx });
});
var staffProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin" && ctx.user.role !== "worker")
    throw new TRPCError3({ code: "FORBIDDEN", message: "Staff access required" });
  return next({ ctx });
});
var householdMemberSchema = z2.object({ name: z2.string(), dateOfBirth: z2.string(), medicaidId: z2.string(), relationship: z2.string().optional().default("") });
var screeningQuestionsSchema = z2.object({
  livingSituation: z2.string().optional(),
  utilityShutoff: z2.string().optional(),
  receivesSnap: z2.string().optional(),
  receivesWic: z2.string().optional(),
  receivesTanf: z2.string().optional(),
  enrolledHealthHome: z2.string().optional(),
  householdMembersCount: z2.string().optional(),
  householdMembersWithMedicaid: z2.string().optional(),
  needsWorkAssistance: z2.string().optional(),
  wantsSchoolHelp: z2.string().optional(),
  transportationBarrier: z2.string().optional(),
  hasChronicIllness: z2.string().optional(),
  otherHealthIssues: z2.string().optional(),
  medicationsRequireRefrigeration: z2.string().optional(),
  pregnantOrPostpartum: z2.string().optional(),
  breastmilkRefrigeration: z2.string().optional()
});
var submissionInputSchema = z2.object({
  neighborhood: z2.string().optional().default(""),
  supermarket: z2.string().min(1),
  firstName: z2.string().min(1),
  lastName: z2.string().min(1),
  dateOfBirth: z2.string().min(1),
  medicaidId: z2.string().regex(/^[A-Za-z]{2}\d{5}[A-Za-z]$/, "Medicaid ID must be 2 letters, 5 numbers, 1 letter"),
  cellPhone: z2.string().min(1),
  homePhone: z2.string().optional(),
  email: z2.string().email(),
  streetAddress: z2.string().min(1),
  aptUnit: z2.string().optional(),
  city: z2.string().min(1),
  state: z2.string().min(1),
  zipcode: z2.string().min(1),
  healthCategories: z2.array(z2.string()).min(1, "At least one health category is required"),
  dueDate: z2.string().optional(),
  miscarriageDate: z2.string().optional(),
  infantName: z2.string().optional(),
  infantDateOfBirth: z2.string().optional(),
  infantMedicaidId: z2.string().optional(),
  employed: z2.string().min(1),
  spouseEmployed: z2.string().min(1),
  hasWic: z2.string().optional().default(""),
  hasSnap: z2.string().optional().default(""),
  foodAllergies: z2.string().optional(),
  foodAllergiesDetails: z2.string().optional(),
  dietaryRestrictions: z2.string().optional(),
  newApplicant: z2.string().min(1),
  transferAgencyName: z2.string().optional(),
  additionalMembersCount: z2.string().optional().default("0"),
  householdMembers: z2.array(householdMemberSchema),
  mealFocus: z2.array(z2.string()),
  breakfastItems: z2.string().optional(),
  lunchItems: z2.string().optional(),
  dinnerItems: z2.string().optional(),
  snackItems: z2.string().optional(),
  needsRefrigerator: z2.string().min(1),
  needsMicrowave: z2.string().min(1),
  needsCookingUtensils: z2.string().min(1),
  hipaaConsent: z2.boolean().refine((val) => val === true, { message: "HIPAA consent is required" }),
  guardianName: z2.string().min(1, "Guardian name is required"),
  signatureDataUrl: z2.string().min(1, "Electronic signature is required"),
  ref: z2.string().optional(),
  screeningQuestions: screeningQuestionsSchema.optional(),
  uploadedDocuments: z2.record(z2.string(), z2.string()).optional()
}).passthrough();
var appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true };
    }),
    adminLogin: publicProcedure.input(z2.object({ email: z2.string().email(), password: z2.string().min(1) })).mutation(async ({ ctx, input }) => {
      const user = await getUserByEmail(input.email);
      if (!user || !user.passwordHash) {
        throw new TRPCError3({ code: "UNAUTHORIZED", message: "Invalid email or password" });
      }
      const valid = await bcrypt.compare(input.password, user.passwordHash);
      if (!valid) {
        throw new TRPCError3({ code: "UNAUTHORIZED", message: "Invalid email or password" });
      }
      if (user.role !== "admin" && user.role !== "worker") {
        throw new TRPCError3({ code: "FORBIDDEN", message: "Access denied: admin or worker role required" });
      }
      const sessionToken = await sdk.createSessionToken(user.openId, { name: user.name || "" });
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      return { success: true, role: user.role };
    })
  }),
  // ─── File Upload ──────────────────────────────────────────────────────────
  upload: router({
    document: publicProcedure.input(z2.object({ fileName: z2.string(), fileData: z2.string(), contentType: z2.string(), category: z2.string() })).mutation(async ({ input }) => {
      const buffer = Buffer.from(input.fileData, "base64");
      const suffix = Math.random().toString(36).substring(2, 8);
      const ext = input.fileName.split(".").pop() || "file";
      const key = `documents/${input.category}-${suffix}.${ext}`;
      const { url } = await storagePut(key, buffer, input.contentType);
      return { url, key };
    })
  }),
  // ─── Submission ───────────────────────────────────────────────────────────
  submission: router({
    submit: publicProcedure.input(submissionInputSchema).mutation(async ({ input }) => {
      const refNumber = Math.random().toString(36).substring(2, 8).toUpperCase();
      const consentAt = /* @__PURE__ */ new Date();
      console.log(`[Submission] Processing new submission for ${input.firstName} ${input.lastName} (ref: ${refNumber})`);
      try {
        await createSubmission({
          referenceNumber: refNumber,
          firstName: input.firstName,
          lastName: input.lastName,
          email: input.email,
          cellPhone: input.cellPhone,
          medicaidId: input.medicaidId,
          supermarket: input.supermarket,
          referralSource: input.ref ?? null,
          status: "new",
          stage: "referral",
          formData: input,
          hipaaConsentAt: consentAt,
          borough: input.city === "Brooklyn" ? "Brooklyn" : input.city,
          neighborhood: input.neighborhood || null,
          additionalMembersCount: parseInt(input.additionalMembersCount || "0") || 0
        });
        console.log(`[Submission] \u2713 Saved to database (ref: ${refNumber})`);
      } catch (dbErr) {
        const errMsg = dbErr?.message || String(dbErr);
        console.error(`[Submission] \u2717 Database save failed (ref: ${refNumber}): ${errMsg}`);
        if (errMsg.includes("DATABASE_URL")) {
          console.error("[Submission] CRITICAL: DATABASE_URL environment variable is not configured on this server!");
        }
        throw new TRPCError3({ code: "INTERNAL_SERVER_ERROR", message: "Failed to save application. Please try again." });
      }
      setTimeout(() => {
        try {
          if (input.ref) {
            incrementReferralUsage(input.ref).catch((err) => console.warn("[Referral] Failed to track:", err));
          }
          const emailPayload = { referenceNumber: refNumber, firstName: input.firstName, lastName: input.lastName, email: input.email, cellPhone: input.cellPhone, medicaidId: input.medicaidId, supermarket: input.supermarket, formData: input };
          sendApplicantConfirmation(emailPayload).catch((err) => console.warn("[Email] Applicant confirmation failed:", err));
          sendAdminNotification(emailPayload).catch((err) => console.warn("[Email] Admin notification failed:", err));
        } catch (bgErr) {
          console.warn("[Submission] Background tasks error (non-blocking):", bgErr);
        }
      }, 0);
      return { success: true, referenceNumber: refNumber };
    })
  }),
  // ─── Admin procedures ─────────────────────────────────────────────────────
  admin: router({
    // Dashboard stats
    stats: staffProcedure.query(async () => getSubmissionStats()),
    taskStats: staffProcedure.query(async () => getTaskStats()),
    recentClients: staffProcedure.input(z2.object({ days: z2.number().optional(), limit: z2.number().optional() }).optional()).query(async ({ input }) => getRecentSubmissions(input?.days ?? 7, input?.limit ?? 10)),
    recentlyUpdated: staffProcedure.input(z2.object({ days: z2.number().optional(), limit: z2.number().optional() }).optional()).query(async ({ input }) => getRecentlyUpdated(input?.days ?? 7, input?.limit ?? 10)),
    addedCount: staffProcedure.input(z2.object({ days: z2.number().optional() }).optional()).query(async ({ input }) => getAddedCount(input?.days ?? 7)),
    staffList: staffProcedure.query(async () => listStaffUsers()),
    // Client list
    list: staffProcedure.input(z2.object({
      search: z2.string().optional(),
      status: z2.enum(["all", "new", "in_review", "approved", "rejected", "on_hold"]).optional(),
      stage: z2.string().optional(),
      supermarket: z2.string().optional(),
      language: z2.string().optional(),
      borough: z2.string().optional(),
      assignedTo: z2.number().optional(),
      intakeRep: z2.number().optional(),
      page: z2.number().min(1).optional(),
      pageSize: z2.number().min(1).max(100).optional()
    })).query(async ({ input }) => listSubmissions(input)),
    getById: staffProcedure.input(z2.object({ id: z2.number() })).query(async ({ input }) => {
      const submission = await getSubmissionById(input.id);
      if (!submission) throw new TRPCError3({ code: "NOT_FOUND", message: "Client not found" });
      return submission;
    }),
    updateStatus: staffProcedure.input(z2.object({
      id: z2.number(),
      status: z2.enum(["new", "in_review", "approved", "rejected", "on_hold"]),
      adminNotes: z2.string().optional()
    })).mutation(async ({ input }) => {
      await updateSubmissionStatus(input.id, input.status, input.adminNotes);
      return { success: true };
    }),
    updateStage: staffProcedure.input(z2.object({
      id: z2.number(),
      stage: z2.enum(["referral", "assessment", "level_one_only", "level_one_household", "level_2_active", "ineligible", "provider_attestation_required", "flagged"])
    })).mutation(async ({ input }) => {
      await updateSubmissionStage(input.id, input.stage);
      return { success: true };
    }),
    updateAssignment: adminProcedure2.input(z2.object({
      id: z2.number(),
      assignedTo: z2.number().nullable(),
      intakeRep: z2.number().nullable().optional()
    })).mutation(async ({ input }) => {
      await updateSubmissionAssignment(input.id, input.assignedTo, input.intakeRep);
      return { success: true };
    }),
    // CSV Export
    exportCsv: staffProcedure.input(z2.object({
      status: z2.string().optional(),
      supermarket: z2.string().optional(),
      stage: z2.string().optional(),
      neighborhood: z2.string().optional(),
      language: z2.string().optional(),
      borough: z2.string().optional(),
      search: z2.string().optional()
    })).mutation(async ({ input }) => {
      const rows = await getAllSubmissions(input);
      const headers = ["Reference #", "First Name", "Last Name", "Email", "Phone", "Medicaid ID", "DOB", "Address", "City", "State", "Zip", "Language", "Neighborhood", "Vendor", "Stage", "Status", "Household Members", "Health Categories", "Referral Source", "Guardian Name", "Submitted"];
      const csvRows = rows.map((r) => {
        const fd = r.formData || {};
        const householdNames = (fd.householdMembers || []).map((m) => `${m.firstName || ""} ${m.lastName || ""} (${m.relationship || ""})`.trim()).join("; ");
        const healthCats = (fd.healthCategories || []).join("; ");
        return [
          r.referenceNumber,
          r.firstName,
          r.lastName,
          r.email,
          r.cellPhone,
          r.medicaidId,
          fd.dateOfBirth || "",
          fd.address || "",
          fd.city || "",
          fd.state || "",
          fd.zipCode || "",
          fd.language || r.language || "English",
          fd.neighborhood || "",
          r.supermarket,
          r.stage,
          r.status,
          householdNames,
          healthCats,
          r.referralSource || "",
          fd.guardianName || "",
          r.createdAt.toISOString()
        ];
      });
      const escape = (v) => `"${v.replace(/"/g, '""')}"`;
      const csv = [headers.map(escape).join(","), ...csvRows.map((row) => row.map(escape).join(","))].join("\n");
      return { csv, count: rows.length, headers, data: csvRows };
    }),
    // ─── Tasks ────────────────────────────────────────────────────────────
    tasks: router({
      list: staffProcedure.input(z2.object({
        search: z2.string().optional(),
        status: z2.enum(["all", "open", "completed", "verified"]).optional(),
        area: z2.enum(["all", "intake_rep", "assigned_worker"]).optional(),
        assignedTo: z2.number().optional(),
        page: z2.number().min(1).optional(),
        pageSize: z2.number().min(1).max(100).optional()
      })).query(async ({ input }) => listTasks(input)),
      stats: staffProcedure.query(async () => getTaskStats()),
      byClient: staffProcedure.input(z2.object({ submissionId: z2.number() })).query(async ({ input }) => getTasksBySubmission(input.submissionId)),
      create: staffProcedure.input(z2.object({
        submissionId: z2.number(),
        description: z2.string().min(1),
        area: z2.enum(["intake_rep", "assigned_worker"]),
        assignedTo: z2.number().optional()
      })).mutation(async ({ ctx, input }) => {
        const id = await createTask({ ...input, createdBy: ctx.user.id });
        return { success: true, id };
      }),
      updateStatus: staffProcedure.input(z2.object({
        id: z2.number(),
        status: z2.enum(["open", "completed", "verified"])
      })).mutation(async ({ input }) => {
        await updateTaskStatus(input.id, input.status);
        return { success: true };
      })
    }),
    // ─── Case Notes ───────────────────────────────────────────────────────
    notes: router({
      byClient: staffProcedure.input(z2.object({ submissionId: z2.number() })).query(async ({ input }) => getCaseNotesBySubmission(input.submissionId)),
      create: staffProcedure.input(z2.object({ submissionId: z2.number(), content: z2.string().min(1) })).mutation(async ({ ctx, input }) => {
        const id = await createCaseNote({ ...input, createdBy: ctx.user.id });
        return { success: true, id };
      })
    }),
    // ─── Documents ────────────────────────────────────────────────────────
    documents: router({
      byClient: staffProcedure.input(z2.object({ submissionId: z2.number() })).query(async ({ input }) => getDocumentsBySubmission(input.submissionId)),
      library: staffProcedure.input(z2.object({ category: z2.string().optional() }).optional()).query(async ({ input }) => getLibraryDocuments(input?.category)),
      upload: staffProcedure.input(z2.object({
        submissionId: z2.number().nullable(),
        name: z2.string(),
        category: z2.enum(["provider_attestation", "consent", "supporting_documentation", "id_document", "medicaid_card", "birth_certificate", "marriage_license", "forms", "uncategorized"]),
        fileData: z2.string(),
        contentType: z2.string()
      })).mutation(async ({ ctx, input }) => {
        const buffer = Buffer.from(input.fileData, "base64");
        const suffix = Math.random().toString(36).substring(2, 8);
        const ext = input.name.split(".").pop() || "file";
        const key = `admin-docs/${input.category}-${suffix}.${ext}`;
        const { url } = await storagePut(key, buffer, input.contentType);
        const id = await createDocument({
          submissionId: input.submissionId,
          name: input.name,
          category: input.category,
          url,
          fileKey: key,
          mimeType: input.contentType,
          fileSize: buffer.length,
          uploadedBy: ctx.user.id
        });
        return { success: true, id, url };
      }),
      delete: adminProcedure2.input(z2.object({ id: z2.number() })).mutation(async ({ input }) => {
        await deleteDocument(input.id);
        return { success: true };
      })
    }),
    // ─── Services ─────────────────────────────────────────────────────────
    services: router({
      byClient: staffProcedure.input(z2.object({ submissionId: z2.number() })).query(async ({ input }) => getServicesBySubmission(input.submissionId)),
      create: staffProcedure.input(z2.object({
        submissionId: z2.number(),
        name: z2.string().min(1),
        description: z2.string().optional(),
        startDate: z2.string().optional()
      })).mutation(async ({ ctx, input }) => {
        const id = await createService({
          submissionId: input.submissionId,
          name: input.name,
          description: input.description ?? null,
          startDate: input.startDate ? new Date(input.startDate) : /* @__PURE__ */ new Date(),
          createdBy: ctx.user.id
        });
        return { success: true, id };
      }),
      updateStatus: staffProcedure.input(z2.object({
        id: z2.number(),
        status: z2.enum(["active", "completed", "cancelled"])
      })).mutation(async ({ input }) => {
        await updateServiceStatus(input.id, input.status);
        return { success: true };
      })
    }),
    // ─── Client edit/delete ────────────────────────────────────────────────
    updateClient: staffProcedure.input(z2.object({
      id: z2.number(),
      firstName: z2.string().optional(),
      lastName: z2.string().optional(),
      email: z2.string().optional(),
      cellPhone: z2.string().optional(),
      medicaidId: z2.string().optional(),
      language: z2.string().optional(),
      program: z2.string().optional(),
      borough: z2.string().optional(),
      formData: z2.record(z2.string(), z2.unknown()).optional()
    })).mutation(async ({ input }) => {
      const { id, formData, ...fields } = input;
      const updateData = {};
      Object.entries(fields).forEach(([k, v]) => {
        if (v !== void 0) updateData[k] = v;
      });
      if (formData) {
        const existing = await getSubmissionById(id);
        if (existing) {
          const merged = { ...existing.formData, ...formData };
          updateData.formData = merged;
        }
      }
      await updateSubmissionFields(id, updateData);
      return { success: true };
    }),
    deleteClient: adminProcedure2.input(z2.object({ id: z2.number() })).mutation(async ({ input }) => {
      await deleteSubmission(input.id);
      return { success: true };
    }),
    // ─── Referral Links ──────────────────────────────────────────────────
    referrals: router({
      list: staffProcedure.query(async () => listReferralLinks()),
      stats: staffProcedure.query(async () => getReferralStats()),
      getByCode: publicProcedure.input(z2.object({ code: z2.string() })).query(async ({ input }) => {
        const link = await getReferralLinkByCode(input.code);
        return link || null;
      }),
      create: adminProcedure2.input(z2.object({
        code: z2.string().min(2).max(64),
        referrerName: z2.string().min(1),
        description: z2.string().optional(),
        email: z2.string().email().optional(),
        password: z2.string().min(6).optional()
      })).mutation(async ({ ctx, input }) => {
        const { password, ...rest } = input;
        const data = { ...rest, createdBy: ctx.user.id };
        if (input.email) data.email = input.email;
        if (password) data.passwordHash = await bcrypt.hash(password, 10);
        const id = await createReferralLink(data);
        return { success: true, id };
      }),
      update: adminProcedure2.input(z2.object({
        id: z2.number(),
        referrerName: z2.string().optional(),
        description: z2.string().optional(),
        isActive: z2.number().optional(),
        email: z2.string().email().optional(),
        password: z2.string().min(6).optional()
      })).mutation(async ({ input }) => {
        const { id, password, ...data } = input;
        const updateData = { ...data };
        if (password) updateData.passwordHash = await bcrypt.hash(password, 10);
        await updateReferralLink(id, updateData);
        return { success: true };
      }),
      delete: adminProcedure2.input(z2.object({ id: z2.number() })).mutation(async ({ input }) => {
        await deleteReferralLink(input.id);
        return { success: true };
      })
    }),
    // ─── Referrer Portal (public login + read-only access) ─────────────
    referrerPortal: router({
      login: publicProcedure.input(z2.object({
        email: z2.string().email(),
        password: z2.string()
      })).mutation(async ({ input }) => {
        const link = await getReferralLinkByEmail(input.email);
        if (!link || !link.passwordHash) throw new TRPCError3({ code: "UNAUTHORIZED", message: "Invalid email or password" });
        if (!link.isActive) throw new TRPCError3({ code: "FORBIDDEN", message: "This account has been deactivated" });
        const valid = await bcrypt.compare(input.password, link.passwordHash);
        if (!valid) throw new TRPCError3({ code: "UNAUTHORIZED", message: "Invalid email or password" });
        return { success: true, referrerId: link.id, referrerName: link.referrerName, code: link.code };
      }),
      myClients: publicProcedure.input(z2.object({
        code: z2.string()
      })).query(async ({ input }) => {
        const link = await getReferralLinkByCode(input.code);
        if (!link) throw new TRPCError3({ code: "NOT_FOUND", message: "Referral link not found" });
        const clients = await getClientsByReferralCode(link.code);
        return clients.map((c) => ({
          id: c.id,
          firstName: c.firstName,
          lastName: c.lastName,
          cellPhone: c.cellPhone,
          email: c.email,
          supermarket: c.supermarket,
          stage: c.stage,
          status: c.status,
          createdAt: c.createdAt,
          language: c.language
        }));
      }),
      myStats: publicProcedure.input(z2.object({
        code: z2.string()
      })).query(async ({ input }) => {
        const link = await getReferralLinkByCode(input.code);
        if (!link) throw new TRPCError3({ code: "NOT_FOUND", message: "Referral link not found" });
        const clients = await getClientsByReferralCode(link.code);
        const stages = {};
        clients.forEach((c) => {
          stages[c.stage] = (stages[c.stage] || 0) + 1;
        });
        return { totalClients: clients.length, stages, referrerName: link.referrerName, code: link.code };
      })
    }),
    // ─── Worker management ────────────────────────────────────────────────
    workers: router({
      list: adminProcedure2.query(async () => listWorkers()),
      allUsers: adminProcedure2.query(async () => listAllUsers()),
      promote: adminProcedure2.input(z2.object({
        userId: z2.number(),
        permissions: z2.object({ canView: z2.boolean(), canEdit: z2.boolean(), canExport: z2.boolean() })
      })).mutation(async ({ input }) => {
        await setUserRole(input.userId, "worker");
        await updateWorkerPermissions(input.userId, input.permissions);
        return { success: true };
      }),
      updatePermissions: adminProcedure2.input(z2.object({
        userId: z2.number(),
        permissions: z2.object({ canView: z2.boolean(), canEdit: z2.boolean(), canExport: z2.boolean() })
      })).mutation(async ({ input }) => {
        await updateWorkerPermissions(input.userId, input.permissions);
        return { success: true };
      }),
      toggleActive: adminProcedure2.input(z2.object({ userId: z2.number(), isActive: z2.boolean() })).mutation(async ({ input }) => {
        await toggleWorkerActive(input.userId, input.isActive);
        return { success: true };
      }),
      demote: adminProcedure2.input(z2.object({ userId: z2.number() })).mutation(async ({ input }) => {
        await setUserRole(input.userId, "user");
        return { success: true };
      })
    })
  })
});

// server/_core/context.ts
async function createContext(opts) {
  let user = null;
  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    user = null;
  }
  return {
    req: opts.req,
    res: opts.res,
    user
  };
}

// server/_core/vite.ts
import express from "express";
import fs from "fs";
import { nanoid } from "nanoid";
import path2 from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";

// vite.config.ts
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";
var vite_config_default = defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets")
    }
  },
  envDir: path.resolve(import.meta.dirname),
  root: path.resolve(import.meta.dirname, "client"),
  publicDir: path.resolve(import.meta.dirname, "client", "public"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true
  },
  server: {
    host: true,
    fs: {
      strict: true,
      deny: ["**/.*"]
    }
  }
});

// server/_core/vite.ts
var __filename = fileURLToPath(import.meta.url);
var __dirname = path2.dirname(__filename);
function serveStatic(app2) {
  const distPath = process.env.NODE_ENV === "development" ? path2.resolve(__dirname, "../..", "dist", "public") : fs.existsSync(path2.resolve(__dirname, "public")) ? path2.resolve(__dirname, "public") : path2.resolve(__dirname, "..", "dist", "public");
  if (!fs.existsSync(distPath)) {
    console.error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }
  app2.use(express.static(distPath));
  app2.use("*", (_req, res) => {
    res.sendFile(path2.resolve(distPath, "index.html"));
  });
}

// api/index.ts
var app = express2();
app.use(express2.json({ limit: "50mb" }));
app.use(express2.urlencoded({ limit: "50mb", extended: true }));
registerOAuthRoutes(app);
app.use(
  "/api/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext
  })
);
serveStatic(app);
var index_default = app;
export {
  index_default as default
};
