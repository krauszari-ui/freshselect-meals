import { int, json, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * role: super_admin (full control + user management), admin (full access), worker (limited access), viewer (read-only), user (public)
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin", "worker", "super_admin", "viewer"]).default("user").notNull(),
  /** Staff-specific: permissions JSON (e.g. { canView: true, canEdit: false, canExport: false, canDelete: false }) */
  permissions: json("permissions"),
  /** Hashed password for internal bcrypt authentication (null for legacy OAuth users) */
  passwordHash: varchar("passwordHash", { length: 256 }),
  /** Password reset token (hex string, single-use) */
  passwordResetToken: varchar("passwordResetToken", { length: 128 }),
  /** Password reset token expiry (UTC timestamp) */
  passwordResetExpires: timestamp("passwordResetExpires"),
  /** Whether the staff account is active */
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
 * Now also acts as the "client" record for the CareFlow-style admin.
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
  status: mysqlEnum("status", ["new", "in_review", "approved", "rejected", "on_hold"])
    .default("new")
    .notNull(),
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
  /** When the SCN assessment was marked completed by staff */
  assessmentCompletedAt: timestamp("assessmentCompletedAt"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Submission = typeof submissions.$inferSelect;
export type InsertSubmission = typeof submissions.$inferInsert;

/**
 * Tasks / Action Items — assigned to workers for specific clients.
 */
export const tasks = mysqlTable("tasks", {
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
  completedAt: timestamp("completedAt"),
});

export type Task = typeof tasks.$inferSelect;
export type InsertTask = typeof tasks.$inferInsert;

/**
 * Case Notes — notes added by workers/admins on a client record.
 */
export const caseNotes = mysqlTable("caseNotes", {
  id: int("id").autoincrement().primaryKey(),
  submissionId: int("submissionId").notNull(),
  content: text("content").notNull(),
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CaseNote = typeof caseNotes.$inferSelect;
export type InsertCaseNote = typeof caseNotes.$inferInsert;

/**
 * Documents — uploaded files associated with clients or the document library.
 */
export const documents = mysqlTable("documents", {
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
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Document = typeof documents.$inferSelect;
export type InsertDocument = typeof documents.$inferInsert;

/**
 * Services — services assigned to clients (e.g., Medically Tailored Food Prescription Boxes).
 */
export const services = mysqlTable("services", {
  id: int("id").autoincrement().primaryKey(),
  submissionId: int("submissionId").notNull(),
  name: varchar("name", { length: 256 }).notNull(),
  description: text("description"),
  startDate: timestamp("startDate"),
  endDate: timestamp("endDate"),
  status: mysqlEnum("status", ["active", "completed", "cancelled"]).default("active").notNull(),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Service = typeof services.$inferSelect;
export type InsertService = typeof services.$inferInsert;

/**
 * Referral Links — trackable links that attribute new clients to a referrer.
 */
export const referralLinks = mysqlTable("referralLinks", {
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
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ReferralLink = typeof referralLinks.$inferSelect;
export type InsertReferralLink = typeof referralLinks.$inferInsert;

// ─── Referrer Messages ────────────────────────────────────────────────────────
/**
 * Messages sent by admin staff to referrers.
 * Example: "@ah please get me the DOB from client one"
 * Each message is linked to a referral link (referrer) and optionally a specific client.
 */
export const referrerMessages = mysqlTable("referrerMessages", {
  id: int("id").autoincrement().primaryKey(),
  /** The referral link (referrer) this message is addressed to */
  referralLinkId: int("referralLinkId").notNull(),
  /** Optional: the specific client this message is about */
  submissionId: int("submissionId"),
  /** The admin user who sent the message (null if sent by referrer) */
  senderId: int("senderId"),
  /** Message text */
  message: text("message").notNull(),
  /** Direction: 'admin' = sent by staff to referrer, 'referrer' = reply from referrer */
  direction: varchar("direction", { length: 16 }).notNull().default("admin"),
  /** Optional file attachment URL */
  attachmentUrl: text("attachmentUrl"),
  /** When the referrer read/acknowledged the message (null = unread) */
  readAt: timestamp("readAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type ReferrerMessage = typeof referrerMessages.$inferSelect;
export type InsertReferrerMessage = typeof referrerMessages.$inferInsert;

// ─── Client Email Thread ──────────────────────────────────────────────────────
/**
 * Emails sent to/from clients directly from the admin panel.
 * Sent via Resend from info@freshselectmeals.com.
 * Inbound replies are captured via Resend webhook.
 */
export const clientEmails = mysqlTable("clientEmails", {
  id: int("id").autoincrement().primaryKey(),
  /** The client (submission) this email belongs to */
  submissionId: int("submissionId").notNull(),
  /** 'outbound' = sent by admin, 'inbound' = reply from client */
  direction: varchar("direction", { length: 16 }).notNull(),
  subject: varchar("subject", { length: 512 }).notNull(),
  body: text("body").notNull(),
  fromEmail: varchar("fromEmail", { length: 256 }).notNull(),
  toEmail: varchar("toEmail", { length: 256 }).notNull(),
  /** JSON array of S3 URLs for attachments */
  attachmentUrls: text("attachmentUrls"),
  /** Resend message ID for threading */
  resendMessageId: varchar("resendMessageId", { length: 256 }),
  /** In-reply-to header for threading */
  inReplyTo: varchar("inReplyTo", { length: 256 }),
  /** Staff member who sent (null for inbound) */
  sentBy: int("sentBy"),
  sentAt: timestamp("sentAt").defaultNow().notNull(),
});
export type ClientEmail = typeof clientEmails.$inferSelect;
export type InsertClientEmail = typeof clientEmails.$inferInsert;
