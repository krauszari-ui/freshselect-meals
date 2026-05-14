import { and, count, desc, eq, like, ne, notInArray, or, sql, isNull, isNotNull, asc, gte, lte, inArray } from "drizzle-orm";
import { drizzle, type MySql2Database } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import {
  InsertSubmission, InsertUser, Submission, submissions, users,
  tasks, InsertTask, Task,
  caseNotes, InsertCaseNote, CaseNote,
  documents, InsertDocument, Document,
  services, InsertService, Service,
  referralLinks, InsertReferralLink, ReferralLink,
  stageHistory, InsertStageHistory,
  notifications, InsertNotification, Notification,
  notificationReads,
  auditLogs,
  emailBlasts,
} from "../drizzle/schema";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _db: MySql2Database<Record<string, unknown>> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      const url = new URL(process.env.DATABASE_URL);
      // TiDB Cloud / PlanetScale require SSL
      const sslConfig = url.hostname.includes("localhost") || url.hostname.includes("127.0.0.1")
        ? undefined
        : { rejectUnauthorized: true };
      // Explicit pool: 2-5 connections is ideal for serverless (Vercel) where
      // each function invocation is short-lived. Keeps warm connections without
      // exhausting the DB's connection limit.
      const pool = mysql.createPool({
        uri: url.toString(),
        ssl: sslConfig,
        connectionLimit: 20,
        waitForConnections: true,
        queueLimit: 0,
        enableKeepAlive: true,
        keepAliveInitialDelay: 10000,
        idleTimeout: 60_000,
      });
      _db = drizzle(pool);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) { console.warn("[Database] Cannot upsert user: database not available"); return; }
  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};
    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];
    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
    if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
    if (!values.lastSignedIn) values.lastSignedIn = new Date();
    if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) { console.error("[Database] Failed to upsert user:", error); throw error; }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ─── Submission / Client helpers ──────────────────────────────────────────

export async function createSubmission(data: InsertSubmission): Promise<void> {
  const db = await getDb();
  if (!db) {
    const reason = process.env.DATABASE_URL ? "connection failed" : "DATABASE_URL env var is not set";
    console.error(`[Database] createSubmission failed: ${reason}`);
    throw new Error(`Database not available: ${reason}`);
  }
  await db.insert(submissions).values(data);
}

export async function getSubmissionByRef(referenceNumber: string): Promise<Submission | undefined> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.select().from(submissions).where(eq(submissions.referenceNumber, referenceNumber)).limit(1);
  return result[0];
}

export async function getSubmissionById(id: number): Promise<Submission | undefined> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.select().from(submissions).where(eq(submissions.id, id)).limit(1);
  return result[0];
}
export async function getSubmissionByMedicaidId(medicaidId: string): Promise<Submission | undefined> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.select().from(submissions).where(eq(submissions.medicaidId, medicaidId)).orderBy(desc(submissions.createdAt)).limit(1);
  return result[0];
}

