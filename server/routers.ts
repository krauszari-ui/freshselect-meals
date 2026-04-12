import { TRPCError } from "@trpc/server";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { ENV } from "./_core/env";
import {
  createSubmission,
  getAllSubmissions,
  getSubmissionById,
  getSubmissionStats,
  listAllUsers,
  listSubmissions,
  listWorkers,
  setUserRole,
  toggleWorkerActive,
  updateSubmissionEmailSent,
  updateSubmissionStatus,
  updateWorkerPermissions,
  type WorkerPermissions,
} from "./db";
import { sendAdminNotification, sendApplicantConfirmation } from "./email";
import { storagePut } from "./storage";
import { z } from "zod";

// Referral -> ClickUp List ID mapping
const REFERRAL_LIST_ID = "901414869527";
const DEFAULT_LIST_ID = "901414846482";

const REFERRAL_LIST_MAP: Record<string, string> = {
  foodoo: REFERRAL_LIST_ID,
  rosemary: REFERRAL_LIST_ID,
  chestnut: REFERRAL_LIST_ID,
  central: REFERRAL_LIST_ID,
  sha: REFERRAL_LIST_ID,
};

// Admin-only guard middleware
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  }
  return next({ ctx });
});

// Worker or Admin guard
const staffProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin" && ctx.user.role !== "worker") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Staff access required" });
  }
  return next({ ctx });
});

const householdMemberSchema = z.object({
  name: z.string(),
  dateOfBirth: z.string(),
  medicaidId: z.string(),
});

const screeningQuestionsSchema = z.object({
  livingSituation: z.string().optional(),
  utilityShutoff: z.string().optional(),
  receivesSnap: z.string().optional(),
  receivesWic: z.string().optional(),
  receivesTanf: z.string().optional(),
  enrolledHealthHome: z.string().optional(),
  householdMembersCount: z.string().optional(),
  householdMembersWithMedicaid: z.string().optional(),
  needsWorkAssistance: z.string().optional(),
  wantsSchoolHelp: z.string().optional(),
  transportationBarrier: z.string().optional(),
  hasChronicIllness: z.string().optional(),
  otherHealthIssues: z.string().optional(),
  medicationsRequireRefrigeration: z.string().optional(),
  pregnantOrPostpartum: z.string().optional(),
  breastmilkRefrigeration: z.string().optional(),
});

const submissionInputSchema = z.object({
  supermarket: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  dateOfBirth: z.string().min(1),
  medicaidId: z
    .string()
    .regex(/^[A-Za-z]{2}\d{5}[A-Za-z]$/, "Medicaid ID must be 2 letters, 5 numbers, 1 letter"),
  cellPhone: z.string().min(1),
  homePhone: z.string().optional(),
  email: z.string().email(),
  streetAddress: z.string().min(1),
  aptUnit: z.string().optional(),
  city: z.string().min(1),
  state: z.string().min(1),
  zipcode: z.string().min(1),
  healthCategories: z.array(z.string()),
  dueDate: z.string().optional(),
  miscarriageDate: z.string().optional(),
  infantName: z.string().optional(),
  infantDateOfBirth: z.string().optional(),
  infantMedicaidId: z.string().optional(),
  employed: z.string().min(1),
  spouseEmployed: z.string().min(1),
  hasWic: z.string().min(1),
  hasSnap: z.string().min(1),
  foodAllergies: z.string().optional(),
  foodAllergiesDetails: z.string().optional(),
  dietaryRestrictions: z.string().optional(),
  newApplicant: z.string().min(1),
  householdMembers: z.array(householdMemberSchema),
  mealFocus: z.array(z.string()),
  breakfastItems: z.string().optional(),
  lunchItems: z.string().optional(),
  dinnerItems: z.string().optional(),
  snackItems: z.string().optional(),
  needsRefrigerator: z.string().min(1),
  needsMicrowave: z.string().min(1),
  needsCookingUtensils: z.string().min(1),
  hipaaConsent: z.boolean().refine((val) => val === true, {
    message: "HIPAA consent is required",
  }),
  ref: z.string().optional(),
  // SCN Screening Questions
  screeningQuestions: screeningQuestionsSchema.optional(),
  // Document upload URLs (stored after upload)
  uploadedDocuments: z.record(z.string(), z.string()).optional(),
});

