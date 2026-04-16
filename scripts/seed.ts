/**
 * Seed script — inserts initial admin user and test referrer.
 *
 * Usage:
 *   DATABASE_URL="mysql://..." pnpm tsx scripts/seed.ts
 *
 * Idempotent: will SKIP (not overwrite) records that already exist.
 */

import "dotenv/config";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { users, referralLinks } from "../drizzle/schema";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("ERROR: DATABASE_URL environment variable is required.");
    process.exit(1);
  }

  const connection = await mysql.createConnection(url);
  const db = drizzle(connection);

  // ── 1. Admin user ────────────────────────────────────────────────────────
  const ADMIN_EMAIL = "admin@freshselectmeals.com";
  const ADMIN_PASSWORD = "FreshSelect2026";

  const existingAdmin = await db
    .select()
    .from(users)
    .where(eq(users.email, ADMIN_EMAIL))
    .limit(1);

  if (existingAdmin.length > 0) {
    console.log(`✓ Admin user already exists (id=${existingAdmin[0].id}) — skipping.`);
  } else {
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
    await db.insert(users).values({
      openId: ADMIN_EMAIL,
      name: "Admin",
      email: ADMIN_EMAIL,
      loginMethod: "password",
      role: "admin",
      passwordHash,
      isActive: 1,
    });
    console.log(`✓ Created admin user: ${ADMIN_EMAIL}`);
  }

  // ── 2. Test referrer (referralLinks table) ───────────────────────────────
  const WORKER_EMAIL = "worker@freshselectmeals.com";
  const WORKER_PASSWORD = "worker2026";
  const WORKER_CODE = "worker123";

  const existingLink = await db
    .select()
    .from(referralLinks)
    .where(eq(referralLinks.code, WORKER_CODE))
    .limit(1);

  if (existingLink.length > 0) {
    console.log(`✓ Referral link '${WORKER_CODE}' already exists (id=${existingLink[0].id}) — skipping.`);
  } else {
    const passwordHash = await bcrypt.hash(WORKER_PASSWORD, 12);
    await db.insert(referralLinks).values({
      code: WORKER_CODE,
      referrerName: "Test Worker",
      email: WORKER_EMAIL,
      passwordHash,
      isActive: 1,
      usageCount: 0,
    });
    console.log(`✓ Created referral link: code='${WORKER_CODE}', email='${WORKER_EMAIL}'`);
  }

  await connection.end();
  console.log("\nSeed complete.");
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