export interface ListSubmissionsOptions {
  search?: string;
  status?: Submission["status"] | "all";
  stage?: string;
  excludeStage?: string;
  excludeStages?: string[];
  supermarket?: string;
  neighborhood?: string;
  program?: string;
  newApplicant?: string;
  language?: string;
  borough?: string;
  assignedTo?: number;
  intakeRep?: number;
  referralSource?: string;
  assessmentCompleted?: boolean;
  zipcode?: string;
  priority?: string;
  sortDir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

export async function listSubmissions(opts: ListSubmissionsOptions = {}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { search, status, stage, excludeStage, excludeStages, supermarket, neighborhood, program, newApplicant, language, borough, assignedTo, intakeRep, referralSource, assessmentCompleted, zipcode, priority, sortDir = "desc", page = 1, pageSize = 20 } = opts;
  const offset = (page - 1) * pageSize;
  const conditions = [];

  if (search && search.trim()) {
    const q = `%${search.trim()}%`;
    conditions.push(or(
      like(submissions.firstName, q), like(submissions.lastName, q),
      like(submissions.email, q), like(submissions.medicaidId, q),
      like(submissions.referenceNumber, q), like(submissions.cellPhone, q)
    ));
  }
  if (status && status !== "all") conditions.push(eq(submissions.status, status));
  if (stage && stage !== "all") conditions.push(eq(submissions.stage, stage as Submission["stage"]));
  if (excludeStage && excludeStage !== "all") conditions.push(ne(submissions.stage, excludeStage as Submission["stage"]));
  if (excludeStages && excludeStages.length > 0) conditions.push(notInArray(submissions.stage, excludeStages as Submission["stage"][]));
  if (supermarket && supermarket !== "all") conditions.push(eq(submissions.supermarket, supermarket));
  if (neighborhood && neighborhood !== "all") conditions.push(eq(submissions.neighborhood, neighborhood));
  if (program && program !== "all") conditions.push(eq(submissions.program, program));
  if (newApplicant && newApplicant !== "all") conditions.push(eq(submissions.newApplicant, newApplicant));
  if (language && language !== "all") conditions.push(eq(submissions.language, language));
  if (borough && borough !== "all") conditions.push(eq(submissions.borough, borough));
  if (assignedTo) conditions.push(eq(submissions.assignedTo, assignedTo));
  if (intakeRep) conditions.push(eq(submissions.intakeRep, intakeRep));
  if (referralSource && referralSource !== "all") conditions.push(eq(submissions.referralSource, referralSource));
  if (assessmentCompleted === true) conditions.push(sql`${submissions.assessmentCompletedAt} IS NOT NULL`);
  else if (assessmentCompleted === false) conditions.push(sql`${submissions.assessmentCompletedAt} IS NULL`);
  if (zipcode && zipcode !== "all") conditions.push(eq(submissions.zipcode, zipcode));
  if (priority && priority !== "all") conditions.push(eq(submissions.priority, priority as Submission["priority"]));

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const [rows, countResult, membersResult] = await Promise.all([
    db.select({
      id: submissions.id, firstName: submissions.firstName, lastName: submissions.lastName,
      email: submissions.email, cellPhone: submissions.cellPhone, medicaidId: submissions.medicaidId,
      referenceNumber: submissions.referenceNumber, status: submissions.status, stage: submissions.stage,
      supermarket: submissions.supermarket, neighborhood: submissions.neighborhood, borough: submissions.borough,
      zipcode: submissions.zipcode, newApplicant: submissions.newApplicant, program: submissions.program,
      language: submissions.language, additionalMembersCount: submissions.additionalMembersCount,
      assignedTo: submissions.assignedTo, intakeRep: submissions.intakeRep, referralSource: submissions.referralSource,
      createdAt: submissions.createdAt, updatedAt: submissions.updatedAt,
      assessmentCompletedAt: submissions.assessmentCompletedAt,
      transferAgencyName: submissions.transferAgencyName,
      priority: submissions.priority,
      approvedBy: submissions.approvedBy,
      rejectedBy: submissions.rejectedBy,
      missingInfoNote: submissions.missingInfoNote,
      notEligibleReason: submissions.notEligibleReason,
    }).from(submissions).where(where).orderBy(sortDir === "asc" ? asc(submissions.createdAt) : desc(submissions.createdAt)).limit(pageSize).offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(submissions).where(where),
    db.select({ totalAdditional: sql<number>`COALESCE(SUM(additionalMembersCount), 0)`, totalClients: sql<number>`count(*)` }).from(submissions).where(where),
  ]);
  const total = Number(countResult[0]?.count ?? 0);
  const totalAdditional = Number(membersResult[0]?.totalAdditional ?? 0);
  const totalClients = Number(membersResult[0]?.totalClients ?? 0);
  // totalMembers = each client counts as 1 (primary) + their additional household members
  const totalMembers = totalClients + totalAdditional;
  return { rows, total, page, pageSize, totalPages: Math.ceil(total / pageSize), totalMembers };
}

export async function getAllSubmissions(opts: { status?: string; supermarket?: string; stage?: string; neighborhood?: string; language?: string; borough?: string; search?: string; assignedTo?: number; intakeRep?: number; referralSource?: string } = {}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const conditions = [];
  if (opts.status && opts.status !== "all") conditions.push(eq(submissions.status, opts.status as Submission["status"]));
  if (opts.supermarket && opts.supermarket !== "all") conditions.push(eq(submissions.supermarket, opts.supermarket));
  if (opts.stage && opts.stage !== "all") conditions.push(eq(submissions.stage, opts.stage as Submission["stage"]));
  if (opts.language && opts.language !== "all") conditions.push(eq(submissions.language, opts.language));
  if (opts.borough && opts.borough !== "all") conditions.push(eq(submissions.borough, opts.borough));
  if (opts.neighborhood && opts.neighborhood !== "all") conditions.push(eq(submissions.neighborhood, opts.neighborhood));
  if (opts.assignedTo) conditions.push(eq(submissions.assignedTo, opts.assignedTo));
  if (opts.intakeRep) conditions.push(eq(submissions.intakeRep, opts.intakeRep));
  if (opts.referralSource && opts.referralSource !== "all") conditions.push(eq(submissions.referralSource, opts.referralSource));
  if (opts.search) {
    const term = `%${opts.search}%`;
    conditions.push(or(like(submissions.firstName, term), like(submissions.lastName, term), like(submissions.medicaidId, term)) as any);
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const rows = await db.select().from(submissions).where(where).orderBy(desc(submissions.createdAt));
  return rows;
}

// Server-side cache for filterCounts (30 second TTL)
let _filterCountsCache: { data: Awaited<ReturnType<typeof _getFilterCountsRaw>>; expiresAt: number } | null = null;

export async function _getFilterCountsRaw() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Single query using conditional aggregation — one table scan instead of 8
  const result = await db.execute(sql`
    SELECT
      stage                                                      AS dim,
      'stage'                                                    AS category,
      COUNT(*)                                                   AS cnt
    FROM submissions GROUP BY stage
    UNION ALL
    SELECT neighborhood, 'neighborhood', COUNT(*)
    FROM submissions WHERE neighborhood IS NOT NULL AND neighborhood != '' GROUP BY neighborhood
    UNION ALL
    SELECT supermarket, 'vendor', COUNT(*)
    FROM submissions WHERE supermarket IS NOT NULL AND supermarket != '' GROUP BY supermarket
    UNION ALL
    SELECT program, 'program', COUNT(*)
    FROM submissions WHERE program IS NOT NULL AND program != '' GROUP BY program
    UNION ALL
    SELECT language, 'language', COUNT(*)
    FROM submissions WHERE language IS NOT NULL AND language != '' GROUP BY language
    UNION ALL
    SELECT borough, 'borough', COUNT(*)
    FROM submissions WHERE borough IS NOT NULL AND borough != '' GROUP BY borough
    UNION ALL
    SELECT newApplicant, 'applicantType', COUNT(*)
    FROM submissions WHERE newApplicant IS NOT NULL AND newApplicant != '' GROUP BY newApplicant
    UNION ALL
    SELECT zipcode, 'zipcode', COUNT(*)
    FROM submissions WHERE zipcode IS NOT NULL AND zipcode != '' GROUP BY zipcode
  `);
  const out: Record<string, Record<string, number>> = {
    stage: {}, neighborhood: {}, vendor: {}, program: {}, language: {}, borough: {}, applicantType: {}, zipcode: {},
  };
  // Drizzle mysql2 execute() returns [rows, fields] — extract rows from index 0
  const rows = (Array.isArray((result as any)[0]) ? (result as any)[0] : result) as any[];
  for (const row of rows) {
    const cat = row.category as string;
    const dim = row.dim as string;
    if (cat && dim && out[cat] !== undefined) out[cat][dim] = Number(row.cnt);
  }
  return out;
}

/** Reset the filter counts cache — for testing only */
export function _resetFilterCountsCache() { _filterCountsCache = null; }

// Returns per-value counts for all filterable dimensions — cached 30s to reduce DB load
export async function getFilterCounts() {
  const now = Date.now();
  if (_filterCountsCache && _filterCountsCache.expiresAt > now) return _filterCountsCache.data;
  const data = await _getFilterCountsRaw();
  _filterCountsCache = { data, expiresAt: now + 30_000 };
  return data;
}

export async function updateSubmissionStatus(id: number, status: Submission["status"], adminNotes?: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const updateData: Partial<InsertSubmission> = { status };
  if (adminNotes !== undefined) updateData.adminNotes = adminNotes;
  await db.update(submissions).set(updateData).where(eq(submissions.id, id));
}

export async function updateSubmissionStage(id: number, stage: Submission["stage"]): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(submissions).set({ stage }).where(eq(submissions.id, id));
}

