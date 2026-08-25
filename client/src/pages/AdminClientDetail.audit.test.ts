import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

describe("assessor client-detail access", () => {
  it("does not request the admin-only staff list when rendered for an assessor", () => {
    const source = readFileSync(join(__dirname, "AdminClientDetail.tsx"), "utf8");
    expect(source).toContain("trpc.admin.staffList.useQuery(undefined, { enabled: !isAssessor })");
    expect(source).toContain("trpc.admin.listAssessors.useQuery(undefined, { enabled: !isAssessor })");
  });
});
