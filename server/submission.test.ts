import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Valid form data for testing
function validInput() {
  return {
    supermarket: "Foodoo",
    firstName: "Jane",
    lastName: "Doe",
    dateOfBirth: "01/15/1990",
    medicaidId: "AB12345C",
    cellPhone: "(555) 123-4567",
    email: "jane@example.com",
    streetAddress: "123 Main St",
    city: "Brooklyn",
    state: "NY",
    zipcode: "11206",
    healthCategories: ["Pregnant"],
    employed: "No",
    spouseEmployed: "No",
    hasWic: "Yes",
    hasSnap: "Yes",
    newApplicant: "Yes",
    householdMembers: [],
    mealFocus: ["breakfast", "dinner"],
    needsRefrigerator: "No",
    needsMicrowave: "No",
    needsCookingUtensils: "No",
  };
}

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as unknown as TrpcContext["res"],
  };
}

describe("submission.submit", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ id: "task_123" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it("accepts valid input and returns a reference number", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.submission.submit(validInput());

    expect(result.success).toBe(true);
    expect(result.referenceNumber).toBeDefined();
    expect(result.referenceNumber.length).toBe(6);
  });

  it("sends correct data to ClickUp API", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await caller.submission.submit(validInput());

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, options] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("https://api.clickup.com/api/v2/list/");
    expect(url).toContain("/task");
    expect(options.method).toBe("POST");
    expect(options.headers).toHaveProperty("Authorization");
    expect(options.headers).toHaveProperty("Content-Type", "application/json");

    const body = JSON.parse(options.body as string);
    expect(body.name).toBe("Jane Doe \u2014 Foodoo");
    expect(body.markdown_description).toContain("**Medicaid ID:** AB12345C");
    expect(body.markdown_description).toContain(
      "**Cell Phone:** (555) 123-4567"
    );
    expect(body.tags).toContain("freshselect-meals");
  });

  it("includes household members in the description", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const input = {
      ...validInput(),
      householdMembers: [
        {
          name: "John Doe",
          dateOfBirth: "03/10/2015",
          medicaidId: "CD67890E",
        },
      ],
    };

    await caller.submission.submit(input);

    const [, options] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(options.body as string);
    expect(body.markdown_description).toContain(
      "## Additional Household Members"
    );
    expect(body.markdown_description).toContain("**Name:** John Doe");
    expect(body.markdown_description).toContain("**Medicaid ID:** CD67890E");
  });

  it("includes meal preferences in the description", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const input = {
      ...validInput(),
      mealFocus: ["breakfast", "lunch"],
      breakfastItems: "Eggs and toast",
      lunchItems: "Salad and soup",
    };

    await caller.submission.submit(input);

    const [, options] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(options.body as string);
    expect(body.markdown_description).toContain(
      "**Meal Focus:** breakfast, lunch"
    );
    expect(body.markdown_description).toContain(
      "**Breakfast Items:** Eggs and toast"
    );
    expect(body.markdown_description).toContain(
      "**Lunch Items:** Salad and soup"
    );
  });

  it("includes referral source when provided", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const input = { ...validInput(), ref: "community_center" };

    await caller.submission.submit(input);

    const [, options] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(options.body as string);
    expect(body.markdown_description).toContain("## Referral");
    expect(body.markdown_description).toContain(
      "**Source:** community_center"
    );
  });

  it("routes sha referral to the correct ClickUp list", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const input = { ...validInput(), ref: "sha" };

    await caller.submission.submit(input);

    const [url] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("901414869527");
  });

  it("routes submissions without referral to the default list", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await caller.submission.submit(validInput());

    const [url] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("901414846482");
  });

  it("includes due date when Pregnant is selected", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const input = {
      ...validInput(),
      healthCategories: ["Pregnant"],
      dueDate: "2026-08-15",
    };

    await caller.submission.submit(input);

    const [, options] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(options.body as string);
    expect(body.markdown_description).toContain("**Due Date:** 2026-08-15");
  });

  it("includes miscarriage date when Had a Miscarriage is selected", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const input = {
      ...validInput(),
      healthCategories: ["Had a Miscarriage"],
      miscarriageDate: "2026-01-10",
    };

    await caller.submission.submit(input);

    const [, options] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(options.body as string);
    expect(body.markdown_description).toContain(
      "**Date of Miscarriage:** 2026-01-10"
    );
  });

  it("includes infant info when Postpartum is selected", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const input = {
      ...validInput(),
      healthCategories: ["Postpartum (Within the last 12 months)"],
      infantName: "Baby Doe",
      infantDateOfBirth: "2026-02-01",
      infantMedicaidId: "XY98765Z",
    };

    await caller.submission.submit(input);

    const [, options] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(options.body as string);
    expect(body.markdown_description).toContain("**Infant Name:** Baby Doe");
    expect(body.markdown_description).toContain(
      "**Infant Date of Birth:** 2026-02-01"
    );
    expect(body.markdown_description).toContain(
      "**Infant Medicaid ID (CIN):** XY98765Z"
    );
  });

  it("rejects invalid Medicaid ID format", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const input = { ...validInput(), medicaidId: "12345" };

    await expect(caller.submission.submit(input)).rejects.toThrow();
  });

  it("rejects invalid email format", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const input = { ...validInput(), email: "not-an-email" };

    await expect(caller.submission.submit(input)).rejects.toThrow();
  });

  it("rejects missing required fields", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const input = { ...validInput(), firstName: "" };

    await expect(caller.submission.submit(input)).rejects.toThrow();
  });

  it("throws when ClickUp API returns an error", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response("Unauthorized", { status: 401 })
    );

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.submission.submit(validInput())).rejects.toThrow(
      "We could not submit your application at this time"
    );
  });

  it("includes appliance needs in the description", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const input = {
      ...validInput(),
      needsRefrigerator: "Yes",
      needsMicrowave: "Yes",
      needsCookingUtensils: "No",
    };

    await caller.submission.submit(input);

    const [, options] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(options.body as string);
    expect(body.markdown_description).toContain(
      "**Needs Refrigerator:** Yes"
    );
    expect(body.markdown_description).toContain("**Needs Microwave:** Yes");
    expect(body.markdown_description).toContain(
      "**Needs Cooking Utensils:** No"
    );
  });

  it("does not include deli/counter or specific items fields", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await caller.submission.submit(validInput());

    const [, options] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(options.body as string);
    expect(body.markdown_description).not.toContain("Deli/Counter");
    expect(body.markdown_description).not.toContain("Specific Items");
  });
});