export async function updateSubmissionAssignment(id: number, assignedTo: number | null, intakeRep?: number | null): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const data: Record<string, unknown> = { assignedTo };
  if (intakeRep !== undefined) data.intakeRep = intakeRep;
  await db.update(submissions).set(data).where(eq(submissions.id, id));
}

export async function updateSubmissionEmailSent(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(submissions).set({ emailSentAt: new Date() }).where(eq(submissions.id, id));
}

export async function getSubmissionStats() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [statusResult, stageResult, membersResult] = await Promise.all([
    db.select({ status: submissions.status, count: sql<number>`count(*)` }).from(submissions).groupBy(submissions.status),
    db.select({ stage: submissions.stage, count: sql<number>`count(*)` }).from(submissions).groupBy(submissions.stage),
    db.select({ totalAdditional: sql<number>`COALESCE(SUM(additionalMembersCount), 0)`, totalApplications: sql<number>`count(*)` }).from(submissions),
  ]);
  const stats: Record<string, number> = { total: 0, new: 0, in_review: 0, approved: 0, rejected: 0, on_hold: 0 };
  for (const row of statusResult) { stats[row.status] = Number(row.count); stats.total += Number(row.count); }
  const stages: Record<string, number> = {};
  for (const row of stageResult) { stages[row.stage] = Number(row.count); }
  // Total members = sum of all additionalMembersCount + 1 per application (primary applicant)
  const totalAdditional = Number(membersResult[0]?.totalAdditional ?? 0);
  const totalApplications = Number(membersResult[0]?.totalApplications ?? 0);
  const totalMembers = totalAdditional + totalApplications;
  return { ...stats, stages, totalMembers };
}

export async function getRecentSubmissions(days: number = 7, limit: number = 10) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return db.select().from(submissions).where(gte(submissions.createdAt, since)).orderBy(desc(submissions.createdAt)).limit(limit);
}

export async function getRecentlyUpdated(days: number = 7, limit: number = 10) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return db.select().from(submissions).where(gte(submissions.updatedAt, since)).orderBy(desc(submissions.updatedAt)).limit(limit);
}

export async function getAddedCount(days: number = 7) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const result = await db.select({ count: sql<number>`count(*)` }).from(submissions).where(gte(submissions.createdAt, since));
  return Number(result[0]?.count ?? 0);
}

// ─── Task helpers ─────────────────────────────────────────────────────────

export async function createTask(data: InsertTask): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(tasks).values(data);
  return Number(result[0].insertId);
}

export async function getTasksBySubmission(submissionId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(tasks).where(eq(tasks.submissionId, submissionId)).orderBy(desc(tasks.createdAt));
}

export interface ListTasksOptions {
  search?: string;
  status?: "open" | "completed" | "verified" | "all";
  area?: "intake_rep" | "assigned_worker" | "all";
  assignedTo?: number;
  completedFrom?: string;
  completedTo?: string;
  page?: number;
  pageSize?: number;
}

