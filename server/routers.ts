import { TRPCError } from "@trpc/server";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { ENV } from "./_core/env";
import {
  createSubmission, getAllSubmissions, getSubmissionById, getSubmissionStats,
  listAllUsers, listSubmissions, listWorkers, listStaffUsers, setUserRole,
  toggleWorkerActive, updateSubmissionEmailSent, updateSubmissionStatus,
  updateSubmissionStage, updateSubmissionAssignment, updateWorkerPermissions,
  getRecentSubmissions, getRecentlyUpdated, getAddedCount,
  createTask, getTasksBySubmission, listTasks, getTaskStats, updateTaskStatus,
  createCaseNote, getCaseNotesBySubmission,
  createDocument, getDocumentsBySubmission, getLibraryDocuments, deleteDocument,
  createService, getServicesBySubmission, updateServiceStatus,
  updateSubmissionFields, deleteSubmission,
  createReferralLink, listReferralLinks, getReferralLinkByCode,
  updateReferralLink, deleteReferralLink, incrementReferralUsage, getReferralStats,
  getReferralLinkByEmail, getClientsByReferralCode,
  type WorkerPermissions,
} from "./db";
import bcrypt from "bcryptjs";
import { sendAdminNotification, sendApplicantConfirmation } from "./email";
import { storagePut } from "./storage";
import { z } from "zod";

// Referral -> ClickUp List ID mapping
const REFERRAL_LIST_ID = "901414869527";
const DEFAULT_LIST_ID = "901414846482";
const REFERRAL_LIST_MAP: Record<string, string> = {
  foodoo: REFERRAL_LIST_ID, rosemary: REFERRAL_LIST_ID, chestnut: REFERRAL_LIST_ID,
  central: REFERRAL_LIST_ID, sha: REFERRAL_LIST_ID,
};

// Admin-only guard middleware
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  return next({ ctx });
});

// Worker or Admin guard
const staffProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin" && ctx.user.role !== "worker")
    throw new TRPCError({ code: "FORBIDDEN", message: "Staff access required" });
  return next({ ctx });
});

const householdMemberSchema = z.object({ name: z.string(), dateOfBirth: z.string(), medicaidId: z.string() });

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
  supermarket: z.string().min(1),
  firstName: z.string().min(1), lastName: z.string().min(1),
  dateOfBirth: z.string().min(1),
  medicaidId: z.string().regex(/^[A-Za-z]{2}\d{5}[A-Za-z]$/, "Medicaid ID must be 2 letters, 5 numbers, 1 letter"),
  cellPhone: z.string().min(1), homePhone: z.string().optional(),
  email: z.string().email(),
  streetAddress: z.string().min(1), aptUnit: z.string().optional(),
  city: z.string().min(1), state: z.string().min(1), zipcode: z.string().min(1),
  healthCategories: z.array(z.string()),
  dueDate: z.string().optional(), miscarriageDate: z.string().optional(),
  infantName: z.string().optional(), infantDateOfBirth: z.string().optional(), infantMedicaidId: z.string().optional(),
  employed: z.string().min(1), spouseEmployed: z.string().min(1),
  hasWic: z.string().min(1), hasSnap: z.string().min(1),
  foodAllergies: z.string().optional(), foodAllergiesDetails: z.string().optional(),
  dietaryRestrictions: z.string().optional(),
  newApplicant: z.string().min(1),
  householdMembers: z.array(householdMemberSchema),
  mealFocus: z.array(z.string()),
  breakfastItems: z.string().optional(), lunchItems: z.string().optional(),
  dinnerItems: z.string().optional(), snackItems: z.string().optional(),
  needsRefrigerator: z.string().min(1), needsMicrowave: z.string().min(1), needsCookingUtensils: z.string().min(1),
  hipaaConsent: z.boolean().refine((val) => val === true, { message: "HIPAA consent is required" }),
  ref: z.string().optional(),
  screeningQuestions: screeningQuestionsSchema.optional(),
  uploadedDocuments: z.record(z.string(), z.string()).optional(),
});

