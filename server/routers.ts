import { TRPCError } from "@trpc/server";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { randomUUID } from "crypto";
import { getSessionCookieOptions } from "./_core/cookies";

import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import {
  createSubmission, getAllSubmissions, getSubmissionById, getSubmissionStats,
  listAllUsers, listSubmissions, listWorkers, listStaffUsers, setUserRole,
  toggleWorkerActive, updateSubmissionStatus,
  updateSubmissionStage, updateSubmissionAssignment, updateWorkerPermissions,
  getRecentSubmissions, getRecentlyUpdated, getAddedCount,
  createTask, getTasksBySubmission, listTasks, getTaskStats, updateTaskStatus,
  createCaseNote, getCaseNotesBySubmission,
  createDocument, getDocumentsBySubmission, getLibraryDocuments, deleteDocument,
  createService, getServicesBySubmission, updateServiceStatus,
  updateSubmissionFields, updateSubmissionPriority, deleteSubmission, bulkDeleteSubmissions,
  createReferralLink, listReferralLinks, getReferralLinkByCode,
  updateReferralLink, deleteReferralLink, incrementReferralUsage, getReferralStats,
  getReferralLinkByEmail, getClientsByReferralCode, getUserByEmail,
  getSubmissionByRef,
  getSubmissionByMedicaidId,
  createStaffUser, setPasswordResetToken, getUserByResetToken, clearPasswordResetToken,
  createReferrerMessage, listReferrerMessages, listReferrerMessagesBySubmission, markReferrerMessageRead, getUnreadCountByReferrer,
  deleteReferrerMessage, deleteReferrerMessageById, markAllReferrerMessagesRead,
  createClientEmail, listClientEmails, deleteClientEmailById,
  createStageHistoryEntry, getStageHistoryBySubmission,
  getFilterCounts,
  getAssessmentReport,
  getCompletedAssessmentsExport,
  getSubmissionsByIds,
  createNotification, listNotifications, getUnreadNotificationCount,
  markNotificationRead, markAllNotificationsRead,
  logAudit, getAuditLogs, getAuditLogsBySession,
  type WorkerPermissions,
} from "./db";
import bcrypt from "bcryptjs";
import { sdk } from "./_core/sdk";
import { sendAdminNotification, sendApplicantConfirmation, sendEmail } from "./email";
import { generateAttestationPdf } from "./generateAttestationPdf";
import { storagePut } from "./storage";
import { z } from "zod";

// Admin-only guard middleware
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin" && ctx.user.role !== "super_admin")
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  return next({ ctx });
});

// Super-admin only guard
const superAdminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "super_admin")
    throw new TRPCError({ code: "FORBIDDEN", message: "Super admin access required" });
  return next({ ctx });
});

// Worker or Admin guard (read-only access — viewer and assessor can query but NOT mutate)
const staffProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin" && ctx.user.role !== "worker" && ctx.user.role !== "super_admin" && ctx.user.role !== "viewer" && ctx.user.role !== "assessor")
    throw new TRPCError({ code: "FORBIDDEN", message: "Staff access required" });
  return next({ ctx });
});

// Edit guard: worker (with canEdit), admin, super_admin — viewer and assessor are blocked
const editProcedure = protectedProcedure.use(({ ctx, next }) => {
  const role = ctx.user.role;
  if (role === "admin" || role === "super_admin") return next({ ctx });
  if (role === "worker") {
    const perms = (ctx.user as any).permissions;
    if (perms?.canEdit) return next({ ctx });
    throw new TRPCError({ code: "FORBIDDEN", message: "You do not have edit permission" });
  }
  throw new TRPCError({ code: "FORBIDDEN", message: "Edit access required" });
});

// Delete guard: worker (with canDelete), admin, super_admin only
const deleteProcedure = protectedProcedure.use(({ ctx, next }) => {
  const role = ctx.user.role;
  if (role === "admin" || role === "super_admin") return next({ ctx });
  if (role === "worker") {
    const perms = (ctx.user as any).permissions;
    if (perms?.canDelete) return next({ ctx });
    throw new TRPCError({ code: "FORBIDDEN", message: "You do not have delete permission" });
  }
  throw new TRPCError({ code: "FORBIDDEN", message: "Delete access required" });
});

// Assessor guard (assessor + admin + super_admin)
const assessorProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "assessor" && ctx.user.role !== "admin" && ctx.user.role !== "super_admin")
    throw new TRPCError({ code: "FORBIDDEN", message: "Assessor access required" });
  return next({ ctx });
});

const householdMemberSchema = z.object({ name: z.string(), dateOfBirth: z.string(), medicaidId: z.string(), relationship: z.string().optional().default("") });

// In-memory rate-limit map for logPageView: userId -> array of timestamps
const pageViewRateMap = new Map<number, number[]>();

const screeningQuestionsSchema = z.object({
  livingSituation: z.string().optional(), utilityShutoff: z.string().optional(),
  receivesSnap: z.string().optional(), receivesWic: z.string().optional(),
  receivesTanf: z.string().optional(), enrolledHealthHome: z.string().optional(),
  householdMembersCount: z.string().optional(), householdMembersWithMedicaid: z.string().optional(),
  needsWorkAssistance: z.string().optional(), wantsSchoolHelp: z.string().optional(),
  transportationBarrier: z.string().optional(), hasChronicIllness: z.string().optional(),
  otherHealthIssues: z.string().optional(), medicationsRequireRefrigeration: z.string().optional(),
  pregnantOrPostpartum: z.string().optional(), breastmilkRefrigeration: z.string().optional(),
});

const submissionInputSchema = z.object({
  neighborhood: z.string().optional().default(""),
  supermarket: z.string().min(1),
  firstName: z.string().min(1), lastName: z.string().min(1),
  dateOfBirth: z.string().min(1),
  medicaidId: z.string().regex(/^[A-Za-z]{2}\d{5}[A-Za-z]$/, "Medicaid ID must be 2 letters, 5 numbers, 1 letter"),
  cellPhone: z.string().min(1), homePhone: z.string().optional(),
  email: z.string().email(),
  streetAddress: z.string().min(1), aptUnit: z.string().optional(),
  city: z.string().min(1), state: z.string().min(1), zipcode: z.string().min(1),
  healthCategories: z.array(z.string()).min(1, "At least one health category is required"),
  dueDate: z.string().optional(), miscarriageDate: z.string().optional(),
  infantName: z.string().optional(), infantDateOfBirth: z.string().optional(), infantMedicaidId: z.string().optional(),
  employed: z.string().min(1), spouseEmployed: z.string().min(1),
  hasWic: z.string().optional().default(""), hasSnap: z.string().optional().default(""),
  foodAllergies: z.string().optional(), foodAllergiesDetails: z.string().optional(),
  dietaryRestrictions: z.string().optional(),
  newApplicant: z.string().min(1),
  transferAgencyName: z.string().optional(),
  additionalMembersCount: z.string().optional().default("0"),
  householdMembers: z.array(householdMemberSchema),
  mealFocus: z.array(z.string()),
  breakfastItems: z.string().optional(), lunchItems: z.string().optional(),
  dinnerItems: z.string().optional(), snackItems: z.string().optional(),
  needsRefrigerator: z.string().min(1), needsMicrowave: z.string().min(1), needsCookingUtensils: z.string().min(1),
  hipaaConsent: z.boolean().refine((val) => val === true, { message: "HIPAA consent is required" }),
  guardianName: z.string().min(1, "Guardian name is required"),
  // BUG-SEC3-B FIX: cap signature to ~375 KB decoded (500_000 base64 chars) to prevent DoS via huge SVG
  signatureDataUrl: z.string().min(1, "Electronic signature is required").max(500_000, "Signature data is too large"),
  ref: z.string().optional(),
  screeningQuestions: screeningQuestionsSchema.optional(),
  uploadedDocuments: z.record(z.string(), z.string()).optional(),
}).passthrough();