export async function listTasks(opts: ListTasksOptions = {}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { search, status, area, assignedTo, completedFrom, completedTo, page = 1, pageSize = 20 } = opts;
  const offset = (page - 1) * pageSize;
  const conditions = [];
  if (search && search.trim()) conditions.push(like(tasks.description, `%${search.trim()}%`));
  if (status && status !== "all") conditions.push(eq(tasks.status, status));
  if (area && area !== "all") conditions.push(eq(tasks.area, area));
  if (assignedTo) conditions.push(eq(tasks.assignedTo, assignedTo));
  if (completedFrom) conditions.push(gte(tasks.completedAt, new Date(completedFrom)));
  if (completedTo) { const to = new Date(completedTo); to.setHours(23, 59, 59, 999); conditions.push(lte(tasks.completedAt, to)); }
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const [rows, countResult] = await Promise.all([
    db.select().from(tasks).where(where).orderBy(desc(tasks.createdAt)).limit(pageSize).offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(tasks).where(where),
  ]);
  return { rows, total: Number(countResult[0]?.count ?? 0), page, pageSize };
}

export async function getTaskStats() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.select({ status: tasks.status, count: sql<number>`count(*)` }).from(tasks).groupBy(tasks.status);
  const stats: Record<string, number> = { open: 0, completed: 0, verified: 0, total: 0 };
  for (const row of result) { stats[row.status] = Number(row.count); stats.total += Number(row.count); }
  return stats;
}

export async function updateTaskStatus(id: number, status: Task["status"]): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const data: Record<string, unknown> = { status };
  if (status === "completed") data.completedAt = new Date();
  await db.update(tasks).set(data).where(eq(tasks.id, id));
}

// ─── Case Notes helpers ───────────────────────────────────────────────────

export async function createCaseNote(data: InsertCaseNote): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(caseNotes).values(data);
  return Number(result[0].insertId);
}

export async function getCaseNotesBySubmission(submissionId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(caseNotes).where(eq(caseNotes.submissionId, submissionId)).orderBy(desc(caseNotes.createdAt));
}

// ─── Document helpers ─────────────────────────────────────────────────────

export async function createDocument(data: InsertDocument): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(documents).values(data);
  return Number(result[0].insertId);
}

export async function getDocumentsBySubmission(submissionId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(documents).where(eq(documents.submissionId, submissionId)).orderBy(desc(documents.createdAt));
}

export async function getLibraryDocuments(category?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const conditions = [isNull(documents.submissionId)];
  if (category && category !== "all") conditions.push(eq(documents.category, category as Document["category"]));
  return db.select().from(documents).where(and(...conditions)).orderBy(desc(documents.createdAt));
}

export async function deleteDocument(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(documents).where(eq(documents.id, id));
}

// ─── Service helpers ──────────────────────────────────────────────────────

export async function createService(data: InsertService): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(services).values(data);
  return Number(result[0].insertId);
}

export async function getServicesBySubmission(submissionId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(services).where(eq(services.submissionId, submissionId)).orderBy(desc(services.createdAt));
}

export async function updateServiceStatus(id: number, status: Service["status"]): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(services).set({ status }).where(eq(services.id, id));
}

// ─── Worker management helpers ────────────────────────────────────────────

export interface WorkerPermissions { canView: boolean; canEdit: boolean; canExport: boolean; canDelete: boolean; }

// Safe user columns — never include passwordHash or passwordResetToken in list responses
const SAFE_USER_COLUMNS = {
  id: users.id,
  openId: users.openId,
  name: users.name,
  email: users.email,
  loginMethod: users.loginMethod,
  role: users.role,
  permissions: users.permissions,
  isActive: users.isActive,
  createdAt: users.createdAt,
  updatedAt: users.updatedAt,
  lastSignedIn: users.lastSignedIn,
} as const;

export async function listWorkers() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select(SAFE_USER_COLUMNS).from(users).where(eq(users.role, "worker")).orderBy(desc(users.createdAt));
}

export async function listStaffUsers() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select(SAFE_USER_COLUMNS).from(users).where(
    or(eq(users.role, "worker"), eq(users.role, "admin"), eq(users.role, "super_admin"), eq(users.role, "viewer"), eq(users.role, "assessor"))
  ).orderBy(desc(users.createdAt));
}

