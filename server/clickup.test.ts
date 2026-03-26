import { describe, expect, it } from "vitest";

describe("ClickUp API Key", () => {
  it("should have a valid CLICKUP_API_KEY environment variable", () => {
    const key = process.env.CLICKUP_API_KEY;
    expect(key).toBeDefined();
    expect(key).not.toBe("");
    expect(key!.startsWith("pk_")).toBe(true);
  });

  it("should be able to reach the ClickUp API", async () => {
    const key = process.env.CLICKUP_API_KEY;
    const res = await fetch("https://api.clickup.com/api/v2/user", {
      headers: { Authorization: key! },
    });
    // 200 means valid key, 401 means invalid
    expect(res.status).toBe(200);
  });
});
