import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock the db module
vi.mock("./db", () => ({
  createSubmission: vi.fn().mockResolvedValue(undefined),
  getSubmissionById: vi.fn().mockResolvedValue({
    id: 1,
    referenceNumber: "ABC123",
    firstName: "Sarah",
    lastName: "Cohen",
    email: "sarah@example.com",
    cellPhone: "718-555-1234",
    medicaidId: "AB12345C",
    supermarket: "Foodoo",
    referralSource: "sha",
    status: "new",
    adminNotes: null,
    formData: {},
    hipaaConsentAt: new Date("2026-01-01T00:00:00Z"),
    clickupTaskId: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
  }),
  listSubmissions: vi.fn().mockResolvedValue({
    rows: [
      {
        id: 1,
        referenceNumber: "ABC123",
        firstName: "Sarah",
        lastName: "Cohen",
        email: "sarah@example.com",
        cellPhone: "718-555-1234",
        medicaidId: "AB12345C",
        supermarket: "Foodoo",
        referralSource: "sha",
        status: "new",
        adminNotes: null,
        formData: {},
        hipaaConsentAt: new Date("2026-01-01T00:00:00Z"),
        clickupTaskId: null,
        createdAt: new Date("2026-01-01T00:00:00Z"),
        updatedAt: new Date("2026-01-01T00:00:00Z"),
      },
    ],
    total: 1,
    page: 1,
    pageSize: 15,
    totalPages: 1,
  }),
  getSubmissionStats: vi.fn().mockResolvedValue({
    total: 5,
    new: 3,
    in_review: 1,
    approved: 1,
    rejected: 0,
    on_hold: 0,
  }),
  updateSubmissionStatus: vi.fn().mockResolvedValue(undefined),
  getSubmissionByRef: vi.fn().mockResolvedValue(undefined),
}));

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAdminContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "admin-user",
    email: "admin@freshselect.com",
    name: "Admin User",
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

function createUserContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 2,
    openId: "regular-user",
    email: "user@example.com",
    name: "Regular User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

function createAnonContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

describe("admin.stats", () => {
  it("returns stats for admin users", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.admin.stats();
    expect(result.total).toBe(5);
    expect(result.new).toBe(3);
    expect(result.approved).toBe(1);
  });

  it("throws FORBIDDEN for regular users", async () => {
    const caller = appRouter.createCaller(createUserContext());
    await expect(caller.admin.stats()).rejects.toThrow("Staff access required");
  });

  it("throws UNAUTHORIZED for anonymous users", async () => {
    const caller = appRouter.createCaller(createAnonContext());
    await expect(caller.admin.stats()).rejects.toThrow();
  });
});

describe("admin.list", () => {
  it("returns paginated submissions for admin", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.admin.list({ page: 1, pageSize: 15 });
    expect(result.rows).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.totalPages).toBe(1);
    expect(result.rows[0]?.firstName).toBe("Sarah");
  });

  it("accepts search and status filters", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.admin.list({
      search: "Sarah",
      status: "new",
      page: 1,
    });
    expect(result.rows).toBeDefined();
  });

  it("throws FORBIDDEN for non-admin", async () => {
    const caller = appRouter.createCaller(createUserContext());
    await expect(caller.admin.list({})).rejects.toThrow("Staff access required");
  });
});

describe("admin.getById", () => {
  it("returns a submission by ID for admin", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.admin.getById({ id: 1 });
    expect(result.referenceNumber).toBe("ABC123");
    expect(result.firstName).toBe("Sarah");
    expect(result.status).toBe("new");
  });

  it("throws NOT_FOUND when submission does not exist", async () => {
    const { getSubmissionById } = await import("./db");
    vi.mocked(getSubmissionById).mockResolvedValueOnce(undefined);
    const caller = appRouter.createCaller(createAdminContext());
    await expect(caller.admin.getById({ id: 9999 })).rejects.toThrow("Client not found");
  });

  it("throws FORBIDDEN for non-admin", async () => {
    const caller = appRouter.createCaller(createUserContext());
    await expect(caller.admin.getById({ id: 1 })).rejects.toThrow("Staff access required");
  });
});

describe("admin.updateStatus", () => {
  it("updates submission status for admin", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.admin.updateStatus({
      id: 1,
      status: "approved",
      adminNotes: "Verified eligibility",
    });
    expect(result.success).toBe(true);
  });

  it("accepts all valid status values", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    for (const status of ["new", "in_review", "approved", "rejected", "on_hold"] as const) {
      const result = await caller.admin.updateStatus({ id: 1, status });
      expect(result.success).toBe(true);
    }
  });

  it("throws FORBIDDEN for non-admin", async () => {
    const caller = appRouter.createCaller(createUserContext());
    await expect(
      caller.admin.updateStatus({ id: 1, status: "approved" })
    ).rejects.toThrow("Staff access required");
  });
});