export async function createStaffUser(data: {
  email: string;
  name: string;
  passwordHash: string;
  role: "admin" | "worker" | "viewer" | "assessor";
  permissions?: WorkerPermissions;
}): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Generate a unique openId for internal staff accounts
  const openId = `staff_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const [result] = await db.insert(users).values({
    openId,
    email: data.email,
    name: data.name,
    passwordHash: data.passwordHash,
    role: data.role,
    loginMethod: "password",
    permissions: (data.permissions ?? { canView: true, canEdit: false, canExport: false, canDelete: false }) as unknown as null,
    isActive: 1,
  });
  return (result as any).insertId;
}

export async function setPasswordResetToken(userId: number, token: string, expires: Date): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set({ passwordResetToken: token, passwordResetExpires: expires }).where(eq(users.id, userId));
}

export async function getUserByResetToken(token: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db.select().from(users).where(eq(users.passwordResetToken, token)).limit(1);
  return rows[0] ?? null;
}

export async function clearPasswordResetToken(userId: number, newPasswordHash: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set({ passwordHash: newPasswordHash, passwordResetToken: null, passwordResetExpires: null }).where(eq(users.id, userId));
}

export async function updateWorkerPermissions(userId: number, permissions: WorkerPermissions): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set({ permissions: permissions as unknown as null }).where(eq(users.id, userId));
}

export async function toggleWorkerActive(userId: number, isActive: boolean): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set({ isActive: isActive ? 1 : 0 }).where(eq(users.id, userId));
}

/** Increment failed login counter and optionally set a lockout expiry */
export async function recordFailedLogin(userId: number): Promise<{ attempts: number; lockedUntil: Date | null }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Atomically increment and fetch
  await db.update(users)
    .set({ failedLoginAttempts: sql`failedLoginAttempts + 1` })
    .where(eq(users.id, userId));
  const [row] = await db.select({ failedLoginAttempts: users.failedLoginAttempts, lockedUntil: users.lockedUntil })
    .from(users).where(eq(users.id, userId)).limit(1);
  const attempts = row?.failedLoginAttempts ?? 1;
  let lockedUntil: Date | null = row?.lockedUntil ?? null;
  // 10+ attempts → lock for 1 hour; 15+ → lock for 24 hours (require reset)
  if (attempts >= 15) {
    lockedUntil = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await db.update(users).set({ lockedUntil }).where(eq(users.id, userId));
  } else if (attempts >= 10) {
    lockedUntil = new Date(Date.now() + 60 * 60 * 1000);
    await db.update(users).set({ lockedUntil }).where(eq(users.id, userId));
  }
  return { attempts, lockedUntil };
}

/** Clear failed login counter and lockout after a successful login */
export async function clearFailedLogins(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set({ failedLoginAttempts: 0, lockedUntil: null }).where(eq(users.id, userId));
}

export async function setUserRole(userId: number, role: "user" | "admin" | "worker" | "super_admin" | "viewer" | "assessor"): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set({ role }).where(eq(users.id, userId));
}

export async function listAllUsers() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select(SAFE_USER_COLUMNS).from(users).orderBy(desc(users.createdAt));
}

// ─── Submission update/delete helpers ────────────────────────────────────

export async function updateSubmissionFields(id: number, data: Partial<InsertSubmission>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(submissions).set(data).where(eq(submissions.id, id));
}

export async function updateSubmissionPriority(id: number, priority: Submission["priority"]): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(submissions).set({ priority }).where(eq(submissions.id, id));
}

export async function deleteSubmission(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Delete related records first
  await db.delete(tasks).where(eq(tasks.submissionId, id));
  await db.delete(caseNotes).where(eq(caseNotes.submissionId, id));
  await db.delete(documents).where(eq(documents.submissionId, id));
  await db.delete(services).where(eq(services.submissionId, id));
  await db.delete(submissions).where(eq(submissions.id, id));
}

export async function bulkDeleteSubmissions(ids: number[]): Promise<void> {
  if (!ids.length) return;
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Delete related records for all ids first
  for (const id of ids) {
    await db.delete(tasks).where(eq(tasks.submissionId, id));
    await db.delete(caseNotes).where(eq(caseNotes.submissionId, id));
    await db.delete(documents).where(eq(documents.submissionId, id));
    await db.delete(services).where(eq(services.submissionId, id));
  }
  // Delete all submissions in one query using IN clause
  await db.delete(submissions).where(sql`id IN (${sql.join(ids.map(id => sql`${id}`), sql`, `)})`);
}

// ─── Referral Link helpers ───────────────────────────────────────────────

export async function createReferralLink(data: InsertReferralLink): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(referralLinks).values(data);
  return Number(result[0].insertId);
}

export async function listReferralLinks() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db.select().from(referralLinks).orderBy(desc(referralLinks.createdAt));
  // SECURITY: never send bcrypt hashes to the client — strip before returning
  return rows.map(({ passwordHash: _ph, ...safe }) => safe);
}

export async function getReferralLinkByCode(code: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.select().from(referralLinks).where(eq(referralLinks.code, code)).limit(1);
  return result[0];
}

export async function updateReferralLink(id: number, data: Partial<InsertReferralLink>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(referralLinks).set(data).where(eq(referralLinks.id, id));
}

export async function deleteReferralLink(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(referralLinks).where(eq(referralLinks.id, id));
}

export async function incrementReferralUsage(code: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(referralLinks).set({ usageCount: sql`usageCount + 1` }).where(eq(referralLinks.code, code));
}

export async function getReferralLinkByEmail(email: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.select().from(referralLinks).where(eq(referralLinks.email, email)).limit(1);
  return result[0];
}

export async function getClientsByReferralCode(code: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(submissions).where(eq(submissions.referralSource, code)).orderBy(desc(submissions.createdAt));
}

export async function getReferralStats() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [links, membersResult] = await Promise.all([
    db.select().from(referralLinks).orderBy(desc(referralLinks.usageCount)),
    db.select({
      totalAdditional: sql<number>`COALESCE(SUM(additionalMembersCount), 0)`,
      totalPrimary: sql<number>`count(*)`
    }).from(submissions).where(sql`referralSource IS NOT NULL AND referralSource != ''`),
  ]);
  const totalReferrals = links.reduce((sum, l) => sum + l.usageCount, 0);
  const totalAdditional = Number(membersResult[0]?.totalAdditional ?? 0);
  const totalPrimary = Number(membersResult[0]?.totalPrimary ?? 0);
  const totalMembers = totalAdditional + totalPrimary;
  return { links, totalReferrals, totalLinks: links.length, totalMembers };
}

// ─── Referrer Messages ────────────────────────────────────────────────────────
import { referrerMessages, InsertReferrerMessage } from "../drizzle/schema";

export async function createReferrerMessage(data: InsertReferrerMessage): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(referrerMessages).values(data);
  return (result[0] as any).insertId as number;
}

export async function listReferrerMessages(referralLinkId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db
    .select({
      id: referrerMessages.id,
      referralLinkId: referrerMessages.referralLinkId,
      submissionId: referrerMessages.submissionId,
      senderId: referrerMessages.senderId,
      message: referrerMessages.message,
      direction: referrerMessages.direction,
      attachmentUrl: referrerMessages.attachmentUrl,
      createdAt: referrerMessages.createdAt,
      readAt: referrerMessages.readAt,
      clientFirstName: submissions.firstName,
      clientLastName: submissions.lastName,
    })
    .from(referrerMessages)
    .leftJoin(submissions, eq(referrerMessages.submissionId, submissions.id))
    .where(eq(referrerMessages.referralLinkId, referralLinkId))
    .orderBy(asc(referrerMessages.createdAt));
}
/** Staff-only: delete any referrer message by ID (no ownership check — caller must be staff). */
export async function deleteReferrerMessageById(messageId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(referrerMessages).where(eq(referrerMessages.id, messageId));
}
/** Referrer portal: delete a message only if it belongs to the given referral link. */
export async function deleteReferrerMessage(messageId: number, referralLinkId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Enforce ownership: only delete if the message belongs to the given referral link.
  // Without this check, any referrer with a valid code could delete another referrer's messages.
  await db.delete(referrerMessages).where(
    and(eq(referrerMessages.id, messageId), eq(referrerMessages.referralLinkId, referralLinkId))
  );
}
export async function markAllReferrerMessagesRead(referralLinkId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(referrerMessages)
    .set({ readAt: new Date() })
    .where(and(eq(referrerMessages.referralLinkId, referralLinkId), isNull(referrerMessages.readAt)));
}

export async function markReferrerMessageRead(messageId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(referrerMessages).set({ readAt: new Date() }).where(eq(referrerMessages.id, messageId));
}

export async function getUnreadCountByReferrer(): Promise<Record<number, number>> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db
    .select({
      referralLinkId: referrerMessages.referralLinkId,
      count: sql<number>`count(*)`,
    })
    .from(referrerMessages)
    .where(isNull(referrerMessages.readAt))
    .groupBy(referrerMessages.referralLinkId);
  const result: Record<number, number> = {};
  for (const row of rows) {
    result[row.referralLinkId] = Number(row.count);
  }
  return result;
}

export async function listReferrerMessagesBySubmission(submissionId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select({
    id: referrerMessages.id,
    referralLinkId: referrerMessages.referralLinkId,
    submissionId: referrerMessages.submissionId,
    senderId: referrerMessages.senderId,
    message: referrerMessages.message,
    direction: referrerMessages.direction,
    attachmentUrl: referrerMessages.attachmentUrl,
    createdAt: referrerMessages.createdAt,
    readAt: referrerMessages.readAt,
  }).from(referrerMessages)
    .where(eq(referrerMessages.submissionId, submissionId))
    .orderBy(asc(referrerMessages.createdAt));
}


// ─── Client Email Thread ──────────────────────────────────────────────────────
import { clientEmails, InsertClientEmail } from "../drizzle/schema";

export async function createClientEmail(data: InsertClientEmail): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(clientEmails).values(data);
  return (result[0] as any).insertId as number;
}

export async function listClientEmails(submissionId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(clientEmails)
    .where(eq(clientEmails.submissionId, submissionId))
    .orderBy(asc(clientEmails.sentAt));
}

export async function getClientEmailByResendId(resendMessageId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(clientEmails)
    .where(eq(clientEmails.resendMessageId, resendMessageId))
    .limit(1);
  return rows[0];
}

export async function getClientEmailBySubmissionAndSubject(submissionId: number, subject: string) {
  const db = await getDb();
  if (!db) return undefined;
  // Find the most recent outbound email with this subject for threading
  const rows = await db.select().from(clientEmails)
    .where(and(eq(clientEmails.submissionId, submissionId), eq(clientEmails.direction, "outbound")))
    .orderBy(desc(clientEmails.sentAt))
    .limit(1);
  return rows[0];
}

export async function deleteClientEmailById(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(clientEmails).where(eq(clientEmails.id, id));
}

// ─── Stage History ────────────────────────────────────────────────────────────

export async function createStageHistoryEntry(data: InsertStageHistory): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(stageHistory).values(data);
}

export async function getStageHistoryBySubmission(submissionId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(stageHistory)
    .where(eq(stageHistory.submissionId, submissionId))
    .orderBy(asc(stageHistory.createdAt));
}

// ─── Assessment Report ────────────────────────────────────────────────────────

export async function getAssessmentReport() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.execute(sql`
    SELECT
      stage,
      supermarket                                                     AS vendor,
      neighborhood,
      COUNT(*)                                                        AS total,
      SUM(CASE WHEN assessmentCompletedAt IS NOT NULL THEN 1 ELSE 0 END) AS completed,
      SUM(CASE WHEN assessmentCompletedAt IS NULL THEN 1 ELSE 0 END)     AS pending
    FROM submissions
    GROUP BY stage, supermarket, neighborhood
    ORDER BY stage, supermarket, neighborhood
  `);

  // Aggregate totals
  const byStage: Record<string, { total: number; completed: number; pending: number }> = {};
  const byVendor: Record<string, { total: number; completed: number; pending: number }> = {};
  const byNeighborhood: Record<string, { total: number; completed: number; pending: number }> = {};
  let grandTotal = 0, grandCompleted = 0, grandPending = 0;

  // Drizzle mysql2 execute() returns [rows, fields] — extract rows from index 0
  const rows = (Array.isArray((result as any)[0]) ? (result as any)[0] : result) as any[];
  for (const row of rows) {
    const total = Number(row.total);
    const completed = Number(row.completed);
    const pending = Number(row.pending);
    const stage = row.stage as string;
    const vendor = row.vendor as string;
    const neighborhood = (row.neighborhood as string) || "Unknown";

    grandTotal += total; grandCompleted += completed; grandPending += pending;

    if (!byStage[stage]) byStage[stage] = { total: 0, completed: 0, pending: 0 };
    byStage[stage].total += total; byStage[stage].completed += completed; byStage[stage].pending += pending;

    if (vendor) {
      if (!byVendor[vendor]) byVendor[vendor] = { total: 0, completed: 0, pending: 0 };
      byVendor[vendor].total += total; byVendor[vendor].completed += completed; byVendor[vendor].pending += pending;
    }

    if (neighborhood) {
      if (!byNeighborhood[neighborhood]) byNeighborhood[neighborhood] = { total: 0, completed: 0, pending: 0 };
      byNeighborhood[neighborhood].total += total; byNeighborhood[neighborhood].completed += completed; byNeighborhood[neighborhood].pending += pending;
    }
  }

  return { grandTotal, grandCompleted, grandPending, byStage, byVendor, byNeighborhood };
}

// ─── Completed Assessments Export ───────────────────────────────────────────

export async function getCompletedAssessmentsExport() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db
    .select()
    .from(submissions)
    .where(sql`${submissions.assessmentCompletedAt} IS NOT NULL`)
    .orderBy(asc(submissions.lastName), asc(submissions.firstName));
}

// ─── Bulk Fetch by IDs (for PDF export) ──────────────────────────────────────

export async function getSubmissionsByIds(ids: number[]) {
  if (ids.length === 0) return [];
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(submissions)
    .where(inArray(submissions.id, ids))
    .orderBy(asc(submissions.lastName), asc(submissions.firstName));
}

// ─── Notifications ────────────────────────────────────────────────────────────

export async function createNotification(payload: Omit<InsertNotification, "id" | "createdAt" | "isRead">) {
  const db = await getDb();
  if (!db) return null;
  // Keep isRead=false on the row for backwards compat; per-user state is in notificationReads
  const result = await db.insert(notifications).values({ ...payload, isRead: false });
  return (result[0] as any).insertId as number;
}

/** List notifications, annotating each with whether the given user has read it. */
export async function listNotifications(userId: number, limit = 50): Promise<(Notification & { isReadByUser: boolean })[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(notifications)
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
  if (rows.length === 0) return [];
  // Fetch which of these notifications the user has already read
  const notifIds = rows.map((r) => r.id);
  const readRows = await db.select({ notificationId: notificationReads.notificationId })
    .from(notificationReads)
    .where(and(eq(notificationReads.userId, userId), inArray(notificationReads.notificationId, notifIds)));
  const readSet = new Set(readRows.map((r) => r.notificationId));
  return rows.map((r) => ({ ...r, isReadByUser: readSet.has(r.id) }));
}

/** Count unread notifications for a specific user. */
export async function getUnreadNotificationCount(userId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  // Total notifications minus those the user has read
  const [totalRow] = await db.select({ count: count() }).from(notifications);
  const total = Number(totalRow?.count ?? 0);
  if (total === 0) return 0;
  const [readRow] = await db.select({ count: count() }).from(notificationReads)
    .where(eq(notificationReads.userId, userId));
  const readCount = Number(readRow?.count ?? 0);
  return Math.max(0, total - readCount);
}

/** Mark a single notification as read for a specific user (upsert — safe to call multiple times). */
export async function markNotificationRead(notificationId: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.insert(notificationReads)
    .values({ notificationId, userId })
    .onDuplicateKeyUpdate({ set: { readAt: new Date() } });
}

/** Mark all current notifications as read for a specific user. */
export async function markAllNotificationsRead(userId: number) {
  const db = await getDb();
  if (!db) return;
  const allNotifs = await db.select({ id: notifications.id }).from(notifications);
  if (allNotifs.length === 0) return;
  // Upsert a read receipt for every notification for this user
  await db.insert(notificationReads)
    .values(allNotifs.map((n) => ({ notificationId: n.id, userId })))
    .onDuplicateKeyUpdate({ set: { readAt: new Date() } });
}

export type { Notification };

// ── Audit Log helpers ───────────────────────────────────────────────────────────────────────────────

export interface LogAuditParams {
  actorId?: number | null;
  actorName?: string | null;
  action: string;
  clientId?: number | null;
  clientName?: string | null;
  details?: Record<string, unknown> | null;
  sessionId?: string | null;
}

/** Write an immutable audit log entry. Fire-and-forget: never throws. */
export async function logAudit(params: LogAuditParams): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;
    await db.insert(auditLogs).values({
      actorId: params.actorId ?? null,
      actorName: params.actorName ?? null,
      action: params.action,
      clientId: params.clientId ?? null,
      clientName: params.clientName ?? null,
      details: params.details ?? null,
      sessionId: params.sessionId ?? null,
    });
  } catch {
    // Audit log failures must never break the main operation
  }
}

export interface AuditLogRow {
  id: number;
  actorId: number | null;
  actorName: string | null;
  action: string;
  clientId: number | null;
  clientName: string | null;
  details: unknown;
  sessionId: string | null;
  createdAt: Date;
}

export async function getAuditLogs(opts: {
  limit?: number;
  offset?: number;
  action?: string;
  actorId?: number;
  clientId?: number;
}): Promise<{ rows: AuditLogRow[]; total: number }> {
  const db = await getDb();
  if (!db) return { rows: [], total: 0 };

  const { desc, eq: eqOp, and, count: countFn } = await import("drizzle-orm");
  const conditions: ReturnType<typeof eqOp>[] = [];
  if (opts.action) conditions.push(eqOp(auditLogs.action, opts.action));
  if (opts.actorId) conditions.push(eqOp(auditLogs.actorId, opts.actorId));
  if (opts.clientId) conditions.push(eqOp(auditLogs.clientId, opts.clientId));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [rows, totalResult] = await Promise.all([
    db.select().from(auditLogs)
      .where(where)
      .orderBy(desc(auditLogs.createdAt))
      .limit(opts.limit ?? 50)
      .offset(opts.offset ?? 0),
    db.select({ count: countFn() }).from(auditLogs).where(where),
  ]);

  return {
    rows: rows as AuditLogRow[],
    total: Number(totalResult[0]?.count ?? 0),
  };
}

/** Fetch all audit log entries for a given session UUID, ordered chronologically. */
export async function getAuditLogsBySession(sessionId: string): Promise<AuditLogRow[]> {
  const db = await getDb();
  if (!db) return [];
  const { eq, asc } = await import("drizzle-orm");
  const rows = await db.select().from(auditLogs)
    .where(eq(auditLogs.sessionId, sessionId))
    .orderBy(asc(auditLogs.createdAt));
  return rows as AuditLogRow[];
}

// ─── Email Blasts ─────────────────────────────────────────────────────────────

export async function createEmailBlast(data: {
  name: string;
  subject: string;
  body: string;
  filterStatus?: string | null;
  scheduledAt: Date;
  createdBy?: number;
}): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const result = await db.insert(emailBlasts).values({
    name: data.name,
    subject: data.subject,
    body: data.body,
    filterStatus: data.filterStatus ?? null,
    scheduledAt: data.scheduledAt,
    createdBy: data.createdBy ?? null,
    blastStatus: "scheduled",
  });
  return (result as any)[0]?.insertId ?? 0;
}

export async function updateEmailBlastCronUid(id: number, taskUid: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(emailBlasts).set({ scheduleCronTaskUid: taskUid }).where(eq(emailBlasts.id, id));
}

export async function updateEmailBlastStatus(
  id: number,
  status: "scheduled" | "sending" | "sent" | "cancelled" | "failed",
  counts?: { sentCount?: number; failedCount?: number; sentAt?: Date }
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(emailBlasts).set({
    blastStatus: status,
    ...(counts?.sentCount !== undefined ? { sentCount: counts.sentCount } : {}),
    ...(counts?.failedCount !== undefined ? { failedCount: counts.failedCount } : {}),
    ...(counts?.sentAt ? { sentAt: counts.sentAt } : {}),
  }).where(eq(emailBlasts.id, id));
}

export async function listEmailBlasts(): Promise<typeof emailBlasts.$inferSelect[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(emailBlasts).orderBy(desc(emailBlasts.createdAt));
}

export async function getEmailBlastByTaskUid(taskUid: string): Promise<typeof emailBlasts.$inferSelect | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(emailBlasts).where(eq(emailBlasts.scheduleCronTaskUid, taskUid)).limit(1);
  return rows[0] ?? null;
}

export async function cancelEmailBlast(id: number, taskUid?: string | null): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(emailBlasts).set({ blastStatus: "cancelled" }).where(eq(emailBlasts.id, id));
}

/** Get all client emails for a blast (optionally filtered by status) */
export async function getClientEmailsForBlast(filterStatus?: string | null): Promise<{ email: string; firstName: string; lastName: string }[]> {
  const db = await getDb();
  if (!db) return [];
  const conditions: ReturnType<typeof eq>[] = [];
  if (filterStatus && filterStatus !== "all") {
    conditions.push(eq(submissions.status, filterStatus as any));
  }
  const rows = await db.select({
    email: submissions.email,
    firstName: submissions.firstName,
    lastName: submissions.lastName,
  }).from(submissions).where(conditions.length > 0 ? and(...conditions) : undefined);
  // Deduplicate by email
  const seen = new Set<string>();
  return rows.filter(r => {
    if (!r.email || seen.has(r.email)) return false;
    seen.add(r.email);
    return true;
  });
}

export async function getEmailBlastById(id: number): Promise<typeof emailBlasts.$inferSelect | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(emailBlasts).where(eq(emailBlasts.id, id)).limit(1);
  return rows[0] ?? null;
}
