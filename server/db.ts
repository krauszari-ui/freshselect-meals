import { and, desc, eq, like, ne, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertSubmission, InsertUser, Submission, submissions, users } from "../drizzle/schema";
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
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
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

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// ─── Submission helpers ────────────────────────────────────────────────────

export async function createSubmission(data: InsertSubmission): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(submissions).values(data);
}

export async function getSubmissionByRef(referenceNumber: string): Promise<Submission | undefined> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db
    .select()
    .from(submissions)
    .where(eq(submissions.referenceNumber, referenceNumber))
    .limit(1);
  return result[0];
}

export async function getSubmissionById(id: number): Promise<Submission | undefined> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db
    .select()
    .from(submissions)
    .where(eq(submissions.id, id))
    .limit(1);
  return result[0];
}

export interface ListSubmissionsOptions {
  search?: string;
  status?: Submission["status"] | "all";
  supermarket?: string;
  page?: number;
  pageSize?: number;
}

export async function listSubmissions(opts: ListSubmissionsOptions = {}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const { search, status, supermarket, page = 1, pageSize = 20 } = opts;
  const offset = (page - 1) * pageSize;

  const conditions = [];

  if (search && search.trim()) {
    const q = `%${search.trim()}%`;
    conditions.push(
      or(
        like(submissions.firstName, q),
        like(submissions.lastName, q),
        like(submissions.email, q),
        like(submissions.medicaidId, q),
        like(submissions.referenceNumber, q),
        like(submissions.cellPhone, q)
      )
    );
  }

  if (status && status !== "all") {
    conditions.push(eq(submissions.status, status));
  }

  if (supermarket && supermarket !== "all") {
    conditions.push(eq(submissions.supermarket, supermarket));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [rows, countResult] = await Promise.all([
    db
      .select()
      .from(submissions)
      .where(where)
      .orderBy(desc(submissions.createdAt))
      .limit(pageSize)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)` })
      .from(submissions)
      .where(where),
  ]);

  const total = Number(countResult[0]?.count ?? 0);

  return { rows, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

export async function getAllSubmissions(opts: { status?: string; supermarket?: string } = {}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const conditions = [];
  if (opts.status && opts.status !== "all") {
    conditions.push(eq(submissions.status, opts.status as Submission["status"]));
  }
  if (opts.supermarket && opts.supermarket !== "all") {
    conditions.push(eq(submissions.supermarket, opts.supermarket));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  return db.select().from(submissions).where(where).orderBy(desc(submissions.createdAt));
}

export async function updateSubmissionStatus(
  id: number,
  status: Submission["status"],
  adminNotes?: string
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const updateData: Partial<InsertSubmission> = { status };
  if (adminNotes !== undefined) updateData.adminNotes = adminNotes;

  await db.update(submissions).set(updateData).where(eq(submissions.id, id));
}

export async function updateSubmissionEmailSent(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(submissions).set({ emailSentAt: new Date() }).where(eq(submissions.id, id));
}

export async function getSubmissionStats() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db
    .select({
      status: submissions.status,
      count: sql<number>`count(*)`,
    })
    .from(submissions)
    .groupBy(submissions.status);

  const stats: Record<string, number> = {
    total: 0,
    new: 0,
    in_review: 0,
    approved: 0,
    rejected: 0,
    on_hold: 0,
  };

  for (const row of result) {
    stats[row.status] = Number(row.count);
    stats.total += Number(row.count);
  }

  return stats;
}

// ─── Worker management helpers ────────────────────────────────────────────

export interface WorkerPermissions {
  canView: boolean;
  canEdit: boolean;
  canExport: boolean;
}

export async function listWorkers() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db
    .select()
    .from(users)
    .where(eq(users.role, "worker"))
    .orderBy(desc(users.createdAt));
}

export async function updateWorkerPermissions(
  userId: number,
  permissions: WorkerPermissions
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(users)
    .set({ permissions: permissions as unknown as null })
    .where(eq(users.id, userId));
}

export async function toggleWorkerActive(userId: number, isActive: boolean): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(users)
    .set({ isActive: isActive ? 1 : 0 })
    .where(eq(users.id, userId));
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
