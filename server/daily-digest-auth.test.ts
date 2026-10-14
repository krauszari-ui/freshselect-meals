import { describe, expect, it } from "vitest";

describe("daily digest authorization", () => {
  it("does not let an ordinary authenticated user invoke test mode", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync(new URL("./_core/index.ts", import.meta.url).pathname, "utf8");
    const start = source.indexOf('app.post("/api/scheduled/daily-digest"');
    const end = source.indexOf("const { getDailyDigestData }", start);
    const authorizationBlock = source.slice(start, end);

    expect(authorizationBlock).toContain('if (!user || !(user as any).isCron)');
    expect(authorizationBlock).not.toContain("&& !isTest");
    expect(authorizationBlock).toContain('req.headers["x-cron-secret"]');
  });

  it("requires cron credentials for the scheduled QA endpoint", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync(new URL("./_core/index.ts", import.meta.url).pathname, "utf8");
    const start = source.indexOf('app.post("/api/scheduled/qa-health"');
    const end = source.indexOf("// Per-route rate limiters", start);
    const authorizationBlock = source.slice(start, end);

    expect(authorizationBlock).toContain('if (!user || !(user as any).isCron)');
  });

  it("registers the daily digest in the Vercel entrypoint with cron-only access", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync(new URL("../src/index.ts", import.meta.url).pathname, "utf8");
    const start = source.indexOf('app.post("/api/scheduled/daily-digest"');
    const end = source.indexOf("// ─── Vercel Cron", start);
    const route = source.slice(start, end);

    expect(start).toBeGreaterThanOrEqual(0);
    expect(route).toContain("if (!user || !user.isCron)");
    expect(route).toContain('req.headers["x-cron-secret"]');
    expect(route).toContain("a.krausz@levelupresources.org");
  });
});
