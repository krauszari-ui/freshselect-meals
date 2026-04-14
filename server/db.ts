import { and, desc, eq, like, ne, or, sql, isNull, isNotNull, asc, gte, lte } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertSubmission, InsertUser, Submission, submissions, users,
  tasks, InsertTask, Task,
  caseNotes, InsertCaseNote, CaseNote,
  documents, InsertDocument, Document,
  services, InsertService, Service,
  referralLinks, InsertReferralLink, ReferralLink,
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
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
    else if (user.openId === ENV.ownerOpenId) { values.role = 'admin'; updateSet.role = 'admin'; }
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

// ─── Submission / Client helpers ──────────────────────────────────────────

export async function createSubmission(data: InsertSubmission): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
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

export interface ListSubmissionsOptions {
  search?: string;
  status?: Submission["status"] | "all";
  stage?: string;
  supermarket?: string;
  language?: string;
  borough?: string;
  assignedTo?: number;
  intakeRep?: number;
  page?: number;
  pageSize?: number;
}

export async function listSubmissions(opts: ListSubmissionsOptions = {}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { search, status, stage, supermarket, language, borough, assignedTo, intakeRep, page = 1, pageSize = 20 } = opts;
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
  if (supermarket && supermarket !== "all") conditions.push(eq(submissions.supermarket, supermarket));
  if (language && language !== "all") conditions.push(eq(submissions.language, language));
  if (borough && borough !== "all") conditions.push(eq(submissions.borough, borough));
  if (assignedTo) conditions.push(eq(submissions.assignedTo, assignedTo));
  if (intakeRep) conditions.push(eq(submissions.intakeRep, intakeRep));

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const [rows, countResult] = await Promise.all([
    db.select().from(submissions).where(where).orderBy(desc(submissions.createdAt)).limit(pageSize).offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(submissions).where(where),
  ]);
  const total = Number(countResult[0]?.count ?? 0);
  return { rows, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

export async function getAllSubmissions(opts: { status?: string; supermarket?: string; stage?: string } = {}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const conditions = [];
  if (opts.status && opts.status !== "all") conditions.push(eq(submissions.status, opts.status as Submission["status"]));
  if (opts.supermarket && opts.supermarket !== "all") conditions.push(eq(submissions.supermarket, opts.supermarket));
  if (opts.stage && opts.stage !== "all") conditions.push(eq(submissions.stage, opts.stage as Submission["stage"]));
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  return db.select().from(submissions).where(where).orderBy(desc(submissions.createdAt));
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
  const [statusResult, stageResult] = await Promise.all([
    db.select({ status: submissions.status, count: sql<number>`count(*)` }).from(submissions).groupBy(submissions.status),
    db.select({ stage: submissions.stage, count: sql<number>`count(*)` }).from(submissions).groupBy(submissions.stage),
  ]);
  const stats: Record<string, number> = { total: 0, new: 0, in_review: 0, approved: 0, rejected: 0, on_hold: 0 };
  for (const row of statusResult) { stats[row.status] = Number(row.count); stats.total += Number(row.count); }
  const stages: Record<string, number> = {};
  for (const row of stageResult) { stages[row.stage] = Number(row.count); }
  return { ...stats, stages };
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
  page?: number;
  pageSize?: number;
}

export async function listTasks(opts: ListTasksOptions = {}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { search, status, area, assignedTo, page = 1, pageSize = 20 } = opts;
  const offset = (page - 1) * pageSize;
  const conditions = [];
  if (search && search.trim()) conditions.push(like(tasks.description, `%${search.trim()}%`));
  if (status && status !== "all") conditions.push(eq(tasks.status, status));
  if (area && area !== "all") conditions.push(eq(tasks.area, area));
  if (assignedTo) conditions.push(eq(tasks.assignedTo, assignedTo));
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

export interface WorkerPermissions { canView: boolean; canEdit: boolean; canExport: boolean; }

export async function listWorkers() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(users).where(eq(users.role, "worker")).orderBy(desc(users.createdAt));
}

export async function listStaffUsers() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(users).where(or(eq(users.role, "worker"), eq(users.role, "admin"))).orderBy(desc(users.createdAt));
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

export async function setUserRole(userId: number, role: "user" | "admin" | "worker"): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set({ role }).where(eq(users.id, userId));
}

export async function listAllUsers() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(users).orderBy(desc(users.createdAt));
}

// ─── Submission update/delete helpers ────────────────────────────────────

export async function updateSubmissionFields(id: number, data: Partial<InsertSubmission>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(submissions).set(data).where(eq(submissions.id, id));
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
  return db.select().from(referralLinks).orderBy(desc(referralLinks.createdAt));
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

export async function getReferralStats() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const links = await db.select().from(referralLinks).orderBy(desc(referralLinks.usageCount));
  const totalReferrals = links.reduce((sum, l) => sum + l.usageCount, 0);
  return { links, totalReferrals, totalLinks: links.length };
}
