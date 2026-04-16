export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

/**
 * Returns the admin login page path.
 * Manus OAuth has been removed — admin login now uses the
 * internal email/password form at /admin.
 */
export const getLoginUrl = (): string => "/admin";
