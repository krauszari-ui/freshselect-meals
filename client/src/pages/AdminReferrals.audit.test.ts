import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

describe("admin referral message dialog", () => {
  it("uses the staff-scoped referral client lookup instead of the referrer-session route", () => {
    const source = readFileSync(join(__dirname, "AdminReferrals.tsx"), "utf8");
    expect(source).toContain("trpc.admin.referrals.clients.useQuery");
    expect(source).not.toContain("trpc.admin.referrerPortal.myClients.useQuery");
  });
});
