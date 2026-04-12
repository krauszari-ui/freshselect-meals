import { describe, expect, it } from "vitest";

describe("Resend API Key", () => {
  it("should have a valid Resend API key configured", async () => {
    const apiKey = process.env.RESEND_API_KEY;
    expect(apiKey).toBeTruthy();
    expect(apiKey!.startsWith("re_")).toBe(true);

    // This key is send-only restricted, so we verify by calling the API keys endpoint
    // A 401 with "restricted_api_key" message confirms the key is valid but restricted
    const response = await fetch("https://api.resend.com/domains", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    const body = await response.json();
    // A restricted key returns 401 with specific message - this confirms the key is valid
    expect(body.name).toBe("restricted_api_key");
  });
});
