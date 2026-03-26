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
    healthyMealsRequest: "Grilled chicken and salad",
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
    expect(body.name).toBe("Jane Doe — Foodoo");
    expect(body.markdown_description).toContain("**Medicaid ID:** AB12345C");
    expect(body.markdown_description).toContain("**Cell Phone:** (555) 123-4567");
    expect(body.tags).toContain("freshselect-meals");
  });

  it("includes household members in the description", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const input = {
      ...validInput(),
      householdMembers: [
        { name: "John Doe", dateOfBirth: "03/10/2015", medicaidId: "CD67890E" },
      ],
    };

    await caller.submission.submit(input);

    const [, options] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(options.body as string);
    expect(body.markdown_description).toContain("## Additional Household Members");
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
    expect(body.markdown_description).toContain("**Meal Focus:** breakfast, lunch");
    expect(body.markdown_description).toContain("**Breakfast Items:** Eggs and toast");
    expect(body.markdown_description).toContain("**Lunch Items:** Salad and soup");
  });

  it("includes referral source when provided", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const input = { ...validInput(), ref: "community_center" };

    await caller.submission.submit(input);

    const [, options] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(options.body as string);
    expect(body.markdown_description).toContain("## Referral");
    expect(body.markdown_description).toContain("**Source:** community_center");
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
    expect(body.markdown_description).toContain("**Needs Refrigerator:** Yes");
    expect(body.markdown_description).toContain("**Needs Microwave:** Yes");
    expect(body.markdown_description).toContain("**Needs Cooking Utensils:** No");
  });
});
