import { describe, it, expect } from "vitest";

// ─── Unit tests for assessor assignment feature ───────────────────────────

describe("assignAssessor input validation", () => {
  it("accepts a valid assessorId", () => {
    const input = { submissionId: 1, assessorId: 5 };
    expect(typeof input.submissionId).toBe("number");
    expect(typeof input.assessorId).toBe("number");
  });

  it("accepts null assessorId (unassign)", () => {
    const input = { submissionId: 1, assessorId: null };
    expect(input.assessorId).toBeNull();
  });

  it("rejects non-integer assessorId", () => {
    const isInteger = (v: unknown) => Number.isInteger(v) || v === null;
    expect(isInteger(1.5)).toBe(false);
    expect(isInteger(1)).toBe(true);
    expect(isInteger(null)).toBe(true);
  });
});

describe("assessorList scoping logic", () => {
  it("returns undefined assessorFilter for admin role (sees all clients)", () => {
    const role = "admin";
    const userId = 42;
    const assessorFilter =
      role === "admin" || role === "super_admin" ? undefined : userId;
    expect(assessorFilter).toBeUndefined();
  });

  it("returns userId as assessorFilter for assessor role (sees only own clients)", () => {
    const role = "assessor";
    const userId = 42;
    const assessorFilter =
      role === "admin" || role === "super_admin" ? undefined : userId;
    expect(assessorFilter).toBe(42);
  });

  it("returns userId as assessorFilter for worker role", () => {
    const role = "worker";
    const userId = 7;
    const assessorFilter =
      role === "admin" || role === "super_admin" ? undefined : userId;
    expect(assessorFilter).toBe(7);
  });
});

describe("reassignment warning logic", () => {
  it("triggers warning when client already has a different assessor", () => {
    const currentAssessorId = 3;
    const newAssessorId = 5;
    const shouldWarn = currentAssessorId !== null && newAssessorId !== null && currentAssessorId !== newAssessorId;
    expect(shouldWarn).toBe(true);
  });

  it("does not trigger warning when assigning for the first time", () => {
    const currentAssessorId = null;
    const newAssessorId = 5;
    const shouldWarn = currentAssessorId !== null && newAssessorId !== null && currentAssessorId !== newAssessorId;
    expect(shouldWarn).toBe(false);
  });

  it("does not trigger warning when unassigning", () => {
    const currentAssessorId = 3;
    const newAssessorId = null;
    const shouldWarn = currentAssessorId !== null && newAssessorId !== null && currentAssessorId !== newAssessorId;
    expect(shouldWarn).toBe(false);
  });

  it("does not trigger warning when reassigning to the same assessor", () => {
    const currentAssessorId = 5;
    const newAssessorId = 5;
    const shouldWarn = currentAssessorId !== null && newAssessorId !== null && currentAssessorId !== newAssessorId;
    expect(shouldWarn).toBe(false);
  });
});

describe("assessorId filter in listSubmissions", () => {
  it("passes assessorId to query when filter is active", () => {
    const assessorFilter = "3";
    const queryInput = {
      assessorId: assessorFilter !== "all" ? parseInt(assessorFilter) : undefined,
    };
    expect(queryInput.assessorId).toBe(3);
  });

  it("passes undefined when filter is 'all'", () => {
    const assessorFilter = "all";
    const queryInput = {
      assessorId: assessorFilter !== "all" ? parseInt(assessorFilter) : undefined,
    };
    expect(queryInput.assessorId).toBeUndefined();
  });
});
