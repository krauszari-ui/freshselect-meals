import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

describe("assessor client-detail access", () => {
  it("does not request the admin-only staff list when rendered for an assessor", () => {
    const source = readFileSync(join(__dirname, "AdminClientDetail.tsx"), "utf8");
    expect(source).toContain("trpc.admin.staffList.useQuery(undefined, { enabled: !isAssessor })");
    expect(source).toContain("trpc.admin.listAssessors.useQuery(undefined, { enabled: !isAssessor })");
    expect(source).toContain("trpc.org.list.useQuery({ includeInactive: false }, { enabled: !isAssessor })");
  });
});

describe("client-detail navigation and refresh", () => {
  it("opens supported tabs from notification query parameters and refreshes stage history", () => {
    const source = readFileSync(join(__dirname, "AdminClientDetail.tsx"), "utf8");
    expect(source).toContain('import { Link, useParams, useLocation, useSearch } from "wouter"');
    expect(source).toContain('tab === "assessment" || tab === "services" || tab === "activity" || tab === "chat"');
    expect(source).toContain("utils.admin.stageHistory.invalidate({ id })");
    expect(source).toContain("utils.auditLog.list.invalidate()");
  });
});