function buildClickUpDescription(input: z.infer<typeof submissionInputSchema>): string {
  const lines: string[] = [];
  lines.push("## Mother's Personal Information");
  lines.push(`**Name:** ${input.firstName} ${input.lastName}`);
  lines.push(`**Date of Birth:** ${input.dateOfBirth}`);
  lines.push(`**Medicaid ID:** ${input.medicaidId}`);
  lines.push("");
  lines.push("## Contact Information");
  lines.push(`**Cell Phone:** ${input.cellPhone}`);
  if (input.homePhone) lines.push(`**Home Phone:** ${input.homePhone}`);
  lines.push(`**Email:** ${input.email}`);
  lines.push("");
  lines.push("## Address");
  lines.push(`**Street:** ${input.streetAddress}`);
  if (input.aptUnit) lines.push(`**Apt/Unit:** ${input.aptUnit}`);
  lines.push(`**City:** ${input.city}`);
  lines.push(`**State:** ${input.state}`);
  lines.push(`**Zipcode:** ${input.zipcode}`);
  lines.push("");
  lines.push("## Supermarket");
  lines.push(`**Selected:** ${input.supermarket}`);
  lines.push("");

  // SCN Screening Questions
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
    if (input.healthCategories.includes("Pregnant") && input.dueDate)
      lines.push(`**Due Date:** ${input.dueDate}`);
    if (input.healthCategories.includes("Had a Miscarriage") && input.miscarriageDate)
      lines.push(`**Date of Miscarriage:** ${input.miscarriageDate}`);
    if (input.healthCategories.includes("Postpartum (Within the last 12 months)")) {
      if (input.infantName) lines.push(`**Infant Name:** ${input.infantName}`);
      if (input.infantDateOfBirth) lines.push(`**Infant Date of Birth:** ${input.infantDateOfBirth}`);
      if (input.infantMedicaidId) lines.push(`**Infant Medicaid ID (CIN):** ${input.infantMedicaidId}`);
    }
    lines.push("");
  }

  lines.push("## Benefits & Employment");
  lines.push(`**Employed:** ${input.employed}`);
  lines.push(`**Spouse Employed:** ${input.spouseEmployed}`);
  lines.push(`**WIC:** ${input.hasWic}`);
  lines.push(`**SNAP:** ${input.hasSnap}`);
  lines.push(`**New Applicant:** ${input.newApplicant}`);
  lines.push("");

  // Food Allergies / Dietary Restrictions
  if (input.foodAllergies || input.dietaryRestrictions) {
    lines.push("## Food Allergies / Dietary Restrictions");
    if (input.foodAllergies) {
      lines.push(`**Food Allergies:** ${input.foodAllergies}`);
      if (input.foodAllergiesDetails) lines.push(`**Details:** ${input.foodAllergiesDetails}`);
    }
    if (input.dietaryRestrictions) lines.push(`**Dietary Restrictions:** ${input.dietaryRestrictions}`);
    lines.push("");
  }

  if (input.householdMembers.length > 0) {
    lines.push("## Additional Household Members");
    input.householdMembers.forEach((m, i) => {
      lines.push(`### Member ${i + 1}`);
      lines.push(`**Name:** ${m.name}`);
      lines.push(`**DOB:** ${m.dateOfBirth}`);
      lines.push(`**Medicaid ID:** ${m.medicaidId}`);
    });
    lines.push("");
  }

  lines.push("## Meal Preferences");
  if (input.mealFocus.length > 0) lines.push(`**Meal Focus:** ${input.mealFocus.join(", ")}`);
  if (input.breakfastItems) lines.push(`**Breakfast Items:** ${input.breakfastItems}`);
  if (input.lunchItems) lines.push(`**Lunch Items:** ${input.lunchItems}`);
  if (input.dinnerItems) lines.push(`**Dinner Items:** ${input.dinnerItems}`);
  if (input.snackItems) lines.push(`**Snack Items:** ${input.snackItems}`);
  lines.push("");

  lines.push("## Household Appliances / Cooking Needs");
  lines.push(`**Needs Refrigerator:** ${input.needsRefrigerator}`);
  lines.push(`**Needs Microwave:** ${input.needsMicrowave}`);
  lines.push(`**Needs Cooking Utensils:** ${input.needsCookingUtensils}`);

  // Uploaded documents
  if (input.uploadedDocuments && Object.keys(input.uploadedDocuments).length > 0) {
    lines.push("");
    lines.push("## Uploaded Documents");
    for (const [key, url] of Object.entries(input.uploadedDocuments)) {
      const label = key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase());
      lines.push(`**${label}:** ${url}`);
    }
  }

  if (input.ref) {
    lines.push("");
    lines.push("## Referral");
    lines.push(`**Source:** ${input.ref}`);
  }

  lines.push("");
  lines.push("## Legal & Compliance");
  lines.push(`**HIPAA Consent:** Granted`);
  lines.push(`**Consent Timestamp:** ${new Date().toISOString()}`);
  lines.push(
    `**Consent Text:** "I authorize FreshSelect Meals to securely process my health and household information to coordinate my SCN food benefits, and I agree to the Privacy Policy."`
  );

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
      .input(
        z.object({
          fileName: z.string(),
          fileData: z.string(), // base64 encoded
          contentType: z.string(),
          category: z.string(), // e.g. "motherMedicaidCard", "childBirthCertificate_0"
        })
      )
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
    submit: publicProcedure
      .input(submissionInputSchema)
      .mutation(async ({ input }) => {
        const listId =
          (input.ref && REFERRAL_LIST_MAP[input.ref.toLowerCase()]) || DEFAULT_LIST_ID;

        const taskName = `${input.firstName} ${input.lastName} \u2014 ${input.supermarket}`;
        const description = buildClickUpDescription(input);
        const refNumber = Math.random().toString(36).substring(2, 8).toUpperCase();
        const consentAt = new Date();

        // 1. Save to database first (always)
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
          formData: input as unknown as Record<string, unknown>,
          hipaaConsentAt: consentAt,
          clickupTaskId: null,
        });

        // 2. Send emails (non-blocking)
        const emailData = {
          referenceNumber: refNumber,
          firstName: input.firstName,
          lastName: input.lastName,
          email: input.email,
          cellPhone: input.cellPhone,
          medicaidId: input.medicaidId,
          supermarket: input.supermarket,
          formData: input as unknown as Record<string, unknown>,
        };

        // Fire and forget - don't block submission on email
        Promise.all([
          sendApplicantConfirmation(emailData),
          sendAdminNotification(emailData),
        ]).then(([applicantSent, adminSent]) => {
          if (applicantSent || adminSent) {
            // Update email sent timestamp
            listSubmissions({ search: refNumber, pageSize: 1 }).then((res) => {
              if (res.rows[0]) {
                updateSubmissionEmailSent(res.rows[0].id).catch(console.error);
              }
            });
          }
          if (!applicantSent) console.warn("[Email] Failed to send applicant confirmation for", refNumber);
          if (!adminSent) console.warn("[Email] Failed to send admin notification for", refNumber);
        }).catch(console.error);

        // 3. Try to send to ClickUp (non-blocking)
        try {
          const response = await fetch(`https://api.clickup.com/api/v2/list/${listId}/task`, {
            method: "POST",
            headers: {
              Authorization: ENV.clickupApiKey,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              name: taskName,
              markdown_description: description,
              tags: ["freshselect-meals"],
            }),
          });

          if (!response.ok) {
            console.warn("[ClickUp] Non-OK response:", response.status);
          }
        } catch (err) {
          console.warn("[ClickUp] Failed to create task (submission still saved):", err);
        }

        return { success: true, referenceNumber: refNumber };
      }),
  }),

  // ─── Admin procedures ─────────────────────────────────────────────────────
  admin: router({
    stats: adminProcedure.query(async () => {
      return getSubmissionStats();
    }),

    list: adminProcedure
      .input(
        z.object({
          search: z.string().optional(),
          status: z
            .enum(["all", "new", "in_review", "approved", "rejected", "on_hold"])
            .optional(),
          supermarket: z.string().optional(),
          page: z.number().min(1).optional(),
          pageSize: z.number().min(1).max(100).optional(),
        })
      )
      .query(async ({ input }) => {
        return listSubmissions({
          search: input.search,
          status: input.status as "all" | "new" | "in_review" | "approved" | "rejected" | "on_hold",
          supermarket: input.supermarket,
          page: input.page,
          pageSize: input.pageSize,
        });
      }),

    getById: adminProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const submission = await getSubmissionById(input.id);
        if (!submission) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Submission not found" });
        }
        return submission;
      }),

    updateStatus: adminProcedure
      .input(
        z.object({
          id: z.number(),
          status: z.enum(["new", "in_review", "approved", "rejected", "on_hold"]),
          adminNotes: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        await updateSubmissionStatus(input.id, input.status, input.adminNotes);
        return { success: true };
      }),

    // CSV Export
    exportCsv: adminProcedure
      .input(
        z.object({
          status: z.string().optional(),
          supermarket: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const rows = await getAllSubmissions({
          status: input.status,
          supermarket: input.supermarket,
        });

        const headers = [
          "Reference #",
          "First Name",
          "Last Name",
          "Email",
          "Phone",
          "Medicaid ID",
          "Supermarket",
          "Status",
          "Referral Source",
          "Submitted",
        ];

        const csvRows = rows.map((r) => [
          r.referenceNumber,
          r.firstName,
          r.lastName,
          r.email,
          r.cellPhone,
          r.medicaidId,
          r.supermarket,
          r.status,
          r.referralSource || "",
          r.createdAt.toISOString(),
        ]);

        const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
        const csv = [
          headers.map(escape).join(","),
          ...csvRows.map((row) => row.map(escape).join(",")),
        ].join("\n");

        return { csv, count: rows.length };
      }),

    // ─── Worker management ────────────────────────────────────────────────
    workers: router({
      list: adminProcedure.query(async () => {
        return listWorkers();
      }),

      allUsers: adminProcedure.query(async () => {
        return listAllUsers();
      }),

      promote: adminProcedure
        .input(
          z.object({
            userId: z.number(),
            permissions: z.object({
              canView: z.boolean(),
              canEdit: z.boolean(),
              canExport: z.boolean(),
            }),
          })
        )
        .mutation(async ({ input }) => {
          await setUserRole(input.userId, "worker");
          await updateWorkerPermissions(input.userId, input.permissions);
          return { success: true };
        }),

      updatePermissions: adminProcedure
        .input(
          z.object({
            userId: z.number(),
            permissions: z.object({
              canView: z.boolean(),
              canEdit: z.boolean(),
              canExport: z.boolean(),
            }),
          })
        )
        .mutation(async ({ input }) => {
          await updateWorkerPermissions(input.userId, input.permissions);
          return { success: true };
        }),

      toggleActive: adminProcedure
        .input(z.object({ userId: z.number(), isActive: z.boolean() }))
        .mutation(async ({ input }) => {
          await toggleWorkerActive(input.userId, input.isActive);
          return { success: true };
        }),

      demote: adminProcedure
        .input(z.object({ userId: z.number() }))
        .mutation(async ({ input }) => {
          await setUserRole(input.userId, "user");
          return { success: true };
        }),
    }),
  }),

  // ─── Staff procedures (workers + admins) ──────────────────────────────────
  staff: router({
    list: staffProcedure
      .input(
        z.object({
          search: z.string().optional(),
          status: z
            .enum(["all", "new", "in_review", "approved", "rejected", "on_hold"])
            .optional(),
          supermarket: z.string().optional(),
          page: z.number().min(1).optional(),
          pageSize: z.number().min(1).max(100).optional(),
        })
      )
      .query(async ({ ctx, input }) => {
        // Check worker permissions
        if (ctx.user.role === "worker") {
          const perms = (ctx.user as unknown as { permissions: WorkerPermissions | null }).permissions;
          if (!perms?.canView) {
            throw new TRPCError({ code: "FORBIDDEN", message: "You do not have view permission" });
          }
        }
        return listSubmissions({
          search: input.search,
          status: input.status as "all" | "new" | "in_review" | "approved" | "rejected" | "on_hold",
          supermarket: input.supermarket,
          page: input.page,
          pageSize: input.pageSize,
        });
      }),

    getById: staffProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        if (ctx.user.role === "worker") {
          const perms = (ctx.user as unknown as { permissions: WorkerPermissions | null }).permissions;
          if (!perms?.canView) {
            throw new TRPCError({ code: "FORBIDDEN", message: "You do not have view permission" });
          }
        }
        const submission = await getSubmissionById(input.id);
        if (!submission) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Submission not found" });
        }
        return submission;
      }),

    stats: staffProcedure.query(async ({ ctx }) => {
      if (ctx.user.role === "worker") {
        const perms = (ctx.user as unknown as { permissions: WorkerPermissions | null }).permissions;
        if (!perms?.canView) {
          throw new TRPCError({ code: "FORBIDDEN", message: "You do not have view permission" });
        }
      }
      return getSubmissionStats();
    }),
  }),
});

export type AppRouter = typeof appRouter;
