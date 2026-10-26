import { describe, expect, it } from "vitest";
import { getPublicTrpcErrorMessage } from "./_core/trpc";

describe("public tRPC error sanitization", () => {
  it("does not expose a database query or parameters for unexpected failures", () => {
    const rawDriverError = "Failed query: select `id` from `users` where `users`.`email` = ?; params: staff@example.com";

    expect(getPublicTrpcErrorMessage("INTERNAL_SERVER_ERROR", rawDriverError))
      .toBe("An unexpected server error occurred. Please try again.");
  });

  it("preserves deliberate validation and authentication messages", () => {
    expect(getPublicTrpcErrorMessage("UNAUTHORIZED", "Invalid email or password"))
      .toBe("Invalid email or password");
    expect(getPublicTrpcErrorMessage("BAD_REQUEST", "Email is required"))
      .toBe("Email is required");
  });
});
