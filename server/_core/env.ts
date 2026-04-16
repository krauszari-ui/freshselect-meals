export const ENV = {
  /** Used as the JWT audience claim */
  appId: process.env.VITE_APP_ID ?? "freshselect-meals",
  /** Secret used to sign / verify session JWTs — must be set in production */
  cookieSecret: process.env.JWT_SECRET ?? "",
  /** MySQL connection string */
  databaseUrl: process.env.DATABASE_URL ?? "",
  /** Production flag */
  isProduction: process.env.NODE_ENV === "production",
  /** Resend API key for transactional email */
  resendApiKey: process.env.RESEND_API_KEY ?? "",
  // ── Forge API (storage, LLM, maps, etc.) ──────────────────────────────────
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
};
