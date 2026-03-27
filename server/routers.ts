import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { ENV } from "./_core/env";

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

  submission: router({
    submit: publicProcedure
      .input(
        z.object({
          supermarket: z.string().min(1),
          firstName: z.string().min(1),
          lastName: z.string().min(1),
          dateOfBirth: z.string().min(1),
          medicaidId: z
            .string()
            .regex(
              /^[A-Za-z]{2}\d{5}[A-Za-z]$/,
              "Medicaid ID must be 2 letters, 5 numbers, 1 letter"
            ),
          cellPhone: z.string().min(1),
          homePhone: z.string().optional(),
          email: z.string().email(),
          streetAddress: z.string().min(1),
          aptUnit: z.string().optional(),
          city: z.string().min(1),
          state: z.string().min(1),
          zipcode: z.string().min(1),
          healthCategories: z.array(z.string()),
          // Conditional health fields
          dueDate: z.string().optional(),
          miscarriageDate: z.string().optional(),
          infantName: z.string().optional(),
          infantDateOfBirth: z.string().optional(),
          infantMedicaidId: z.string().optional(),
          // Benefits
          employed: z.string().min(1),
          spouseEmployed: z.string().min(1),
          hasWic: z.string().min(1),
          hasSnap: z.string().min(1),
          foodAllergies: z.string().optional(),
          newApplicant: z.string().min(1),
          householdMembers: z.array(
            z.object({
              name: z.string(),
              dateOfBirth: z.string(),
              medicaidId: z.string(),
            })
          ),
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
        })
      )
      .mutation(async ({ input }) => {
        const listId =
          (input.ref && REFERRAL_LIST_MAP[input.ref.toLowerCase()]) ||
          DEFAULT_LIST_ID;

        const taskName = `${input.firstName} ${input.lastName} \u2014 ${input.supermarket}`;

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

        if (input.healthCategories.length > 0) {
          lines.push("## Health Categories");
          input.healthCategories.forEach((c) => lines.push(`- ${c}`));
          // Conditional fields for health categories
          if (
            input.healthCategories.includes("Pregnant") &&
            input.dueDate
          ) {
            lines.push(`**Due Date:** ${input.dueDate}`);
          }
          if (
            input.healthCategories.includes("Had a Miscarriage") &&
            input.miscarriageDate
          ) {
            lines.push(`**Date of Miscarriage:** ${input.miscarriageDate}`);
          }
          if (
            input.healthCategories.includes(
              "Postpartum (Within the last 12 months)"
            )
          ) {
            if (input.infantName)
              lines.push(`**Infant Name:** ${input.infantName}`);
            if (input.infantDateOfBirth)
              lines.push(`**Infant Date of Birth:** ${input.infantDateOfBirth}`);
            if (input.infantMedicaidId)
              lines.push(
                `**Infant Medicaid ID (CIN):** ${input.infantMedicaidId}`
              );
          }
          lines.push("");
        }

        lines.push("## Benefits & Employment");
        lines.push(`**Employed:** ${input.employed}`);
        lines.push(`**Spouse Employed:** ${input.spouseEmployed}`);
        lines.push(`**WIC:** ${input.hasWic}`);
        lines.push(`**SNAP:** ${input.hasSnap}`);
        if (input.foodAllergies)
          lines.push(
            `**Food Allergies / Dietary Restrictions:** ${input.foodAllergies}`
          );
        lines.push(`**New Applicant:** ${input.newApplicant}`);
        lines.push("");

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
        if (input.mealFocus.length > 0)
          lines.push(`**Meal Focus:** ${input.mealFocus.join(", ")}`);
        if (input.breakfastItems)
          lines.push(`**Breakfast Items:** ${input.breakfastItems}`);
        if (input.lunchItems)
          lines.push(`**Lunch Items:** ${input.lunchItems}`);
        if (input.dinnerItems)
          lines.push(`**Dinner Items:** ${input.dinnerItems}`);
        if (input.snackItems)
          lines.push(`**Snack Items:** ${input.snackItems}`);
        lines.push("");

        lines.push("## Household Appliances / Cooking Needs");
        lines.push(`**Needs Refrigerator:** ${input.needsRefrigerator}`);
        lines.push(`**Needs Microwave:** ${input.needsMicrowave}`);
        lines.push(`**Needs Cooking Utensils:** ${input.needsCookingUtensils}`);

        if (input.ref) {
          lines.push("");
          lines.push(`## Referral`);
          lines.push(`**Source:** ${input.ref}`);
        }

        lines.push("");
        lines.push("## Legal & Compliance");
        lines.push(`**HIPAA Consent:** Granted`);
        lines.push(`**Consent Timestamp:** ${new Date().toISOString()}`);
        lines.push(
          `**Consent Text:** "I authorize FreshSelect Meals to securely process my health and household information to coordinate my SCN food benefits, and I agree to the Privacy Policy."`
        );

        const description = lines.join("\n");

        const refNumber = Math.random()
          .toString(36)
          .substring(2, 8)
          .toUpperCase();

        try {
          const response = await fetch(
            `https://api.clickup.com/api/v2/list/${listId}/task`,
            {
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
            }
          );

          if (!response.ok) {
            const errorText = await response.text();
            console.error("[ClickUp API] Error:", response.status, errorText);
            throw new Error(`ClickUp API returned ${response.status}`);
          }

          return {
            success: true,
            referenceNumber: refNumber,
          };
        } catch (error) {
          console.error("[ClickUp API] Failed to create task:", error);
          throw new Error(
            "We could not submit your application at this time. Please try again later."
          );
        }
      }),
  }),
});

export type AppRouter = typeof appRouter;
