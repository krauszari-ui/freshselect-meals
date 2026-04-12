import { int, json, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
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
  // Core identifiers (indexed for fast search)
  firstName: varchar("firstName", { length: 128 }).notNull(),
  lastName: varchar("lastName", { length: 128 }).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  cellPhone: varchar("cellPhone", { length: 32 }).notNull(),
  medicaidId: varchar("medicaidId", { length: 32 }).notNull(),
  supermarket: varchar("supermarket", { length: 128 }).notNull(),
  // Referral source (from ?ref= query param)
  referralSource: varchar("referralSource", { length: 128 }),
  // Application status workflow
  status: mysqlEnum("status", ["new", "in_review", "approved", "rejected", "on_hold"])
    .default("new")
    .notNull(),
  // Admin notes
  adminNotes: text("adminNotes"),
  // Full form payload stored as JSON
  formData: json("formData").notNull(),
  // HIPAA consent timestamp
  hipaaConsentAt: timestamp("hipaaConsentAt").notNull(),
  // ClickUp task ID (if successfully sent)
  clickupTaskId: varchar("clickupTaskId", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Submission = typeof submissions.$inferSelect;
export type InsertSubmission = typeof submissions.$inferInsert;