function buildClickUpDescription(input: z.infer<typeof submissionInputSchema>): string {
  const lines: string[] = [];
  lines.push("## Mother's Personal Information");
  lines.push(`**Name:** ${input.firstName} ${input.lastName}`);
  lines.push(`**Date of Birth:** ${input.dateOfBirth}`);
  lines.push(`**Medicaid ID:** ${input.medicaidId}`);
  lines.push("", "## Contact Information");
  lines.push(`**Cell Phone:** ${input.cellPhone}`);
  if (input.homePhone) lines.push(`**Home Phone:** ${input.homePhone}`);
  lines.push(`**Email:** ${input.email}`);
  lines.push("", "## Address");
  lines.push(`**Street:** ${input.streetAddress}`);
  if (input.aptUnit) lines.push(`**Apt/Unit:** ${input.aptUnit}`);
  lines.push(`**City:** ${input.city}`, `**State:** ${input.state}`, `**Zipcode:** ${input.zipcode}`);
  lines.push("", "## Supermarket", `**Selected:** ${input.supermarket}`, "");
  if (input.screeningQuestions) {
    const sq = input.screeningQuestions;
    lines.push("## SCN Screening Questions");
    if (sq.livingSituation) lines.push(`1. **Current Living Situation:** ${sq.livingSituation}`);
    if (sq.utilityShutoff) lines.push(`2. **Utility Shutoff Threat:** ${sq.utilityShutoff}`);
    if (sq.receivesSnap) lines.push(`3. **Receives SNAP:** ${sq.receivesSnap}`);
    if (sq.receivesWic) lines.push(`4. **Receives WIC:** ${sq.receivesWic}`);
    if (sq.receivesTanf) lines.push(`5. **Receives TANF:** ${sq.receivesTanf}`);
    if (sq.enrolledHealthHome) lines.push(`6. **Enrolled in Health Home:** ${sq.enrolledHealthHome}`);
    if (sq.householdMembersCount) lines.push(`7. **Household Members:** ${sq.householdMembersCount}`);
    if (sq.householdMembersWithMedicaid) lines.push(`8. **Members with Medicaid:** ${sq.householdMembersWithMedicaid}`);
    if (sq.needsWorkAssistance) lines.push(`9. **Needs Work Assistance:** ${sq.needsWorkAssistance}`);
    if (sq.wantsSchoolHelp) lines.push(`10. **Wants School/Training Help:** ${sq.wantsSchoolHelp}`);
    if (sq.transportationBarrier) lines.push(`11. **Transportation Barrier:** ${sq.transportationBarrier}`);
    if (sq.hasChronicIllness) lines.push(`12. **Has Chronic Illness:** ${sq.hasChronicIllness}`);
    if (sq.otherHealthIssues) lines.push(`13. **Other Health Issues:** ${sq.otherHealthIssues}`);
    if (sq.medicationsRequireRefrigeration) lines.push(`14. **Medications Require Refrigeration:** ${sq.medicationsRequireRefrigeration}`);
    if (sq.pregnantOrPostpartum) lines.push(`15. **Pregnant or Postpartum:** ${sq.pregnantOrPostpartum}`);
    if (sq.breastmilkRefrigeration) lines.push(`16. **Breastmilk Refrigeration:** ${sq.breastmilkRefrigeration}`);
    lines.push("");
  }
  if (input.healthCategories.length > 0) {
    lines.push("## Health Categories");
    input.healthCategories.forEach((c) => lines.push(`- ${c}`));
    if (input.healthCategories.includes("Pregnant") && input.dueDate) lines.push(`**Due Date:** ${input.dueDate}`);
    if (input.healthCategories.includes("Had a Miscarriage") && input.miscarriageDate) lines.push(`**Date of Miscarriage:** ${input.miscarriageDate}`);
    if (input.healthCategories.includes("Postpartum (Within the last 12 months)")) {
      if (input.infantName) lines.push(`**Infant Name:** ${input.infantName}`);
      if (input.infantDateOfBirth) lines.push(`**Infant Date of Birth:** ${input.infantDateOfBirth}`);
      if (input.infantMedicaidId) lines.push(`**Infant Medicaid ID (CIN):** ${input.infantMedicaidId}`);
    }
    lines.push("");
  }
  lines.push("## Benefits & Employment");
  lines.push(`**Employed:** ${input.employed}`, `**Spouse Employed:** ${input.spouseEmployed}`);
  lines.push(`**WIC:** ${input.hasWic}`, `**SNAP:** ${input.hasSnap}`, `**New Applicant:** ${input.newApplicant}`, "");
  if (input.foodAllergies || input.dietaryRestrictions) {
    lines.push("## Food Allergies / Dietary Restrictions");
    if (input.foodAllergies) { lines.push(`**Food Allergies:** ${input.foodAllergies}`); if (input.foodAllergiesDetails) lines.push(`**Details:** ${input.foodAllergiesDetails}`); }
    if (input.dietaryRestrictions) lines.push(`**Dietary Restrictions:** ${input.dietaryRestrictions}`);
    lines.push("");
  }
  if (input.householdMembers.length > 0) {
    lines.push("## Additional Household Members");
    input.householdMembers.forEach((m, i) => { lines.push(`### Member ${i + 1}`, `**Name:** ${m.name}`, `**DOB:** ${m.dateOfBirth}`, `**Medicaid ID:** ${m.medicaidId}`); });
    lines.push("");
  }
  lines.push("## Meal Preferences");
  if (input.mealFocus.length > 0) lines.push(`**Meal Focus:** ${input.mealFocus.join(", ")}`);
  if (input.breakfastItems) lines.push(`**Breakfast Items:** ${input.breakfastItems}`);
  if (input.lunchItems) lines.push(`**Lunch Items:** ${input.lunchItems}`);
  if (input.dinnerItems) lines.push(`**Dinner Items:** ${input.dinnerItems}`);
  if (input.snackItems) lines.push(`**Snack Items:** ${input.snackItems}`);
  lines.push("", "## Household Appliances / Cooking Needs");
  lines.push(`**Needs Refrigerator:** ${input.needsRefrigerator}`, `**Needs Microwave:** ${input.needsMicrowave}`, `**Needs Cooking Utensils:** ${input.needsCookingUtensils}`);
  if (input.uploadedDocuments && Object.keys(input.uploadedDocuments).length > 0) {
    lines.push("", "## Uploaded Documents");
    for (const [key, url] of Object.entries(input.uploadedDocuments)) {
      const label = key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase());
      lines.push(`**${label}:** ${url}`);
    }
  }
  if (input.ref) lines.push("", "## Referral", `**Source:** ${input.ref}`);
  lines.push("", "## Legal & Compliance", `**HIPAA Consent:** Granted`, `**Consent Timestamp:** ${new Date().toISOString()}`);
  lines.push(`**Consent Text:** I authorize FreshSelect Meals to securely process my health and household information to coordinate my SCN food benefits, and I agree to the Privacy Policy.`);
  return lines.join("\n");
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ─── File Upload ──────────────────────────────────────────────────────────
  upload: router({
    document: publicProcedure
      .input(z.object({ fileName: z.string(), fileData: z.string(), contentType: z.string(), category: z.string() }))
      .mutation(async ({ input }) => {
        const buffer = Buffer.from(input.fileData, "base64");
        const suffix = Math.random().toString(36).substring(2, 8);
        const ext = input.fileName.split(".").pop() || "file";
        const key = `documents/${input.category}-${suffix}.${ext}`;
        const { url } = await storagePut(key, buffer, input.contentType);
        return { url, key };
      }),
  }),

  // ─── Submission ───────────────────────────────────────────────────────────
  submission: router({
    submit: publicProcedure.input(submissionInputSchema).mutation(async ({ input }) => {
      const listId = (input.ref && REFERRAL_LIST_MAP[input.ref.toLowerCase()]) || DEFAULT_LIST_ID;
      const taskName = `${input.firstName} ${input.lastName} \u2014 ${input.supermarket}`;
      const description = buildClickUpDescription(input);
      const refNumber = Math.random().toString(36).substring(2, 8).toUpperCase();
      const consentAt = new Date();

      await createSubmission({
        referenceNumber: refNumber, firstName: input.firstName, lastName: input.lastName,
        email: input.email, cellPhone: input.cellPhone, medicaidId: input.medicaidId,
        supermarket: input.supermarket, referralSource: input.ref ?? null,
        status: "new", stage: "referral",
        formData: input as unknown as Record<string, unknown>,
        hipaaConsentAt: consentAt, clickupTaskId: null,
        borough: input.city === "Brooklyn" ? "Brooklyn" : input.city,
      });

      // Track referral link usage
      if (input.ref) {
        incrementReferralUsage(input.ref).catch((err) => console.warn("[Referral] Failed to track:", err));
      }

      Promise.all([
        sendApplicantConfirmation({ referenceNumber: refNumber, firstName: input.firstName, lastName: input.lastName, email: input.email, cellPhone: input.cellPhone, medicaidId: input.medicaidId, supermarket: input.supermarket, formData: input as unknown as Record<string, unknown> }),
        sendAdminNotification({ referenceNumber: refNumber, firstName: input.firstName, lastName: input.lastName, email: input.email, cellPhone: input.cellPhone, medicaidId: input.medicaidId, supermarket: input.supermarket, formData: input as unknown as Record<string, unknown> }),
      ]).catch(console.error);

      try {
        await fetch(`https://api.clickup.com/api/v2/list/${listId}/task`, {
          method: "POST",
          headers: { Authorization: ENV.clickupApiKey, "Content-Type": "application/json" },
          body: JSON.stringify({ name: taskName, markdown_description: description, tags: ["freshselect-meals"] }),
        });
      } catch (err) { console.warn("[ClickUp] Failed:", err); }

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

    // Client list
    list: staffProcedure.input(z.object({
      search: z.string().optional(),
      status: z.enum(["all", "new", "in_review", "approved", "rejected", "on_hold"]).optional(),
      stage: z.string().optional(),
      supermarket: z.string().optional(),
      language: z.string().optional(),
      borough: z.string().optional(),
      assignedTo: z.number().optional(),
      intakeRep: z.number().optional(),
      page: z.number().min(1).optional(),
      pageSize: z.number().min(1).max(100).optional(),
    })).query(async ({ input }) => listSubmissions(input)),

    getById: staffProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
      const submission = await getSubmissionById(input.id);
      if (!submission) throw new TRPCError({ code: "NOT_FOUND", message: "Client not found" });
      return submission;
    }),

    updateStatus: staffProcedure.input(z.object({
      id: z.number(),
      status: z.enum(["new", "in_review", "approved", "rejected", "on_hold"]),
      adminNotes: z.string().optional(),
    })).mutation(async ({ input }) => { await updateSubmissionStatus(input.id, input.status, input.adminNotes); return { success: true }; }),

    updateStage: staffProcedure.input(z.object({
      id: z.number(),
      stage: z.enum(["referral", "assessment", "level_one_only", "level_one_household", "level_2_active", "ineligible", "provider_attestation_required", "flagged"]),
    })).mutation(async ({ input }) => { await updateSubmissionStage(input.id, input.stage); return { success: true }; }),

    updateAssignment: adminProcedure.input(z.object({
      id: z.number(), assignedTo: z.number().nullable(), intakeRep: z.number().nullable().optional(),
    })).mutation(async ({ input }) => { await updateSubmissionAssignment(input.id, input.assignedTo, input.intakeRep); return { success: true }; }),

    // CSV Export
    exportCsv: staffProcedure.input(z.object({ status: z.string().optional(), supermarket: z.string().optional(), stage: z.string().optional() }))
      .mutation(async ({ input }) => {
        const rows = await getAllSubmissions(input);
        const headers = ["Reference #", "First Name", "Last Name", "Email", "Phone", "Medicaid ID", "Supermarket", "Stage", "Status", "Referral Source", "Submitted"];
        const csvRows = rows.map((r) => [r.referenceNumber, r.firstName, r.lastName, r.email, r.cellPhone, r.medicaidId, r.supermarket, r.stage, r.status, r.referralSource || "", r.createdAt.toISOString()]);
        const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
        const csv = [headers.map(escape).join(","), ...csvRows.map((row) => row.map(escape).join(","))].join("\n");
        return { csv, count: rows.length };
      }),

    // ─── Tasks ────────────────────────────────────────────────────────────
    tasks: router({
      list: staffProcedure.input(z.object({
        search: z.string().optional(),
        status: z.enum(["all", "open", "completed", "verified"]).optional(),
        area: z.enum(["all", "intake_rep", "assigned_worker"]).optional(),
        assignedTo: z.number().optional(),
        page: z.number().min(1).optional(), pageSize: z.number().min(1).max(100).optional(),
      })).query(async ({ input }) => listTasks(input)),

      stats: staffProcedure.query(async () => getTaskStats()),

      byClient: staffProcedure.input(z.object({ submissionId: z.number() })).query(async ({ input }) => getTasksBySubmission(input.submissionId)),

      create: staffProcedure.input(z.object({
        submissionId: z.number(), description: z.string().min(1),
        area: z.enum(["intake_rep", "assigned_worker"]),
        assignedTo: z.number().optional(),
      })).mutation(async ({ ctx, input }) => {
        const id = await createTask({ ...input, createdBy: ctx.user.id });
        return { success: true, id };
      }),

      updateStatus: staffProcedure.input(z.object({
        id: z.number(), status: z.enum(["open", "completed", "verified"]),
      })).mutation(async ({ input }) => { await updateTaskStatus(input.id, input.status); return { success: true }; }),
    }),

    // ─── Case Notes ───────────────────────────────────────────────────────
    notes: router({
      byClient: staffProcedure.input(z.object({ submissionId: z.number() })).query(async ({ input }) => getCaseNotesBySubmission(input.submissionId)),
      create: staffProcedure.input(z.object({ submissionId: z.number(), content: z.string().min(1) }))
        .mutation(async ({ ctx, input }) => { const id = await createCaseNote({ ...input, createdBy: ctx.user.id }); return { success: true, id }; }),
    }),

    // ─── Documents ────────────────────────────────────────────────────────
    documents: router({
      byClient: staffProcedure.input(z.object({ submissionId: z.number() })).query(async ({ input }) => getDocumentsBySubmission(input.submissionId)),
      library: staffProcedure.input(z.object({ category: z.string().optional() }).optional()).query(async ({ input }) => getLibraryDocuments(input?.category)),
      upload: staffProcedure.input(z.object({
        submissionId: z.number().nullable(), name: z.string(), category: z.enum(["provider_attestation", "consent", "supporting_documentation", "id_document", "medicaid_card", "birth_certificate", "marriage_license", "forms", "uncategorized"]),
        fileData: z.string(), contentType: z.string(),
      })).mutation(async ({ ctx, input }) => {
        const buffer = Buffer.from(input.fileData, "base64");
        const suffix = Math.random().toString(36).substring(2, 8);
        const ext = input.name.split(".").pop() || "file";
        const key = `admin-docs/${input.category}-${suffix}.${ext}`;
        const { url } = await storagePut(key, buffer, input.contentType);
        const id = await createDocument({
          submissionId: input.submissionId, name: input.name, category: input.category,
          url, fileKey: key, mimeType: input.contentType, fileSize: buffer.length,
          uploadedBy: ctx.user.id,
        });
        return { success: true, id, url };
      }),
      delete: adminProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => { await deleteDocument(input.id); return { success: true }; }),
    }),

    // ─── Services ─────────────────────────────────────────────────────────
    services: router({
      byClient: staffProcedure.input(z.object({ submissionId: z.number() })).query(async ({ input }) => getServicesBySubmission(input.submissionId)),
      create: staffProcedure.input(z.object({
        submissionId: z.number(), name: z.string().min(1), description: z.string().optional(),
        startDate: z.string().optional(),
      })).mutation(async ({ ctx, input }) => {
        const id = await createService({
          submissionId: input.submissionId, name: input.name, description: input.description ?? null,
          startDate: input.startDate ? new Date(input.startDate) : new Date(),
          createdBy: ctx.user.id,
        });
        return { success: true, id };
      }),
      updateStatus: staffProcedure.input(z.object({
        id: z.number(), status: z.enum(["active", "completed", "cancelled"]),
      })).mutation(async ({ input }) => { await updateServiceStatus(input.id, input.status); return { success: true }; }),
    }),

    // ─── Client edit/delete ────────────────────────────────────────────────
    updateClient: staffProcedure.input(z.object({
      id: z.number(),
      firstName: z.string().optional(),
      lastName: z.string().optional(),
      email: z.string().optional(),
      cellPhone: z.string().optional(),
      medicaidId: z.string().optional(),
      language: z.string().optional(),
      program: z.string().optional(),
      borough: z.string().optional(),
      formData: z.record(z.string(), z.unknown()).optional(),
    })).mutation(async ({ input }) => {
      const { id, formData, ...fields } = input;
      const updateData: Record<string, unknown> = {};
      Object.entries(fields).forEach(([k, v]) => { if (v !== undefined) updateData[k] = v; });
      if (formData) {
        const existing = await getSubmissionById(id);
        if (existing) {
          const merged = { ...(existing.formData as Record<string, unknown>), ...formData };
          updateData.formData = merged;
        }
      }
      await updateSubmissionFields(id, updateData as any);
      return { success: true };
    }),

    deleteClient: adminProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
      await deleteSubmission(input.id);
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
        return { success: true, id };
      }),
      update: adminProcedure.input(z.object({
        id: z.number(),
        referrerName: z.string().optional(),
        description: z.string().optional(),
        isActive: z.number().optional(),
        email: z.string().email().optional(),
        password: z.string().min(6).optional(),
      })).mutation(async ({ input }) => {
        const { id, password, ...data } = input;
        const updateData: any = { ...data };
        if (password) updateData.passwordHash = await bcrypt.hash(password, 10);
        await updateReferralLink(id, updateData);
        return { success: true };
      }),
      delete: adminProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
        await deleteReferralLink(input.id);
        return { success: true };
      }),
    }),

    // ─── Referrer Portal (public login + read-only access) ─────────────
    referrerPortal: router({
      login: publicProcedure.input(z.object({
        email: z.string().email(),
        password: z.string(),
      })).mutation(async ({ input }) => {
        const link = await getReferralLinkByEmail(input.email);
        if (!link || !link.passwordHash) throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid email or password" });
        if (!link.isActive) throw new TRPCError({ code: "FORBIDDEN", message: "This account has been deactivated" });
        const valid = await bcrypt.compare(input.password, link.passwordHash);
        if (!valid) throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid email or password" });
        return { success: true, referrerId: link.id, referrerName: link.referrerName, code: link.code };
      }),
      myClients: publicProcedure.input(z.object({
        code: z.string(),
      })).query(async ({ input }) => {
        const link = await getReferralLinkByCode(input.code);
        if (!link) throw new TRPCError({ code: "NOT_FOUND", message: "Referral link not found" });
        const clients = await getClientsByReferralCode(link.referrerName);
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
        const clients = await getClientsByReferralCode(link.referrerName);
        const stages: Record<string, number> = {};
        clients.forEach((c) => { stages[c.stage] = (stages[c.stage] || 0) + 1; });
        return { totalClients: clients.length, stages, referrerName: link.referrerName, code: link.code };
      }),
    }),

    // ─── Worker management ────────────────────────────────────────────────
    workers: router({
      list: adminProcedure.query(async () => listWorkers()),
      allUsers: adminProcedure.query(async () => listAllUsers()),
      promote: adminProcedure.input(z.object({
        userId: z.number(), permissions: z.object({ canView: z.boolean(), canEdit: z.boolean(), canExport: z.boolean() }),
      })).mutation(async ({ input }) => { await setUserRole(input.userId, "worker"); await updateWorkerPermissions(input.userId, input.permissions); return { success: true }; }),
      updatePermissions: adminProcedure.input(z.object({
        userId: z.number(), permissions: z.object({ canView: z.boolean(), canEdit: z.boolean(), canExport: z.boolean() }),
      })).mutation(async ({ input }) => { await updateWorkerPermissions(input.userId, input.permissions); return { success: true }; }),
      toggleActive: adminProcedure.input(z.object({ userId: z.number(), isActive: z.boolean() }))
        .mutation(async ({ input }) => { await toggleWorkerActive(input.userId, input.isActive); return { success: true }; }),
      demote: adminProcedure.input(z.object({ userId: z.number() }))
        .mutation(async ({ input }) => { await setUserRole(input.userId, "user"); return { success: true }; }),
    }),
  }),
});

export type AppRouter = typeof appRouter;
