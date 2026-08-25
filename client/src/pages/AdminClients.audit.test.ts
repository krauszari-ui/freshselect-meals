import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

describe("Admin Clients role-sensitive queries", () => {
  it("does not fire global directory and filter queries before an assessor redirect", () => {
    const source = readFileSync(join(__dirname, "AdminClients.tsx"), "utf8");
    expect(source).toContain("trpc.admin.filterCounts.useQuery(undefined, {");
    expect(source).toContain("enabled: !isAssessor");
    expect(source).toContain("trpc.admin.staffList.useQuery(undefined, { enabled: !isAssessor })");
    expect(source).toContain("trpc.admin.listAssessors.useQuery(undefined, { enabled: !isAssessor })");
  });
});
