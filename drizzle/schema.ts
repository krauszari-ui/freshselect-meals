import { int, json, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * role: admin (full access), worker (limited access), user (public)
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin", "worker"]).default("user").notNull(),
  /** Worker-specific: permissions JSON (e.g. { canView: true, canEdit: false, canExport: false }) */
  permissions: json("permissions"),
  /** Worker-specific: whether the worker account is active */
  isActive: int("isActive").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Submissions table — stores every FreshSelect Meals application.
 * The full form payload is stored as JSON in `formData` for flexibility.
 */
export const submissions = mysqlTable("submissions", {
  id: int("id").autoincrement().primaryKey(),
  referenceNumber: varchar("referenceNumber", { length: 16 }).notNull().unique(),
  firstName: varchar("firstName", { length: 128 }).notNull(),
  lastName: varchar("lastName", { length: 128 }).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  cellPhone: varchar("cellPhone", { length: 32 }).notNull(),
  medicaidId: varchar("medicaidId", { length: 32 }).notNull(),
  supermarket: varchar("supermarket", { length: 128 }).notNull(),
  referralSource: varchar("referralSource", { length: 128 }),
  status: mysqlEnum("status", ["new", "in_review", "approved", "rejected", "on_hold"])
    .default("new")
    .notNull(),
  adminNotes: text("adminNotes"),
  /** Full form payload stored as JSON (includes screening answers, uploads, etc.) */
  formData: json("formData").notNull(),
  hipaaConsentAt: timestamp("hipaaConsentAt").notNull(),
  clickupTaskId: varchar("clickupTaskId", { length: 64 }),
  /** Whether confirmation email was sent */
  emailSentAt: timestamp("emailSentAt"),
  /** Assigned worker ID */
  assignedTo: int("assignedTo"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Submission = typeof submissions.$inferSelect;
export type InsertSubmission = typeof submissions.$inferInsert;