const SESSION_ID_COOKIE = "admin_session_id";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(async ({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      ctx.res.clearCookie(SESSION_ID_COOKIE, { ...cookieOptions, maxAge: -1 });
      if (ctx.user) {
        const ip = (ctx.req as any).ip ?? ctx.req.socket?.remoteAddress ?? "unknown";
        const sessionId = (ctx.req as any).cookies?.[SESSION_ID_COOKIE] ?? null;
        await logAudit({ actorId: ctx.user.id, actorName: ctx.user.name ?? ctx.user.email ?? "Staff", action: "logout", details: { ip }, sessionId });
      }
      return { success: true } as const;
    }),
    dbStatus: publicProcedure.query(async () => {
      const { getDb } = await import("./db");
      const db = await getDb();
      const hasDbUrl = !!process.env.DATABASE_URL;
      const dbConnected = !!db;
      let userCount = 0;
      if (db) {
        try {
          const { users } = await import("../drizzle/schema");
          const { sql } = await import("drizzle-orm");
          const result = await db.select({ count: sql<number>`count(*)` }).from(users);
          userCount = Number(result[0]?.count ?? 0);
        } catch (e) { userCount = -1; }
      }
      return { hasDbUrl, dbConnected, userCount };
    }),
    adminLogin: publicProcedure
      .input(z.object({ email: z.string().email(), password: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        const ip = (ctx.req as any).ip ?? ctx.req.socket?.remoteAddress ?? "unknown";
        const user = await getUserByEmail(input.email);
        if (!user || !user.passwordHash) {
          // Log failed attempt: unknown email
          await logAudit({ action: "login_failed", actorName: input.email, details: { reason: "unknown_email", ip } });
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid email or password" });
        }
        const valid = await bcrypt.compare(input.password, user.passwordHash);
        if (!valid) {
          // Log failed attempt: wrong password
          await logAudit({ actorId: user.id, actorName: user.email ?? input.email, action: "login_failed", details: { reason: "wrong_password", ip } });
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid email or password" });
        }
        if (user.role !== "admin" && user.role !== "worker" && user.role !== "super_admin" && user.role !== "viewer" && user.role !== "assessor") {
          await logAudit({ actorId: user.id, actorName: user.email ?? input.email, action: "login_failed", details: { reason: "insufficient_role", role: user.role, ip } });
          throw new TRPCError({ code: "FORBIDDEN", message: "Access denied: staff role required" });
        }
        // Reject deactivated accounts
        if (!user.isActive) {
          await logAudit({ actorId: user.id, actorName: user.email ?? input.email, action: "login_failed", details: { reason: "account_deactivated", ip } });
          throw new TRPCError({ code: "FORBIDDEN", message: "Your account has been deactivated. Please contact your administrator." });
        }
        // Generate a session UUID for activity grouping
        const sessionId = randomUUID();
        // Log successful login
        await logAudit({ actorId: user.id, actorName: user.email ?? input.email, action: "login_success", details: { role: user.role, ip }, sessionId });
        const sessionToken = await sdk.createSessionToken(user.openId, { name: user.name || "" });
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
        ctx.res.cookie(SESSION_ID_COOKIE, sessionId, { ...cookieOptions, maxAge: ONE_YEAR_MS });
        return { success: true, role: user.role } as const;
      }),
  }),

  // ─── File Upload ──────────────────────────────────────────────────────────
  upload: router({
    document: publicProcedure
      .input(z.object({ fileName: z.string(), fileData: z.string(), contentType: z.string(), category: z.string() }))
      .mutation(async ({ input }) => {
        // MIME type whitelist — reject anything that isn't a known safe document/image type
        const ALLOWED_MIME_TYPES: Record<string, string> = {
          "application/pdf": "pdf",
          "image/jpeg": "jpg",
          "image/png": "png",
          "image/webp": "webp",
          "image/gif": "gif",
          "application/msword": "doc",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
        };
        if (!ALLOWED_MIME_TYPES[input.contentType]) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `File type '${input.contentType}' is not allowed. Accepted types: PDF, JPG, PNG, WEBP, GIF, DOC, DOCX.`,
          });
        }
        // FIX: derive extension from MIME type, not from user-supplied filename
        // This prevents an attacker from uploading malicious.php with contentType=image/jpeg
        const safeExt = ALLOWED_MIME_TYPES[input.contentType];
        const buffer = Buffer.from(input.fileData, "base64");
        // BUG-SEC3-C FIX: use cryptographically random suffix (128-bit) instead of Math.random() (6 base-36 chars)
        const suffix = require("crypto").randomBytes(16).toString("hex");
        // FIX: sanitize category to alphanumeric + hyphens only to prevent S3 path traversal
        const safeCategory = input.category.replace(/[^a-zA-Z0-9-_]/g, "").slice(0, 50) || "doc";
        const key = `documents/${safeCategory}-${suffix}.${safeExt}`;
        const { url } = await storagePut(key, buffer, input.contentType);
        return { url, key };
      }),
  }),

  // ─── Submission ───────────────────────────────────────────────────────────
  submission: router({
    submit: publicProcedure.input(submissionInputSchema).mutation(async ({ input }) => {
      const refNumber = Math.random().toString(36).substring(2, 8).toUpperCase();
      const consentAt = new Date();

      console.log(`[Submission] Processing new submission (ref: ${refNumber})`);

      // Step 1: Save to database (this is the ONLY critical step)
      // Duplicate detection is now handled by the UNIQUE index on medicaidId (ER_DUP_ENTRY / errno 1062).
      // The pre-INSERT lookup has been removed to eliminate the read-before-write race condition under load.
      try {
        await createSubmission({
          referenceNumber: refNumber, firstName: input.firstName, lastName: input.lastName,
          email: input.email, cellPhone: input.cellPhone, medicaidId: input.medicaidId,
          supermarket: input.supermarket, referralSource: input.ref ?? null,
          status: "new", stage: "referral",
          formData: input as unknown as Record<string, unknown>,
          hipaaConsentAt: consentAt,
          borough: input.city === "Brooklyn" ? "Brooklyn" : input.city,
          neighborhood: input.neighborhood || null,
          additionalMembersCount: parseInt(input.additionalMembersCount || "0") || 0,
          newApplicant: input.newApplicant || null,
          transferAgencyName: (input as any).transferAgencyName || null,
          zipcode: input.zipcode ? String(input.zipcode).trim().substring(0, 5) : null,
        });
        console.log(`[Submission] ✓ Saved to database (ref: ${refNumber})`);
      } catch (dbErr: any) {
        // MySQL duplicate-key error (UNIQUE constraint on medicaidId)
        // Drizzle wraps the mysql2 error in dbErr.cause, so check both levels
        const isDupEntry = dbErr?.code === "ER_DUP_ENTRY" || dbErr?.errno === 1062
          || dbErr?.cause?.code === "ER_DUP_ENTRY" || dbErr?.cause?.errno === 1062;
        if (isDupEntry) {
          const dup = await getSubmissionByMedicaidId(input.medicaidId);
          throw new TRPCError({
            code: "CONFLICT",
            message: `DUPLICATE:${dup?.referenceNumber ?? "UNKNOWN"}`,
          });
        }
        const errMsg = dbErr?.message || String(dbErr);
        console.error(`[Submission] ✗ Database save failed (ref: ${refNumber}): ${errMsg}`);
        // Surface DB_URL missing error clearly in logs
        if (errMsg.includes("DATABASE_URL")) {
          console.error("[Submission] CRITICAL: DATABASE_URL environment variable is not configured on this server!");
        }
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to save application. Please try again." });
      }

      // ── Everything below is FIRE-AND-FORGET ──
      // These run in the background and NEVER affect the response to the user.
      // We use setTimeout(0) to fully detach from the request lifecycle.
      setTimeout(() => {
        try {
          // Track referral link usage
          if (input.ref) {
            incrementReferralUsage(input.ref).catch((err) => console.warn("[Referral] Failed to track:", err));
          }
          // Send emails (non-blocking, with individual try-catch)
          // _skipEmail: true suppresses Resend calls during load tests / CI
          const skipEmail = (input as any)._skipEmail === true;
          const emailPayload = { referenceNumber: refNumber, firstName: input.firstName, lastName: input.lastName, email: input.email, cellPhone: input.cellPhone, medicaidId: input.medicaidId, supermarket: input.supermarket, formData: input as unknown as Record<string, unknown> };
          if (!skipEmail) {
            sendApplicantConfirmation(emailPayload).catch((err) => console.warn("[Email] Applicant confirmation failed:", err));
            sendAdminNotification(emailPayload).catch((err) => console.warn("[Email] Admin notification failed:", err));
          } else {
            console.log(`[Email] Skipped (load test mode) for ref: ${refNumber}`);
          }
          // In-app notification for new submission
          createNotification({
            type: "new_submission",
            title: `New application: ${input.firstName} ${input.lastName}`,
            body: `Ref: ${refNumber} \u2014 ${input.supermarket} \u2014 ${input.email}`,
            link: `/admin/clients`,
            submissionId: null,
          }).catch((e: unknown) => console.warn("[Notification] new_submission:", e));

          // Generate Household Attestation + HIPAA PDF (non-blocking)
          generateAttestationPdf({
            applicantName: `${input.firstName} ${input.lastName}`,
            guardianName: input.guardianName,
            referenceNumber: refNumber,
            signatureDataUrl: input.signatureDataUrl,
            hipaaConsentAt: consentAt,
            householdMembers: input.householdMembers || [],
            medicaidId: input.medicaidId,
            supermarket: input.supermarket,
          }).then(async (pdfBytes) => {
            if (!pdfBytes) {
              console.warn(`[PDF] Attestation PDF generation returned null (ref: ${refNumber})`);
              return;
            }
            try {
              const suffix = Math.random().toString(36).substring(2, 8);
              const key = `attestations/${refNumber}-${suffix}.pdf`;
              const { url } = await storagePut(key, Buffer.from(pdfBytes), "application/pdf");
              console.log(`[PDF] ✓ Attestation PDF uploaded (ref: ${refNumber}): ${url}`);

              // Link the PDF to the submission in the documents table
              const submission = await getSubmissionByRef(refNumber);
              if (submission) {
                await createDocument({
                  submissionId: submission.id,
                  name: `Attestation & HIPAA Consent - ${input.firstName} ${input.lastName}`,
                  category: "consent",
                  url,
                  fileKey: key,
                  mimeType: "application/pdf",
                  fileSize: pdfBytes.length,
                });
                console.log(`[PDF] ✓ Attestation PDF linked to submission ${submission.id}`);
              }
            } catch (uploadErr) {
              console.error(`[PDF] Failed to upload/link attestation PDF (ref: ${refNumber}):`, uploadErr);
            }
          }).catch((pdfErr) => console.error(`[PDF] Attestation generation error (ref: ${refNumber}):`, pdfErr));
        } catch (bgErr) {
          console.warn("[Submission] Background tasks error (non-blocking):", bgErr);
        }
      }, 0);

      // Return success IMMEDIATELY after DB save
      return { success: true, referenceNumber: refNumber };
    }),
  }),

  // ─── Admin procedures ─────────────────────────────────────────────────────
  admin: router({
    // Dashboard stats
    stats: staffProcedure.query(async () => getSubmissionStats()),
    taskStats: staffProcedure.query(async () => getTaskStats()),
    recentClients: staffProcedure.input(z.object({ days: z.number().optional(), limit: z.number().optional() }).optional()).query(async ({ input }) => getRecentSubmissions(input?.days ?? 7, input?.limit ?? 10)),
    recentlyUpdated: staffProcedure.input(z.object({ days: z.number().optional(), limit: z.number().optional() }).optional()).query(async ({ input }) => getRecentlyUpdated(input?.days ?? 7, input?.limit ?? 10)),
    addedCount: staffProcedure.input(z.object({ days: z.number().optional() }).optional()).query(async ({ input }) => getAddedCount(input?.days ?? 7)),
    staffList: staffProcedure.query(async () => listStaffUsers()),

    // Assessor: list only assessment-completed clients
    assessorList: assessorProcedure.input(z.object({
      search: z.string().optional(),
      page: z.number().min(1).optional(),
      pageSize: z.number().min(1).max(200).optional(),
      tab: z.enum(["pending", "recorded", "missing_information", "not_eligible"]).optional(),
    })).query(async ({ input }) => {
      const tab = input.tab ?? "pending";
      // "pending": assessment completed, not yet categorised into a terminal assessor stage
      // "recorded": stage = assessment_recorded
      // "missing_information": stage = missing_information
      // "not_eligible": stage = not_eligible
      const terminalStages = ["assessment_recorded", "missing_information", "not_eligible"];
      const stageFilter =
        tab === "pending" ? undefined :
        tab === "recorded" ? "assessment_recorded" :
        tab === "missing_information" ? "missing_information" :
        "not_eligible";
      const result = await listSubmissions({
        search: input.search,
        page: input.page,
        pageSize: input.pageSize ?? 200,
        assessmentCompleted: true,
        stage: stageFilter,
        // For pending: exclude all terminal assessor stages so completed ones don't show
        ...(tab === "pending" ? { excludeStages: terminalStages } : {}),
      });
      return Array.isArray(result) ? result : (result as any).rows ?? [];
    }),

    // Client list
    list: staffProcedure.input(z.object({
      search: z.string().optional(),
      status: z.enum(["all", "new", "in_review", "approved", "rejected", "on_hold"]).optional(),
      stage: z.string().optional(),
      supermarket: z.string().optional(),
      neighborhood: z.string().optional(),
      program: z.string().optional(),
      newApplicant: z.string().optional(),
      language: z.string().optional(),
      borough: z.string().optional(),
      assignedTo: z.number().optional(),
      intakeRep: z.number().optional(),
      referralSource: z.string().optional(),
      assessmentCompleted: z.boolean().optional(),
      zipcode: z.string().optional(),
      priority: z.string().optional(),
      sortDir: z.enum(["asc", "desc"]).optional(),
      page: z.number().min(1).optional(),
      pageSize: z.number().min(1).max(100).optional(),
    })).query(async ({ input }) => listSubmissions(input)),

    updatePriority: staffProcedure.input(z.object({
      id: z.number(),
      priority: z.enum(["low", "normal", "high", "urgent"]),
    })).mutation(async ({ input, ctx }) => {
      await updateSubmissionPriority(input.id, input.priority);
      await logAudit({ actorId: ctx.user.id, actorName: ctx.user.name ?? ctx.user.email, action: "priority_changed", clientId: input.id, details: { priority: input.priority } });
      return { success: true };
    }),

    filterCounts: staffProcedure.query(async () => getFilterCounts()),
    getDuplicates: staffProcedure.query(async () => {
      const db = await (await import('./db')).getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DB unavailable' });
      const { sql, eq, and } = await import('drizzle-orm');
      // Duplicate Medicaid IDs
      const dupMedicaid = await db.execute(sql`
        SELECT medicaidId as matchKey, 'medicaid' as matchType, COUNT(*) as cnt,
          GROUP_CONCAT(id ORDER BY createdAt ASC SEPARATOR ',') as ids
        FROM submissions
        WHERE medicaidId IS NOT NULL AND medicaidId != ''
        GROUP BY medicaidId HAVING COUNT(*) > 1
      `);
      // Duplicate phones (normalized)
      const dupPhone = await db.execute(sql`
        SELECT REGEXP_REPLACE(cellPhone,'[^0-9]','') as matchKey, 'phone' as matchType, COUNT(*) as cnt,
          GROUP_CONCAT(id ORDER BY createdAt ASC SEPARATOR ',') as ids
        FROM submissions
        WHERE cellPhone IS NOT NULL AND cellPhone != ''
        GROUP BY REGEXP_REPLACE(cellPhone,'[^0-9]','')
        HAVING COUNT(*) > 1
      `);
      // Drizzle mysql2 execute() returns [rows, fields] — extract rows from index 0
      const medicaidRows = (Array.isArray((dupMedicaid as any)[0]) ? (dupMedicaid as any)[0] : dupMedicaid) as any[];
      const phoneRows = (Array.isArray((dupPhone as any)[0]) ? (dupPhone as any)[0] : dupPhone) as any[];
      const allGroups = [...medicaidRows, ...phoneRows];
      // Fetch full details for all flagged IDs
      const allIds = Array.from(new Set(allGroups.flatMap((g: any) => String(g.ids).split(',').map(Number))));
      if (allIds.length === 0) return [];
      const { submissions } = await import('../drizzle/schema');
      const { inArray } = await import('drizzle-orm');
      const rows = await db.select({
        id: submissions.id, firstName: submissions.firstName, lastName: submissions.lastName,
        medicaidId: submissions.medicaidId, cellPhone: submissions.cellPhone,
        email: submissions.email, createdAt: submissions.createdAt,
        stage: submissions.stage, status: submissions.status,
        supermarket: submissions.supermarket, neighborhood: submissions.neighborhood,
      }).from(submissions).where(inArray(submissions.id, allIds));
      const rowMap = new Map(rows.map(r => [r.id, r]));
      return allGroups.map((g: any) => ({
        matchKey: g.matchKey,
        matchType: g.matchType,
        count: Number(g.cnt),
        records: String(g.ids).split(',').map(Number).map(id => rowMap.get(id)).filter(Boolean),
      }));
    }),
    deleteDuplicate: deleteProcedure.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
      const { deleteSubmission } = await import('./db');
      const existing = await getSubmissionById(input.id);
      await deleteSubmission(input.id);
      await logAudit({ actorId: ctx.user.id, actorName: ctx.user.name ?? ctx.user.email ?? "Staff", action: "duplicate_deleted", clientId: input.id, clientName: existing ? `${existing.firstName} ${existing.lastName}` : undefined });
      return { success: true };
    }),

    assessmentReport: staffProcedure.query(async () => getAssessmentReport()),
    exportCompletedAssessments: staffProcedure.query(async () => getCompletedAssessmentsExport()),

    bulkGetByIds: staffProcedure.input(z.object({ ids: z.array(z.number()).min(1).max(200) })).query(async ({ input }) => {
      return getSubmissionsByIds(input.ids);
    }),

    getById: staffProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
      const submission = await getSubmissionById(input.id);
      if (!submission) throw new TRPCError({ code: "NOT_FOUND", message: "Client not found" });
      return submission;
    }),
    // ─── Referrer Notes (per client) ──────────────────────────────────────
    sendReferrerNote: staffProcedure.input(z.object({
      submissionId: z.number(),
      message: z.string().min(1).max(2000),
      attachmentUrl: z.string().optional(),
    })).mutation(async ({ ctx, input }) => {
      const submission = await getSubmissionById(input.submissionId);
      if (!submission) throw new TRPCError({ code: "NOT_FOUND", message: "Client not found" });
      if (!submission.referralSource) throw new TRPCError({ code: "BAD_REQUEST", message: "This client has no referrer" });
      const link = await getReferralLinkByCode(submission.referralSource);
      if (!link) throw new TRPCError({ code: "NOT_FOUND", message: "Referral link not found" });
      const id = await createReferrerMessage({
        referralLinkId: link.id,
        submissionId: input.submissionId,
        senderId: ctx.user.id,
        message: input.message,
        attachmentUrl: input.attachmentUrl ?? null,
      });
      return { success: true, id };
    }),
    listReferrerNotes: staffProcedure.input(z.object({
      submissionId: z.number(),
    })).query(async ({ input }) => {
      const submission = await getSubmissionById(input.submissionId);
      if (!submission || !submission.referralSource) return [];
      const link = await getReferralLinkByCode(submission.referralSource);
      if (!link) return [];
      return listReferrerMessagesBySubmission(input.submissionId);
    }),
    deleteReferrerNote: deleteProcedure.input(z.object({
      messageId: z.number(),
    })).mutation(async ({ input }) => {
      await deleteReferrerMessageById(input.messageId);
      return { success: true };
    }),

    // ─── Client Email Thread ──────────────────────────────────────────────
    sendClientEmail: staffProcedure.input(z.object({
      submissionId: z.number(),
      subject: z.string().max(512).optional(),
      body: z.string().min(1),
      attachmentUrls: z.array(z.string()).optional(),
    })).mutation(async ({ ctx, input }) => {
      const submission = await getSubmissionById(input.submissionId);
      if (!submission) throw new TRPCError({ code: "NOT_FOUND", message: "Client not found" });
      if (!submission.email) throw new TRPCError({ code: "BAD_REQUEST", message: "Client has no email address" });
      // Use a client-specific reply-to so inbound replies are automatically matched to this client.
      // Format: reply-{submissionId}@freshselectmeals.com
      // Resend inbound webhook at /api/inbound-email parses this to find the right client record.
      const INBOUND_DOMAIN = process.env.RESEND_INBOUND_DOMAIN ?? "inbound.freshselectmeals.com";
      const replyTo = `reply-${input.submissionId}@${INBOUND_DOMAIN}`;
      const fromEmail = process.env.RESEND_FROM_EMAIL ?? `FreshSelect Meals <admin@freshselectmeals.com>`;
      const resolvedSubject = input.subject?.trim() || "Message from FreshSelect Meals";
      // HTML-escape the body so staff cannot accidentally or maliciously inject HTML/scripts
      const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
      const safeBody = escapeHtml(input.body).replace(/\n/g, "<br/>");
      // Validate attachment URLs — only allow https:// to prevent javascript: injection
      const safeAttachmentUrls = (input.attachmentUrls ?? []).filter((u) => u.startsWith("https://"));
      const success = await sendEmail({
        to: submission.email,
        subject: resolvedSubject,
        replyTo,
        html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
          <p style="color:#2d5a27;font-weight:bold;">FreshSelect Meals</p>
          ${safeBody}
          ${safeAttachmentUrls.length > 0 ? `<hr/><p style="font-size:13px;color:#666;">Attachments: ${safeAttachmentUrls.map((u, i) => `<a href="${escapeHtml(u)}">Attachment ${i + 1}</a>`).join(", ")}</p>` : ""}
          <hr/><p style="font-size:12px;color:#999;">FreshSelect Meals &mdash; (718) 307-4664 | admin@freshselectmeals.com<br/>To reply, simply reply to this email.</p>
        </div>`,
      });
       if (!success) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to send email" });
      const id = await createClientEmail({
        submissionId: input.submissionId,
        direction: "outbound",
        subject: resolvedSubject,
        body: input.body,
        fromEmail: fromEmail,
        toEmail: submission.email,
        attachmentUrls: input.attachmentUrls ? JSON.stringify(input.attachmentUrls) : null,
        sentBy: ctx.user.id,
      });
      await logAudit({ actorId: ctx.user.id, actorName: ctx.user.name ?? ctx.user.email ?? "Staff", action: "email_sent", clientId: input.submissionId, clientName: submission ? `${submission.firstName} ${submission.lastName}` : undefined, details: { subject: resolvedSubject, to: submission.email } });
      return { success: true, id };
    }),
    listClientEmails: staffProcedure.input(z.object({
      submissionId: z.number(),
    })).query(async ({ input }) => {
      return listClientEmails(input.submissionId);
    }),
    deleteClientEmail: deleteProcedure.input(z.object({
      id: z.number(),
    })).mutation(async ({ input, ctx }) => {
      await deleteClientEmailById(input.id);
      await logAudit({ actorId: ctx.user.id, actorName: ctx.user.name ?? ctx.user.email ?? "Staff", action: "email_deleted", details: { emailId: input.id } });
      return { success: true };
    }),

    updateStatus: editProcedure.input(z.object({
      id: z.number(),
      status: z.enum(["new", "in_review", "approved", "rejected", "on_hold"]),
      adminNotes: z.string().optional(),
    })).mutation(async ({ input, ctx }) => {
      const existing = await getSubmissionById(input.id);
      await updateSubmissionStatus(input.id, input.status, input.adminNotes);
      await logAudit({ actorId: ctx.user.id, actorName: ctx.user.name ?? ctx.user.email ?? "Staff", action: "status_changed", clientId: input.id, clientName: existing ? `${existing.firstName} ${existing.lastName}` : undefined, details: { from: existing?.status ?? null, to: input.status } });
      return { success: true };
    }),

    updateStage: editProcedure.input(z.object({
      id: z.number(),
      stage: z.enum(["referral", "assessment", "assessment_recorded", "missing_information", "not_eligible", "level_one_only", "level_one_household", "level_2_active", "ineligible", "provider_attestation_required", "flagged"]),
    })).mutation(async ({ input, ctx }) => {
      // Fetch current stage for history
      const existing = await getSubmissionById(input.id);
      await updateSubmissionStage(input.id, input.stage);
      // Log stage change to history
      await createStageHistoryEntry({
        submissionId: input.id,
        fromStage: existing?.stage ?? null,
        toStage: input.stage,
        changedBy: ctx.user.id,
        changedByName: ctx.user.name ?? ctx.user.email ?? "Staff",
      });
      // Audit log
      await logAudit({
        actorId: ctx.user.id, actorName: ctx.user.name ?? ctx.user.email ?? "Staff",
        action: "stage_changed",
        clientId: input.id,
        clientName: existing ? `${existing.firstName} ${existing.lastName}` : undefined,
        details: { from: existing?.stage ?? null, to: input.stage },
      });
      return { success: true };
    }),

    stageHistory: staffProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
      return getStageHistoryBySubmission(input.id);
    }),

    updateAssignment: adminProcedure.input(z.object({
      id: z.number(), assignedTo: z.number().nullable(), intakeRep: z.number().nullable().optional(),
    })).mutation(async ({ input, ctx }) => {
      const existing = await getSubmissionById(input.id);
      await updateSubmissionAssignment(input.id, input.assignedTo, input.intakeRep);
      await logAudit({ actorId: ctx.user.id, actorName: ctx.user.name ?? ctx.user.email ?? "Admin", action: "assignment_changed", clientId: input.id, clientName: existing ? `${existing.firstName} ${existing.lastName}` : undefined, details: { assignedTo: input.assignedTo, intakeRep: input.intakeRep } });
      return { success: true };
    }),

    // CSV Export
    exportCsv: staffProcedure.input(z.object({
      status: z.string().optional(), supermarket: z.string().optional(), stage: z.string().optional(),
      neighborhood: z.string().optional(), language: z.string().optional(), borough: z.string().optional(),
      search: z.string().optional(),
      assignedTo: z.number().optional(), intakeRep: z.number().optional(),
      referralSource: z.string().optional(), program: z.string().optional(),
      assessmentCompleted: z.boolean().optional(),
    }))
      .mutation(async ({ input }) => {
        // 'assessment_completed' is a virtual filter — maps to assessmentCompletedAt IS NOT NULL
        const { assessmentCompleted, program, assignedTo, intakeRep, referralSource, ...baseFilters } = input;
        let rows = await getAllSubmissions({ ...baseFilters, assignedTo, intakeRep, referralSource });
        if (assessmentCompleted === true) rows = rows.filter((r: any) => r.assessmentCompletedAt != null);
        if (assessmentCompleted === false) rows = rows.filter((r: any) => r.assessmentCompletedAt == null);
        if (program && program !== "all") rows = rows.filter((r: any) => r.program === program);
        const headers = ["Reference #", "First Name", "Last Name", "Email", "Phone", "Medicaid ID", "DOB", "Address", "City", "State", "Zip", "Language", "Neighborhood", "Vendor", "Stage", "Status", "Household Members", "Health Categories", "Referral Source", "Guardian Name", "Submitted"];
        const csvRows = rows.map((r) => {
          const fd = (r.formData as any) || {};
          const householdNames = (fd.householdMembers || []).map((m: any) => `${m.firstName || ""} ${m.lastName || ""} (${m.relationship || ""})`.trim()).join("; ");
          const healthCats = (fd.healthCategories || []).join("; ");
          return [
            r.referenceNumber, r.firstName, r.lastName, r.email, r.cellPhone, r.medicaidId,
            fd.dateOfBirth || "", fd.address || "", fd.city || "", fd.state || "", fd.zipCode || "",
            fd.language || r.language || "English", fd.neighborhood || "", r.supermarket, r.stage, r.status,
            householdNames, healthCats, r.referralSource || "", fd.guardianName || "",
            r.createdAt.toISOString()
          ];
        });
        const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
        const csv = [headers.map(escape).join(","), ...csvRows.map((row) => row.map(escape).join(","))].join("\n");
        return { csv, count: rows.length, headers, data: csvRows };
      }),

    // ─── Tasks ────────────────────────────────────────────────────────────
    tasks: router({
      list: staffProcedure.input(z.object({
        search: z.string().optional(),
        status: z.enum(["all", "open", "completed", "verified"]).optional(),
        area: z.enum(["all", "intake_rep", "assigned_worker"]).optional(),
        assignedTo: z.number().optional(),
        completedFrom: z.string().optional(),
        completedTo: z.string().optional(),
        page: z.number().min(1).optional(), pageSize: z.number().min(1).max(100).optional(),
      })).query(async ({ input }) => listTasks(input)),

      stats: staffProcedure.query(async () => getTaskStats()),

      byClient: staffProcedure.input(z.object({ submissionId: z.number() })).query(async ({ input }) => getTasksBySubmission(input.submissionId)),

      create: editProcedure.input(z.object({
        submissionId: z.number(), description: z.string().min(1),
        area: z.enum(["intake_rep", "assigned_worker"]),
        assignedTo: z.number().optional(),
      })).mutation(async ({ ctx, input }) => {
        const id = await createTask({ ...input, createdBy: ctx.user.id });
        const client = await getSubmissionById(input.submissionId);
        await logAudit({ actorId: ctx.user.id, actorName: ctx.user.name ?? ctx.user.email ?? "Staff", action: "task_created", clientId: input.submissionId, clientName: client ? `${client.firstName} ${client.lastName}` : undefined, details: { description: input.description, area: input.area } });
        return { success: true, id };
      }),

      updateStatus: editProcedure.input(z.object({
        id: z.number(), status: z.enum(["open", "completed", "verified"]),
      })).mutation(async ({ input, ctx }) => {
        await updateTaskStatus(input.id, input.status);
        await logAudit({ actorId: ctx.user.id, actorName: ctx.user.name ?? ctx.user.email ?? "Staff", action: "task_status_changed", details: { taskId: input.id, status: input.status } });
        return { success: true };
      }),
    }),

    // ─── Case Notes ───────────────────────────────────────────────────────
    notes: router({
      byClient: staffProcedure.input(z.object({ submissionId: z.number() })).query(async ({ input }) => getCaseNotesBySubmission(input.submissionId)),
      create: editProcedure.input(z.object({ submissionId: z.number(), content: z.string().min(1) }))
        .mutation(async ({ ctx, input }) => {
          const id = await createCaseNote({ ...input, createdBy: ctx.user.id });
          const client = await getSubmissionById(input.submissionId);
          await logAudit({ actorId: ctx.user.id, actorName: ctx.user.name ?? ctx.user.email ?? "Staff", action: "case_note_added", clientId: input.submissionId, clientName: client ? `${client.firstName} ${client.lastName}` : undefined, details: { preview: input.content.substring(0, 120) } });
          return { success: true, id };
        }),
    }),

    // ─── Documents ────────────────────────────────────────────────────────
    documents: router({
      byClient: staffProcedure.input(z.object({ submissionId: z.number() })).query(async ({ input }) => getDocumentsBySubmission(input.submissionId)),
      library: staffProcedure.input(z.object({ category: z.string().optional() }).optional()).query(async ({ input }) => getLibraryDocuments(input?.category)),
      upload: editProcedure.input(z.object({
        submissionId: z.number().nullable(), name: z.string(), category: z.enum(["provider_attestation", "consent", "supporting_documentation", "id_document", "medicaid_card", "birth_certificate", "marriage_license", "forms", "uncategorized"]),
        fileData: z.string(), contentType: z.string(),
      })).mutation(async ({ ctx, input }) => {
        // MIME type whitelist — same allowed set as the public upload endpoint
        const ALLOWED_MIME_TYPES = new Set([
          "application/pdf",
          "image/jpeg",
          "image/png",
          "image/webp",
          "image/gif",
          "application/msword",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ]);
        if (!ALLOWED_MIME_TYPES.has(input.contentType)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `File type '${input.contentType}' is not allowed. Accepted types: PDF, JPG, PNG, WEBP, GIF, DOC, DOCX.`,
          });
        }
        const buffer = Buffer.from(input.fileData, "base64");
        // BUG-SEC-B FIX: enforce 10 MB server-side limit on decoded bytes
        const MAX_ADMIN_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB
        if (buffer.length > MAX_ADMIN_UPLOAD_BYTES) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "File is too large. Maximum allowed size is 10 MB." });
        }
        // BUG-SEC3-C FIX: use cryptographically random suffix (128-bit) instead of Math.random()
        const suffix = require("crypto").randomBytes(16).toString("hex");
        // BUG-SEC-C FIX: derive extension from MIME type, not user-supplied filename
        // Prevents name="evil.php" with contentType=image/jpeg from storing a .php key in S3
        const MIME_TO_EXT: Record<string, string> = {
          "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png",
          "image/webp": "webp", "image/gif": "gif", "application/msword": "doc",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
        };
        const safeExt = MIME_TO_EXT[input.contentType] ?? "bin";
        const key = `admin-docs/${input.category}-${suffix}.${safeExt}`;
        const { url } = await storagePut(key, buffer, input.contentType);
        const id = await createDocument({
          submissionId: input.submissionId, name: input.name, category: input.category,
          url, fileKey: key, mimeType: input.contentType, fileSize: buffer.length,
          uploadedBy: ctx.user.id,
        });
        await logAudit({ actorId: ctx.user.id, actorName: ctx.user.name ?? ctx.user.email ?? "Staff", action: "document_uploaded", clientId: input.submissionId ?? undefined, details: { name: input.name, category: input.category, mimeType: input.contentType } });
        return { success: true, id, url };
      }),
      delete: adminProcedure.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
        await deleteDocument(input.id);
        await logAudit({ actorId: ctx.user.id, actorName: ctx.user.name ?? ctx.user.email ?? "Admin", action: "document_deleted", details: { documentId: input.id } });
        return { success: true };
      }),
    }),

    // ─── Services ─────────────────────────────────────────────────────────
    services: router({
      byClient: staffProcedure.input(z.object({ submissionId: z.number() })).query(async ({ input }) => getServicesBySubmission(input.submissionId)),
      create: editProcedure.input(z.object({
        submissionId: z.number(), name: z.string().min(1), description: z.string().optional(),
        startDate: z.string().optional(),
      })).mutation(async ({ ctx, input }) => {
        const id = await createService({
          submissionId: input.submissionId, name: input.name, description: input.description ?? null,
          startDate: input.startDate ? new Date(input.startDate) : new Date(),
          createdBy: ctx.user.id,
        });
        const client = await getSubmissionById(input.submissionId);
        await logAudit({ actorId: ctx.user.id, actorName: ctx.user.name ?? ctx.user.email ?? "Staff", action: "service_created", clientId: input.submissionId, clientName: client ? `${client.firstName} ${client.lastName}` : undefined, details: { name: input.name } });
        return { success: true, id };
      }),
      updateStatus: editProcedure.input(z.object({
        id: z.number(), status: z.enum(["active", "completed", "cancelled"]),
      })).mutation(async ({ input, ctx }) => {
        await updateServiceStatus(input.id, input.status);
        await logAudit({ actorId: ctx.user.id, actorName: ctx.user.name ?? ctx.user.email ?? "Staff", action: "service_status_changed", details: { serviceId: input.id, status: input.status } });
        return { success: true };
      }),
    }),

    // ─── Client edit/delete ────────────────────────────────────────────────
    updateClient: editProcedure.input(z.object({
      id: z.number(),
      // Top-level DB columns
      firstName: z.string().optional(),
      lastName: z.string().optional(),
      email: z.string().optional(),
      cellPhone: z.string().optional(),
      medicaidId: z.string().optional(),
      language: z.string().optional(),
      program: z.string().optional(),
      borough: z.string().optional(),
      neighborhood: z.string().optional(),
      supermarket: z.string().optional(),
      referralSource: z.string().optional(),
      additionalMembersCount: z.number().optional(),
      // formData fields (merged into existing JSON)
      formData: z.record(z.string(), z.unknown()).optional(),
    })).mutation(async ({ input, ctx }) => {
      const { id, formData, ...fields } = input;
      const existing = await getSubmissionById(id);
      const updateData: Record<string, unknown> = {};
      // Build before/after diff for top-level fields
      const changedFields: Record<string, { from: unknown; to: unknown }> = {};
      Object.entries(fields).forEach(([k, v]) => {
        if (v !== undefined) {
          updateData[k] = v;
          if (existing && (existing as any)[k] !== v) changedFields[k] = { from: (existing as any)[k], to: v };
        }
      });
      if (formData) {
        if (existing) {
          const merged = { ...(existing.formData as Record<string, unknown>), ...formData };
          updateData.formData = merged;
          // Auto-sync additionalMembersCount from householdMembers array if provided
          if (Array.isArray(merged.householdMembers) && fields.additionalMembersCount === undefined) {
            updateData.additionalMembersCount = (merged.householdMembers as unknown[]).length;
          }
          // Track formData field changes
          const existingFd = (existing.formData as Record<string, unknown>) || {};
          Object.entries(formData).forEach(([k, v]) => {
            if (existingFd[k] !== v) changedFields[`formData.${k}`] = { from: existingFd[k], to: v };
          });
        }
      }
      await updateSubmissionFields(id, updateData as any);
      await logAudit({
        actorId: ctx.user.id, actorName: ctx.user.name ?? ctx.user.email ?? "Staff",
        action: "client_edited",
        clientId: id,
        clientName: existing ? `${existing.firstName} ${existing.lastName}` : undefined,
        details: { changedFields },
      });
      return { success: true };
    }),

    deleteClient: adminProcedure.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
      const existing = await getSubmissionById(input.id);
      await deleteSubmission(input.id);
      await logAudit({
        actorId: ctx.user.id, actorName: ctx.user.name ?? ctx.user.email ?? "Admin",
        action: "client_deleted",
        clientId: input.id,
        clientName: existing ? `${existing.firstName} ${existing.lastName}` : undefined,
      });
      return { success: true };
    }),

    bulkDeleteClients: adminProcedure.input(z.object({ ids: z.array(z.number()).min(1).max(100) })).mutation(async ({ input, ctx }) => {
      await bulkDeleteSubmissions(input.ids);
      await logAudit({ actorId: ctx.user.id, actorName: ctx.user.name ?? ctx.user.email ?? "Admin", action: "bulk_deleted", details: { count: input.ids.length, ids: input.ids } });
      return { success: true, deleted: input.ids.length };
    }),

    // ─── Update admin notes (assessment) ──────────────────────────────────
    updateAdminNotes: editProcedure.input(z.object({
      id: z.number(),
      adminNotes: z.string(),
    })).mutation(async ({ input, ctx }) => {
      const existing = await getSubmissionById(input.id);
      await updateSubmissionFields(input.id, { adminNotes: input.adminNotes });
      await logAudit({
        actorId: ctx.user.id, actorName: ctx.user.name ?? ctx.user.email ?? "Staff",
        action: "notes_edited",
        clientId: input.id,
        clientName: existing ? `${existing.firstName} ${existing.lastName}` : undefined,
      });
      return { success: true };
    }),

    // ─── Assessor: approve / reject client ────────────────────────────────────
    approveClient: assessorProcedure.input(z.object({
      id: z.number(),
    })).mutation(async ({ input, ctx }) => {
      const existing = await getSubmissionById(input.id);
      await updateSubmissionFields(input.id, {
        status: "approved",
        approvedBy: ctx.user.name || ctx.user.email || "Assessor",
        approvedAt: new Date(),
        rejectedBy: null,
        rejectedAt: null,
        rejectionReason: null,
      } as any);
      await logAudit({
        actorId: ctx.user.id, actorName: ctx.user.name ?? ctx.user.email ?? "Assessor",
        action: "client_approved",
        clientId: input.id,
        clientName: existing ? `${existing.firstName} ${existing.lastName}` : undefined,
      });
      return { success: true };
    }),

    rejectClient: assessorProcedure.input(z.object({
      id: z.number(),
      reason: z.string().optional(),
    })).mutation(async ({ input, ctx }) => {
      const existing = await getSubmissionById(input.id);
      await updateSubmissionFields(input.id, {
        status: "rejected",
        rejectedBy: ctx.user.name || ctx.user.email || "Assessor",
        rejectedAt: new Date(),
        rejectionReason: input.reason || null,
        approvedBy: null,
        approvedAt: null,
      } as any);
      await logAudit({
        actorId: ctx.user.id, actorName: ctx.user.name ?? ctx.user.email ?? "Assessor",
        action: "client_rejected",
        clientId: input.id,
        clientName: existing ? `${existing.firstName} ${existing.lastName}` : undefined,
        details: input.reason ? { reason: input.reason } : undefined,
      });
      return { success: true };
    }),

    markMissingInfo: assessorProcedure.input(z.object({
      id: z.number(),
      note: z.string().min(1),
    })).mutation(async ({ input, ctx }) => {
      const existing = await getSubmissionById(input.id);
      await updateSubmissionStage(input.id, "missing_information");
      await updateSubmissionFields(input.id, { missingInfoNote: input.note } as any);
      await logAudit({
        actorId: ctx.user.id, actorName: ctx.user.name ?? ctx.user.email ?? "Assessor",
        action: "stage_changed",
        clientId: input.id,
        clientName: existing ? `${existing.firstName} ${existing.lastName}` : undefined,
        details: { stage: "missing_information", note: input.note },
      });
      // Send email to client if they have an email address
      if (existing?.email) {
        const escHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
        const clientName = escHtml(`${existing.firstName ?? ""} ${existing.lastName ?? ""}`.trim());
        const escapedNote = escHtml(input.note);
        await sendEmail({
          to: existing.email,
          subject: "Action Required: Additional Information Needed — FreshSelect Meals",
          html: `
            <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
              <h2 style="color:#16a34a;margin-bottom:8px;">FreshSelect Meals</h2>
              <hr style="border:none;border-top:1px solid #e5e7eb;margin-bottom:20px;" />
              <p>Dear ${clientName},</p>
              <p>Thank you for your application to the FreshSelect Meals program. After reviewing your file, our assessor has identified some information that is missing or needs to be provided before we can continue processing your application.</p>
              <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:16px;margin:20px 0;">
                <p style="font-weight:bold;color:#c2410c;margin:0 0 8px;">Missing Information:</p>
                <p style="color:#7c2d12;margin:0;">${escapedNote}</p>
              </div>
              <p>Please contact us as soon as possible so we can complete your application:</p>
              <ul style="color:#374151;">
                <li>Phone: <strong>(718) 307-4664</strong></li>
                <li>Email: <strong>info@freshselectmeals.com</strong></li>
              </ul>
              <p style="color:#6b7280;font-size:13px;margin-top:24px;">This message was sent on behalf of FreshSelect Meals. If you have questions, please call us directly.</p>
            </div>
          `,
        }).catch(() => { /* non-blocking */ });
      }
      return { success: true };
    }),

    markNotEligible: assessorProcedure.input(z.object({
      id: z.number(),
      reason: z.string().min(1),
    })).mutation(async ({ input, ctx }) => {
      const existing = await getSubmissionById(input.id);
      await updateSubmissionStage(input.id, "not_eligible");
      await updateSubmissionFields(input.id, { notEligibleReason: input.reason } as any);
      await logAudit({
        actorId: ctx.user.id, actorName: ctx.user.name ?? ctx.user.email ?? "Assessor",
        action: "stage_changed",
        clientId: input.id,
        clientName: existing ? `${existing.firstName} ${existing.lastName}` : undefined,
        details: { stage: "not_eligible", reason: input.reason },
      });
      return { success: true };
    }),

    // ─── Assessment Completion & SCN Edits ─────────────────────────────────
    updateAssessmentCompleted: editProcedure.input(z.object({
      id: z.number(),
      completed: z.boolean(),
    })).mutation(async ({ input, ctx }) => {
      const existing = await getSubmissionById(input.id);
      await updateSubmissionFields(input.id, {
        assessmentCompletedAt: input.completed ? new Date() : null,
      } as any);
      await logAudit({
        actorId: ctx.user.id, actorName: ctx.user.name ?? ctx.user.email ?? "Staff",
        action: input.completed ? "assessment_completed" : "assessment_incomplete",
        clientId: input.id,
        clientName: existing ? `${existing.firstName} ${existing.lastName}` : undefined,
      });
      return { success: true };
    }),

    updateScreeningAnswers: editProcedure.input(z.object({
      id: z.number(),
      // Full flat formData patch — top-level fields (screenerName, screeningDate, receivesSnap, etc.)
      // plus an optional nested 'screening' object that gets deep-merged
      formData: z.record(z.string(), z.unknown()),
    })).mutation(async ({ input, ctx }) => {
      const existing = await getSubmissionById(input.id);
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      const existingFd = (existing.formData as Record<string, unknown>) || {};
      const { screening: newScreening, screeningQuestions: newScreeningQuestions, ...topLevelFields } = input.formData as any;
      // Support both canonical 'screeningQuestions' key (intake form) and legacy 'screening' key
      const incomingScreening = newScreeningQuestions || newScreening || {};
      const mergedScreening = {
        ...((existingFd as any)?.screeningQuestions || (existingFd as any)?.screening || {}),
        ...incomingScreening,
      };
      const merged = {
        ...existingFd,
        ...topLevelFields,
        screeningQuestions: mergedScreening,
        screening: mergedScreening, // keep legacy key in sync
      };
      await updateSubmissionFields(input.id, { formData: merged } as any);
      await logAudit({
        actorId: ctx.user.id, actorName: ctx.user.name ?? ctx.user.email ?? "Staff",
        action: "scn_edited",
        clientId: input.id,
        clientName: existing ? `${existing.firstName} ${existing.lastName}` : undefined,
      });
      return { success: true };
    }),

    // ─── Referral Links ──────────────────────────────────────────────────
    referrals: router({
      list: staffProcedure.query(async () => listReferralLinks()),
      stats: staffProcedure.query(async () => getReferralStats()),
      getByCode: publicProcedure.input(z.object({ code: z.string() })).query(async ({ input }) => {
        const link = await getReferralLinkByCode(input.code);
        return link || null;
      }),
      create: adminProcedure.input(z.object({
        code: z.string().min(2).max(64),
        referrerName: z.string().min(1),
        description: z.string().optional(),
        email: z.string().email().optional(),
        password: z.string().min(6).optional(),
      })).mutation(async ({ ctx, input }) => {
        const { password, ...rest } = input;
        const data: any = { ...rest, createdBy: ctx.user.id };
        if (input.email) data.email = input.email;
        if (password) data.passwordHash = await bcrypt.hash(password, 10);
        const id = await createReferralLink(data);
        await logAudit({ actorId: ctx.user.id, actorName: ctx.user.name ?? ctx.user.email ?? "Admin", action: "referral_link_created", details: { code: input.code, referrerName: input.referrerName } });
        return { success: true, id };
      }),
      update: adminProcedure.input(z.object({
        id: z.number(),
        referrerName: z.string().optional(),
        description: z.string().optional(),
        isActive: z.number().optional(),
        email: z.string().email().optional(),
        password: z.string().min(6).optional(),
      })).mutation(async ({ input, ctx }) => {
        const { id, password, ...data } = input;
        const updateData: any = { ...data };
        if (password) updateData.passwordHash = await bcrypt.hash(password, 10);
        await updateReferralLink(id, updateData);
        await logAudit({ actorId: ctx.user.id, actorName: ctx.user.name ?? ctx.user.email ?? "Admin", action: "referral_link_updated", details: { id, changes: Object.keys(data) } });
        return { success: true };
      }),
      delete: adminProcedure.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
        await deleteReferralLink(input.id);
        await logAudit({ actorId: ctx.user.id, actorName: ctx.user.name ?? ctx.user.email ?? "Admin", action: "referral_link_deleted", details: { id: input.id } });
        return { success: true };
      }),
      // ─── Referrer Messages ───────────────────────────────────────────
      sendMessage: staffProcedure.input(z.object({
        referralLinkId: z.number(),
        submissionId: z.number().optional(),
        message: z.string().min(1).max(2000),
      })).mutation(async ({ ctx, input }) => {
        const id = await createReferrerMessage({
          referralLinkId: input.referralLinkId,
          submissionId: input.submissionId ?? null,
          senderId: ctx.user.id,
          message: input.message,
        });
        return { success: true, id };
      }),
      listMessages: staffProcedure.input(z.object({
        referralLinkId: z.number(),
      })).query(async ({ input }) => {
        return listReferrerMessages(input.referralLinkId);
      }),
      markRead: staffProcedure.input(z.object({
        messageId: z.number(),
      })).mutation(async ({ input }) => {
        await markReferrerMessageRead(input.messageId);
        return { success: true };
      }),
      unreadCounts: staffProcedure.query(async () => {
        return getUnreadCountByReferrer();
      }),
    }),

    // ─── Referrer Portal (public login + read-only access) ─────────────
    referrerPortal: router({
      login: publicProcedure.input(z.object({
        email: z.string().email(),
        password: z.string(),
      })).mutation(async ({ ctx, input }) => {
        const ip = (ctx.req as any).ip ?? ctx.req.socket?.remoteAddress ?? "unknown";
        const link = await getReferralLinkByEmail(input.email);
        if (!link || !link.passwordHash) {
          await logAudit({ action: "login_failed", actorName: input.email, details: { reason: "unknown_referrer_email", ip, portal: "referrer" } });
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid email or password" });
        }
        if (!link.isActive) {
          await logAudit({ action: "login_failed", actorName: input.email, details: { reason: "account_deactivated", ip, portal: "referrer" } });
          throw new TRPCError({ code: "FORBIDDEN", message: "This account has been deactivated" });
        }
        const valid = await bcrypt.compare(input.password, link.passwordHash);
        if (!valid) {
          await logAudit({ action: "login_failed", actorName: input.email, details: { reason: "wrong_password", ip, portal: "referrer" } });
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid email or password" });
        }
        await logAudit({ action: "login_success", actorName: input.email, details: { referrerId: link.id, ip, portal: "referrer" } });
        return { success: true, referrerId: link.id, referrerName: link.referrerName, code: link.code };
      }),
      myClients: publicProcedure.input(z.object({
        code: z.string(),
      })).query(async ({ input }) => {
        const link = await getReferralLinkByCode(input.code);
        if (!link) throw new TRPCError({ code: "NOT_FOUND", message: "Referral link not found" });
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
          language: c.language,
        }));
      }),
      myStats: publicProcedure.input(z.object({
        code: z.string(),
      })).query(async ({ input }) => {
        const link = await getReferralLinkByCode(input.code);
        if (!link) throw new TRPCError({ code: "NOT_FOUND", message: "Referral link not found" });
        const clients = await getClientsByReferralCode(link.code);
        const stages: Record<string, number> = {};
        clients.forEach((c) => { stages[c.stage] = (stages[c.stage] || 0) + 1; });
        const totalMembers = clients.reduce((sum, c) => sum + (c.additionalMembersCount ?? 0) + 1, 0);
        return { totalClients: clients.length, stages, referrerName: link.referrerName, code: link.code, totalMembers };
      }),
      myMessages: publicProcedure.input(z.object({
        code: z.string(),
      })).query(async ({ input }) => {
        const link = await getReferralLinkByCode(input.code);
        if (!link) throw new TRPCError({ code: "NOT_FOUND", message: "Referral link not found" });
        return listReferrerMessages(link.id);
      }),
      reply: publicProcedure.input(z.object({
        code: z.string(),
        message: z.string().min(1).max(2000),
        submissionId: z.number().optional(),
        attachmentUrl: z.string().url().startsWith("https://").optional(),
      })).mutation(async ({ input }) => {
        const link = await getReferralLinkByCode(input.code);
        if (!link) throw new TRPCError({ code: "NOT_FOUND", message: "Referral link not found" });
        // Validate attachment URL — only allow https:// to prevent javascript:/data: injection
        const safeAttachmentUrl = input.attachmentUrl && input.attachmentUrl.startsWith("https://")
          ? input.attachmentUrl
          : null;
        const id = await createReferrerMessage({
          referralLinkId: link.id,
          submissionId: input.submissionId ?? null,
          senderId: null,
          message: input.message,
          direction: "referrer",
          attachmentUrl: safeAttachmentUrl,
        });
        // Fire in-app notification for staff
        createNotification({
          type: "referrer_reply",
          title: `New message from referrer: ${link.referrerName || link.email || link.code}`,
          body: input.message.slice(0, 160) + (input.message.length > 160 ? "\u2026" : ""),
          link: input.submissionId ? `/admin/clients/${input.submissionId}` : `/admin/referrals`,
          submissionId: input.submissionId ?? null,
        }).catch((e: unknown) => console.warn("[Notification] referrer_reply:", e));
        return { success: true, id };
      }),
      markAllRead: publicProcedure.input(z.object({
        code: z.string(),
      })).mutation(async ({ input }) => {
        const link = await getReferralLinkByCode(input.code);
        if (!link) throw new TRPCError({ code: "NOT_FOUND", message: "Referral link not found" });
        await markAllReferrerMessagesRead(link.id);
        return { success: true };
      }),
      deleteMessage: publicProcedure.input(z.object({
        code: z.string(),
        messageId: z.number(),
      })).mutation(async ({ input }) => {
        const link = await getReferralLinkByCode(input.code);
        if (!link) throw new TRPCError({ code: "NOT_FOUND", message: "Referral link not found" });
        // Pass referralLinkId so the DB helper verifies ownership before deleting
        await deleteReferrerMessage(input.messageId, link.id);
        return { success: true };
      }),
    }),

    // ─── Worker management ────────────────────────────────────────────────
    workers: router({
      list: adminProcedure.query(async () => listWorkers()),
      allUsers: adminProcedure.query(async () => listAllUsers()),
      promote: adminProcedure.input(z.object({
        userId: z.number(), permissions: z.object({ canView: z.boolean(), canEdit: z.boolean(), canExport: z.boolean(), canDelete: z.boolean().default(false), showReferralLinks: z.boolean().default(true) }),
      })).mutation(async ({ input, ctx }) => {
        await setUserRole(input.userId, "worker");
        await updateWorkerPermissions(input.userId, input.permissions);
        await logAudit({ actorId: ctx.user.id, actorName: ctx.user.name ?? ctx.user.email ?? "Admin", action: "worker_promoted", details: { userId: input.userId, permissions: input.permissions } });
        return { success: true };
      }),
      updatePermissions: adminProcedure.input(z.object({
        userId: z.number(), permissions: z.object({ canView: z.boolean(), canEdit: z.boolean(), canExport: z.boolean(), canDelete: z.boolean().default(false), showReferralLinks: z.boolean().default(true) }),
      })).mutation(async ({ input, ctx }) => {
        await updateWorkerPermissions(input.userId, input.permissions);
        await logAudit({ actorId: ctx.user.id, actorName: ctx.user.name ?? ctx.user.email ?? "Admin", action: "worker_permissions_updated", details: { userId: input.userId, permissions: input.permissions } });
        return { success: true };
      }),
      toggleActive: adminProcedure.input(z.object({ userId: z.number(), isActive: z.boolean() }))
        .mutation(async ({ input, ctx }) => {
          await toggleWorkerActive(input.userId, input.isActive);
          await logAudit({ actorId: ctx.user.id, actorName: ctx.user.name ?? ctx.user.email ?? "Admin", action: input.isActive ? "worker_activated" : "worker_deactivated", details: { userId: input.userId } });
          return { success: true };
        }),
      demote: adminProcedure.input(z.object({ userId: z.number() }))
        .mutation(async ({ input, ctx }) => {
          await setUserRole(input.userId, "user");
          await logAudit({ actorId: ctx.user.id, actorName: ctx.user.name ?? ctx.user.email ?? "Admin", action: "worker_demoted", details: { userId: input.userId } });
          return { success: true };
        }),
      // Create a new staff account directly (no OAuth needed)
      createStaff: superAdminProcedure.input(z.object({
        email: z.string().email(),
        name: z.string().min(1),
        password: z.string().min(8, "Password must be at least 8 characters"),
        role: z.enum(["admin", "worker", "viewer", "assessor"]),
        permissions: z.object({ canView: z.boolean(), canEdit: z.boolean(), canExport: z.boolean(), canDelete: z.boolean(), showReferralLinks: z.boolean().default(true) }).optional(),
      })).mutation(async ({ input }) => {
        const existing = await getUserByEmail(input.email);
        if (existing) throw new TRPCError({ code: "CONFLICT", message: "A user with this email already exists" });
        const passwordHash = await bcrypt.hash(input.password, 12);
        const id = await createStaffUser({ email: input.email, name: input.name, passwordHash, role: input.role, permissions: input.permissions });
        return { success: true, id };
      }),
      // Update an existing staff member's name, role, or permissions
      updateStaff: superAdminProcedure.input(z.object({
        userId: z.number(),
        name: z.string().min(1).optional(),
        role: z.enum(["admin", "worker", "viewer", "assessor"]).optional(),
        permissions: z.object({ canView: z.boolean(), canEdit: z.boolean(), canExport: z.boolean(), canDelete: z.boolean(), showReferralLinks: z.boolean().default(true) }).optional(),
        newPassword: z.string().min(8).optional(),
      })).mutation(async ({ input }) => {
        const { userId, name, role, permissions, newPassword } = input;
        const updates: Record<string, unknown> = {};
        if (name) updates.name = name;
        if (role) updates.role = role;
        if (permissions) updates.permissions = permissions;
        if (newPassword) updates.passwordHash = await bcrypt.hash(newPassword, 12);
        if (Object.keys(updates).length) {
          const { getDb } = await import("./db");
          const { users } = await import("../drizzle/schema");
          const { eq } = await import("drizzle-orm");
          const db = await getDb();
          if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
          await db.update(users).set(updates as any).where(eq(users.id, userId));
        }
        return { success: true };
      }),
      // List all staff (super_admin, admin, worker, viewer)
      listStaff: adminProcedure.query(async () => listStaffUsers()),
    }),
  }),

  // ─── Password Reset (public — no auth required) ───────────────────────────
  passwordReset: router({
    forgotPassword: publicProcedure.input(z.object({
      email: z.string().email(),
      origin: z.string().url(),
    })).mutation(async ({ input }) => {
      // Always return success to prevent email enumeration
      const user = await getUserByEmail(input.email);
      if (!user || !user.passwordHash) return { success: true };
      if (user.role !== "admin" && user.role !== "worker" && user.role !== "super_admin" && user.role !== "viewer" && user.role !== "assessor") return { success: true };
      // Validate origin against allowlist to prevent open redirect — attacker could craft a
      // reset link pointing to evil.com to steal the token
      const { ALLOWED_ORIGINS } = await import("./_core/security");
      const originAllowed = ALLOWED_ORIGINS.some((o: string | RegExp) =>
        typeof o === "string" ? o === input.origin : o.test(input.origin)
      );
      if (!originAllowed) return { success: true }; // silently ignore — don't reveal allowlist
      const token = require("crypto").randomBytes(32).toString("hex");
      // Store SHA-256 hash of the token so a DB leak doesn't expose usable tokens.
      // The raw token is sent in the email link; the hash is what lives in the DB.
      const tokenHash = require("crypto").createHash("sha256").update(token).digest("hex");
      const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
      await setPasswordResetToken(user.id, tokenHash, expires);
      const resetUrl = `${input.origin}/admin/reset-password?token=${token}`;
      const escHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
      const safeName = escHtml(user.name || "there");
      const { sendEmail } = await import("./email");
      await sendEmail({
        to: user.email!,
        subject: "Reset your FreshSelect Meals password",
        html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto">
  <h2 style="color:#2d6a4f">Password Reset Request</h2>
  <p>Hi ${safeName},</p>
  <p>We received a request to reset your password for the FreshSelect Meals admin portal.</p>
  <p style="margin:24px 0">
    <a href="${resetUrl}" style="background:#2d6a4f;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold">Reset Password</a>
  </p>
  <p style="color:#666;font-size:13px">This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>
  <p style="color:#666;font-size:13px">Or copy this link: ${resetUrl}</p>
</div>`,
      });
      return { success: true };
    }),
    resetPassword: publicProcedure.input(z.object({
      token: z.string().min(1),
      newPassword: z.string().min(8, "Password must be at least 8 characters"),
    })).mutation(async ({ input }) => {
      // Hash the incoming token before DB lookup — the DB stores the hash, not the raw token
      const tokenHash = require("crypto").createHash("sha256").update(input.token).digest("hex");
      const user = await getUserByResetToken(tokenHash);
      if (!user) throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid or expired reset link" });
      if (!user.passwordResetExpires || new Date() > user.passwordResetExpires)
        throw new TRPCError({ code: "BAD_REQUEST", message: "This reset link has expired. Please request a new one." });
      const passwordHash = await bcrypt.hash(input.newPassword, 12);
      await clearPasswordResetToken(user.id, passwordHash);
      await logAudit({ actorId: user.id, actorName: user.email ?? "Staff", action: "password_reset", details: { method: "reset_link" } });
      return { success: true };
    }),
    validateToken: publicProcedure.input(z.object({ token: z.string() })).query(async ({ input }) => {
      const tokenHash = require("crypto").createHash("sha256").update(input.token).digest("hex");
      const user = await getUserByResetToken(tokenHash);
      if (!user || !user.passwordResetExpires || new Date() > user.passwordResetExpires)
        return { valid: false };
      return { valid: true, email: user.email, name: user.name };
    }),
  }),

  notifications: router({
    list: protectedProcedure
      .input(z.object({ limit: z.number().int().min(1).max(200).optional().default(50) }))
      .query(async ({ ctx, input }) => {
        return listNotifications(ctx.user.id, input.limit);
      }),

    unreadCount: protectedProcedure
      .query(async ({ ctx }) => {
        return { count: await getUnreadNotificationCount(ctx.user.id) };
      }),

    markRead: protectedProcedure
      .input(z.object({ id: z.number().int() }))
      .mutation(async ({ ctx, input }) => {
        await markNotificationRead(input.id, ctx.user.id);
        return { success: true };
      }),

    markAllRead: protectedProcedure
      .mutation(async ({ ctx }) => {
        await markAllNotificationsRead(ctx.user.id);
        return { success: true };
      }),
  }),

  // ─── Audit Log ────────────────────────────────────────────────────────────
  auditLog: router({
    list: adminProcedure
      .input(z.object({
        action: z.string().optional(),
        clientId: z.number().optional(),
        actorId: z.number().optional(),
        page: z.number().int().min(1).optional().default(1),
        pageSize: z.number().int().min(1).max(100).optional().default(50),
      }))
      .query(async ({ input }) => {
        const { page, pageSize, ...filters } = input;
        const offset = (page - 1) * pageSize;
        return getAuditLogs({ ...filters, limit: pageSize, offset });
      }),
    // Log a page view from the frontend — called on every route change
    // Rate-limited: max 60 page views per user per minute (prevents audit log flooding)
    logPageView: protectedProcedure
      .input(z.object({ path: z.string(), title: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        // In-memory sliding window: 60 page views per user per 60 seconds
        const now = Date.now();
        const windowMs = 60_000;
        const maxPerWindow = 60;
        const userId = ctx.user.id;
        if (!pageViewRateMap.has(userId)) pageViewRateMap.set(userId, []);
        const timestamps = pageViewRateMap.get(userId)!.filter(t => now - t < windowMs);
        if (timestamps.length >= maxPerWindow) {
          // Silently drop — don't throw, just skip logging
          return { success: true };
        }
        timestamps.push(now);
        pageViewRateMap.set(userId, timestamps);
        const sessionId = (ctx.req as any).cookies?.[SESSION_ID_COOKIE] ?? null;
        await logAudit({
          actorId: ctx.user.id,
          actorName: ctx.user.name ?? ctx.user.email ?? "Staff",
          action: "page_view",
          details: { path: input.path, title: input.title ?? null },
          sessionId,
        });
        return { success: true };
      }),
    // Get all audit log entries for a specific session
    getSessionActivity: adminProcedure
      .input(z.object({ sessionId: z.string() }))
      .query(async ({ input }) => {
        return getAuditLogsBySession(input.sessionId);
      }),
  }),
});
export type AppRouter = typeof appRouter;

