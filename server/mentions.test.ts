import { describe, expect, it } from "vitest";
import { containsExactMention } from "../client/src/lib/mentions";

describe("containsExactMention", () => {
  it("matches a complete mention token", () => {
    expect(containsExactMention("Please review this, @Ann Smith.", "Ann Smith")).toBe(true);
    expect(containsExactMention("@Rivky", "Rivky")).toBe(true);
  });

  it("does not match a shorter staff name inside another mention", () => {
    expect(containsExactMention("Please ask @Annabelle Smith", "Ann")).toBe(false);
    expect(containsExactMention("@Rivky-Cohen", "Rivky")).toBe(false);
  });

  it("escapes staff names that contain regular-expression punctuation", () => {
    expect(containsExactMention("Please review, @A. Cohen", "A. Cohen")).toBe(true);
    expect(containsExactMention("@Axc Cohen", "A. Cohen")).toBe(false);
  });
});
