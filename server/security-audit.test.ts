/**
 * Security Audit Regression Tests (May 2026)
 * Covers the 4 issues found in the deep security audit.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

// ─── BUG-SEC-A: referrer code limiter exists and is applied ─────────────────
describe("BUG-SEC-A: referrer portal code-based rate limiter", () => {
  it("referrerCodeLimiter is exported from security.ts", async () => {
    const security = await import("./_core/security");
    expect(typeof (security as any).referrerCodeLimiter).toBe("function");
  });

  it("index.ts applies referrerCodeLimiter to all 6 code-based endpoints", () => {
    const indexSrc = readFileSync(join(__dirname, "_core/index.ts"), "utf8");
    const endpoints = [
      "admin.referrerPortal.myClients",
      "admin.referrerPortal.myStats",
      "admin.referrerPortal.myMessages",
      "admin.referrerPortal.reply",
      "admin.referrerPortal.markAllRead",
      "admin.referrerPortal.deleteMessage",
    ];
    for (const ep of endpoints) {
      expect(indexSrc).toContain(`"/api/trpc/${ep}", referrerCodeLimiter`);
    }
  });
});

// ─── BUG-SEC-B: server-side file size check in admin documents.upload ────────
describe("BUG-SEC-B: admin documents.upload server-side size limit", () => {
  it("routers.ts contains MAX_ADMIN_UPLOAD_BYTES constant", () => {
    const routersSrc = readFileSync(join(__dirname, "routers.ts"), "utf8");
    expect(routersSrc).toContain("MAX_ADMIN_UPLOAD_BYTES");
    expect(routersSrc).toContain("10 * 1024 * 1024");
  });

  it("routers.ts throws BAD_REQUEST when buffer exceeds 10 MB", () => {
    const routersSrc = readFileSync(join(__dirname, "routers.ts"), "utf8");
    expect(routersSrc).toContain("buffer.length > MAX_ADMIN_UPLOAD_BYTES");
    expect(routersSrc).toContain("File is too large. Maximum allowed size is 10 MB.");
  });
});

// ─── BUG-SEC-C: extension derived from MIME type in admin documents.upload ───
describe("BUG-SEC-C: admin documents.upload uses MIME-derived extension", () => {
  it("routers.ts has MIME_TO_EXT map in admin upload procedure", () => {
    const routersSrc = readFileSync(join(__dirname, "routers.ts"), "utf8");
    expect(routersSrc).toContain("MIME_TO_EXT");
    expect(routersSrc).toContain('"application/pdf": "pdf"');
    expect(routersSrc).toContain("safeExt = MIME_TO_EXT[input.contentType]");
  });

  it("admin upload key uses safeExt, not user-supplied filename extension", () => {
    const routersSrc = readFileSync(join(__dirname, "routers.ts"), "utf8");
    // The key must use safeExt, not ext derived from input.name
    const adminUploadBlock = routersSrc.slice(
      routersSrc.indexOf("BUG-SEC-C FIX"),
      routersSrc.indexOf("const { url } = await storagePut(key", routersSrc.indexOf("BUG-SEC-C FIX"))
    );
    expect(adminUploadBlock).toContain("safeExt");
    expect(adminUploadBlock).not.toContain('input.name.split(".")');
  });
});

// ─── BUG-SEC-D: SameSite=none only when Secure=true ─────────────────────────
describe("BUG-SEC-D: SameSite=none only set on HTTPS requests", () => {
  it("getSessionCookieOptions returns SameSite=lax on HTTP", async () => {
    const { getSessionCookieOptions } = await import("./_core/cookies");
    const mockReq = {
      protocol: "http",
      headers: {},
      socket: { remoteAddress: "127.0.0.1" },
    } as any;
    const opts = getSessionCookieOptions(mockReq);
    expect(opts.sameSite).toBe("lax");
    expect(opts.secure).toBe(false);
  });

  it("getSessionCookieOptions returns SameSite=none on HTTPS (x-forwarded-proto)", async () => {
    const { getSessionCookieOptions } = await import("./_core/cookies");
    const mockReq = {
      protocol: "http",
      headers: { "x-forwarded-proto": "https" },
      socket: { remoteAddress: "10.0.0.1" },
    } as any;
    const opts = getSessionCookieOptions(mockReq);
    expect(opts.sameSite).toBe("none");
    expect(opts.secure).toBe(true);
  });

  it("SameSite=none is never set without Secure=true", async () => {
    const { getSessionCookieOptions } = await import("./_core/cookies");
    const httpReq = {
      protocol: "http",
      headers: {},
      socket: { remoteAddress: "127.0.0.1" },
    } as any;
    const opts = getSessionCookieOptions(httpReq);
    if (opts.sameSite === "none") {
      expect(opts.secure).toBe(true);
    }
  });
});
