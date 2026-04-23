# Project TODO

- [x] Set up warm Brooklyn/kosher color theme (earth tones, greens, oranges)
- [x] Add Google Fonts for warm readable typography
- [x] Create backend tRPC procedure for secure ClickUp API submission
- [x] Store ClickUp API key as server-side secret
- [x] Capture ?ref= URL parameter for referral routing
- [x] Build 3-step wizard with progress indicator
- [x] Step 1: Supermarket selection cards (Foodoo, Rosemary Kosher, Chestnut, Central Market)
- [x] Step 2: Personal info (First Name, Last Name, DOB, Medicaid ID with validation)
- [x] Step 2: Contact info (Phone, Email with validation)
- [x] Step 2: Address fields pre-filled with Brooklyn/NY defaults
- [x] Step 2: Health categories checkboxes
- [x] Step 2: Benefits questions (Employed, Spouse Employed, WIC, SNAP)
- [x] Step 2: New Applicant dropdown
- [x] Step 2: Household members dropdown (1-9) with dynamic member fields
- [x] Step 3: Meal focus multi-select (Breakfast, Lunch, Dinner, Snacks) with conditional text fields
- [x] Step 3: Required text box for healthy meals from deli/counter
- [x] Step 3: Optional specific items text box
- [x] Step 3: Household appliances questions (Refrigerator, Microwave, Cooking Utensils)
- [x] Form validation with real-time error messages
- [x] Submit button with loading spinner and double-submit prevention
- [x] Success confirmation page with reference number
- [x] Hero section with headline, subheadline, and trust line
- [x] Header with logo and CTA button
- [x] Mobile responsive design
- [x] Write vitest tests for backend submission procedure
- [x] Map referral parameter to ClickUp list ID 901414869527 for referral submissions
- [x] Add 'sha' referral key routing to ClickUp list 901414869527
- [x] Add conditional "Due date" field when Pregnant is checked
- [x] Add conditional "Date of Miscarriage" field when Had a Miscarriage is checked
- [x] Add conditional "Infant Name", "Infant Date of Birth", "Infant Medicaid ID (CIN)" fields when Postpartum is checked
- [x] Add owner notification on each form submission
- [x] Update backend to include new conditional fields in ClickUp task description
- [x] Update tests for new fields and notification (19 tests passing)
- [x] Removed owner notification; applicant email included in ClickUp task for ClickUp Automation-based email
- [x] Remove Deli / Counter Selections section from Step 3
- [x] Remove healthyMealsRequest and specificItems fields from backend and frontend
- [x] Update tests for removed fields and email notification change (19 tests passing)
- [x] Add required HIPAA consent checkbox at bottom of Step 3 above Submit button
- [x] Add Zod validation for consent (z.boolean().refine(val => val === true))
- [x] Record consent with timestamp in ClickUp task under "Legal & Compliance" heading
- [x] Rename "Personal Information" heading to "Mother's Personal Information" in Step 2

## Login & Tracking System
- [x] Create submissions table in database schema
- [x] Run database migration for submissions table
- [x] Store submissions in DB on form submit (alongside ClickUp, DB-first resilience)
- [x] Add admin tRPC procedures: list submissions, get detail, update status
- [x] Build admin login page (Manus OAuth)
- [x] Build admin dashboard with submissions table (search, filter, sort)
- [x] Build application detail view with full data and status management
- [x] Add status workflow: New → In Review → Approved → Rejected → On Hold
- [x] Add admin route protection (admin role only)
- [x] Write tests for new admin procedures (12 admin tests + 34 total passing)

## Major Update - Landing Page, Form Restructure, Workers, Email
- [x] Restructure form flow: Landing page → Form (with screening questions + uploads) → Grocery selection
- [x] Build landing page from pasted SCN content (eligibility, programs, how it works, contact info)
- [x] Add all 16 SCN screening questions to form (from image)
- [x] Add Food Allergies / Dietary Restrictions section to form
- [x] Add document upload fields: mother's Medicaid card, birth certificate, marriage license
- [x] Add per-child document uploads: Medicaid card, birth certificate for each child
- [x] Move grocery/supermarket selection to AFTER the form
- [x] Add worker login system with admin-controlled permissions
- [x] Add CSV export button on admin dashboard
- [x] Create Privacy Policy page based on NYS HIPAA laws
- [x] Link HIPAA consent checkbox to Privacy Policy page
- [x] Set up email notifications: send form copy to applicant's email
- [x] Set up email notifications: send every application to info@freshselectmeals.com
- [x] Update contact information to info@freshselectmeals.com
- [x] Update DB schema for file uploads and worker roles

## CareFlow-Style Admin Dashboard Rebuild
- [x] Update DB schema: add client stages, tasks, case notes, documents tables
- [x] Build dark sidebar admin layout matching CareFlow design
- [x] Build Dashboard page: stats cards, client journey pipeline, recent clients, tasks
- [x] Build Agency Overview page: stats, stage breakdown, recently added/updated, ineligible, outstanding tasks
- [x] Build Clients list page: search, filters (stage, status, supermarket), sortable table, CSV export
- [x] Build Client Detail page: intake journey progress, overview/assessment/services/tasks tabs
- [x] Build Client Overview tab: info, household, addresses, phones, emails, health categories, case notes
- [x] Build Client Assessment tab: SCN Screening Questionnaire display
- [x] Build Client Services tab
- [x] Build Tasks page: search, filters, open/completed/verified tabs, task cards
- [x] Build Document Library page: category filter, document cards, upload/download
- [x] Worker permissions: admin controls worker access levels (Staff Management page)

## Exact CareFlow Clone
- [x] Deep analysis of every CareFlow page (Dashboard, Clients, Client Detail, Tasks, Documents, Agency, Settings)
- [x] Exact clone of Dashboard page with all details
- [x] Exact clone of Clients list page with all filters and options
- [x] Exact clone of Client Detail page with all tabs (Overview, Assessment, Services, Completed Tasks)
- [x] Exact clone of Tasks page
- [x] Exact clone of Document Library page
- [x] Exact clone of Agency Overview page
- [x] Match all sidebar navigation, colors, icons, and layout exactly

## Bug Fixes & Improvements (User Feedback)
- [x] Match admin pages to original green color theme (not dark navy CareFlow colors)
- [x] Fix Add Client button - make it functional
- [x] Remove mother's birth certificate upload from form (keep only kids' birth certificates)
- [x] Make Household Members required (not optional)
- [x] Fix duplicate SNAP question (removed from benefits, kept in screening)
- [x] Fix duplicate WIC question (removed from benefits, kept in screening)
- [x] Fix duplicate "Enrolled in Health Home" question (removed from health categories, kept in screening)
- [x] Fix grocery/supermarket address display (added Bingo Wholesale)
- [x] Update "New Applicant" to "New application or transfer from different agency"
- [x] Add phone number 718-307-4664 to the site (header, contact section, success page, error page, emails)

## Round 2 - Fix All Broken Buttons & Referral System
- [x] Audit and fix ALL broken buttons across Dashboard, Clients, Client Detail, Tasks, Documents, Agency pages
- [x] Fix form-to-client-list connection (submissions appear correctly in admin client list)
- [x] Fix Client Detail page: Edit button, delete button, stage outcome dropdown, all tab interactions
- [x] Fix Client Detail: Add Household Member, Add Address, Add Phone, Add Email dialogs
- [x] Fix Client Detail: Add Task, Add Note, Upload Document interactions
- [x] Fix Client Detail: Services tab - Add Service dialog
- [x] Fix Dashboard: clickable stat cards navigate to correct filtered views
- [x] Fix Tasks page: create task, update task status, filter/search
- [x] Fix Documents page: upload document, delete document, category filter
- [x] Fix Agency page: all interactive elements
- [x] Build referral link system: admin can create referral links for people
- [x] Track which referrer brought each client (show on client list and detail)
- [x] Referral management page or section in admin

## Round 3 - Submission Fix, Grocery Update, Referral Logins
- [x] Fix form submission error ("Something went wrong" on submit) - email failures now non-blocking
- [x] Update grocery store names and addresses to correct values
- [x] Add grocery store logos from their websites
- [x] Build referral person login system (each referral link person gets a login)
- [x] Referral person can view their referred clients (read-only, no edit)
- [x] Referral person dashboard showing their referral stats and client list

## Round 4 - Fix Persistent Form Submission Error
- [x] Diagnose and fix the form submission error - ROOT CAUSE: hasWic/hasSnap Zod validation rejected empty strings after UI fields were removed. Fixed Zod schema to optional, auto-populate from screening, moved household validation to correct step.

## FreshSelect 2.0 - Complete Architectural Refactor
- [x] Audit all ClickUp integration code and map removal points
- [x] Audit all Manus OAuth code and map removal points
- [x] Audit all external service dependencies (Forge API, Manus-specific env vars)
- [x] Design new local auth schema (email/password for admins and workers)
- [x] Update drizzle schema with proper users table for local auth
- [x] Apply database migrations for new auth tables (passwordHash on users, drop clickupTaskId)
- [x] Build local email/password authentication system (register, login, sessions)
- [x] Replace Manus OAuth routes with local auth routes
- [x] Remove all ClickUp API calls from submission flow
- [x] Store all order data exclusively in local database
- [x] Update admin dashboard to read from local DB only (no ClickUp)
- [x] Build admin login page (email/password)
- [x] Build worker login page (email/password)
- [x] Strip Manus OAuth hooks and providers from frontend
- [x] Fix referral system: 30-day cookie, proper worker attribution in local DB
- [x] Fix household relationship dropdown in new architecture
- [x] Fix grocery store selections in new architecture
- [x] Fix all TypeScript errors (0 errors)
- [x] Write tests for new local auth system
- [x] Write tests for new submission flow (no ClickUp) - 25 tests covering local DB, emails, referrals
- [x] Full end-to-end testing of all pages - 75 tests passing
- [x] Ensure app is fully standalone and deployable to Vercel/anywhere
- [x] Delete clickup.test.ts
- [x] Rewrite submission.test.ts (remove all ClickUp-specific tests, add local-only tests)
- [x] Fix admin.test.ts (remove clickupTaskId references, update loginMethod to 'local')
- [x] Add 30-day referral cookie tracking in Home.tsx
- [x] Clean up ManusDialog references and Manus OAuth comments
- [x] Generate and apply migration for removed clickupTaskId column

## Production Launch Prep (freshselectmeals.com)
- [x] PlanetScale DB compatibility: SSL pool connection via URL param, no FK constraints in schema
- [x] Replace Manus Forge storage proxy with direct AWS S3 (SigV4) implementation
- [x] Update index.html with production SEO metadata and OG tags for freshselectmeals.com
- [x] Remove Manus analytics script from index.html
- [x] Create vercel.json for Express+React deployment
- [x] Remove ComponentShowcase route from App.tsx (dev-only page)
- [x] Verify admin auth protection (adminProcedure guards all admin routes)
- [x] Referral links use window.location.origin (auto-resolves to freshselectmeals.com in prod)
- [x] 75 tests passing, 0 TypeScript errors

## Electronic Signature & Attestation
- [x] Install signature_pad library
- [x] Build reusable SignaturePad component (canvas draw + clear + typed fallback)
- [x] Add Household Attestation block near HIPAA checkbox in Step 3
- [x] Add Acknowledgment block with Member/Parent/Guardian Name field
- [x] Add electronic signature canvas (draw or type name)
- [x] Update Zod schema to include signatureDataUrl and guardianName fields
- [x] Signature stored in formData JSON (no separate column needed)
- [x] Update backend Zod schema to validate signature fields
- [x] Update tests for new signature fields (75 passing)

## UI/Form Changes (April 2026)
- [x] Rename "Mother's Personal Information" to "Primary Member Information"
- [x] Remove Required Documents section
- [x] Remove screening questions 5, 6, 7, 8, 9, 10, 11, 15
- [x] Make Health Categories required field
- [x] Add agency name field when "Transfer" is selected for new applicant
- [x] Rename "Choose Your Supermarket" to "Choose Your Vendor"
- [x] Remove word "Supermarket" from Foodoo, Rosemary, Chestnut names
- [x] Remove Bingo Wholesale from vendor options
- [x] Full review and test of all buttons and flows (75 tests passing)

## Production Launch (April 2026)
- [x] Push database schema to PlanetScale via drizzle-kit push (7 tables created)
- [x] Create seed-production script (scripts/seed-production.mjs)
- [x] Run seed script against production database (2 users + 1 referral link)
- [x] Verify Admin and Referrer dashboard UI is professional and intact
- [x] Search and replace all manus.computer / manus.config references (none found)
- [x] Verify referral link logic uses window.location.origin
- [x] Verify vercel.json routing config (/api/* -> server, all else -> SPA)
- [x] Final sync to GitHub for Vercel deployment

## Export Feature (April 2026)
- [x] Add Export to Excel (.xlsx) button on Admin Clients page
- [x] Add Export to CSV option
- [x] Include all client fields in export (name, CIN, DOB, address, language, household, health categories, stage, vendor, referral, guardian name, etc.)

## Vendor/Neighborhood Restructuring (April 2026)
- [x] Restructure vendors by neighborhood (Williamsburg, Borough Park, Flatbush, Monsey, Monroe)
- [x] Williamsburg: Foodoo Kosher, Rosemary Kosher, Chestnut, Central Market
- [x] Borough Park: KRM, Certo Market, Breadberry
- [x] Flatbush: Pomegranate, Moisha's Discount
- [x] Monsey: Evergreen, Hatzlacha
- [x] Monroe: Refresh, Landau's
- [x] Find logos and correct addresses for all vendors
- [x] Add neighborhood filter dropdown to Admin Clients page
- [x] Add vendor filter dropdown to Admin Clients page
- [x] Make export (Excel/CSV) respect all active filters including neighborhood
- [x] Update vendor selection UI in Home.tsx to group by neighborhood
- [x] Update AdminClients Add Client dialog with neighborhood + vendor dropdowns
- [x] 75 tests passing, 0 TypeScript errors

## Form Submission Error Fix (April 2026)
- [x] Root cause: Resend email API returns 403 (domain not verified), error leaked into response
- [x] Fix: Use setTimeout(0) to fully detach email/referral tracking from request lifecycle
- [x] Add .passthrough() to Zod submissionInputSchema to prevent unknown field rejections
- [x] Add additionalMembersCount field to Zod schema (sent by frontend but not in schema)
- [x] Wrap email sends with individual .catch() handlers for granular error logging
- [x] DB save returns success IMMEDIATELY; emails fire in background and never block user
- [x] Update tests to use vi.useFakeTimers() to properly handle setTimeout(0) in tests
- [x] email.ts already has defensive try-catch wrappers (no changes needed)
- [x] 75 tests passing, 0 TypeScript errors

## Neighborhood Column Migration (April 2026)
- [x] Add neighborhood column to Drizzle schema (varchar 64, nullable)
- [x] Push schema to PlanetScale production database via drizzle-kit push
- [x] Verify neighborhood column exists in production (confirmed)
- [x] Update createSubmission in routers.ts to save neighborhood to DB column
- [x] Update getAllSubmissions in db.ts to filter by DB column instead of client-side JSON filtering
- [x] 75 tests passing, 0 TypeScript errors

## Persistent Form Submission Error Investigation (April 2026)
- [x] Check 1: Schema alignment — all frontend fields match Zod schema exactly, .passthrough() active
- [x] Check 2: Zod validation — .passthrough() confirmed, all field names match, additionalMembersCount present
- [x] Check 3: Database URL and SSL — PlanetScale connection works, test insert/delete succeeded, neighborhood column confirmed
- [x] Added server-side logging for submission processing (success/failure with ref numbers)
- [x] Improved frontend error display to show actual backend error message
- [x] 75 tests passing, 0 TypeScript errors
- [x] Sync to GitHub for redeployment (checkpoint 4d9abf27)

## Add additionalMembersCount Column (April 2026)
- [x] Add additionalMembersCount column to Drizzle schema (int, default 0)
- [x] Push schema to PlanetScale via drizzle-kit push — verified column exists (type: int, default: 0)
- [x] Update submit logic in routers.ts to map form field to new column (parseInt with fallback to 0)
- [x] Run tests — 75 passing, 0 TypeScript errors
- [x] Sync to GitHub for Vercel redeployment (checkpoint 16bc7f7c)

## Root Cause: DATABASE_URL Missing on Render (April 2026)
- [x] Confirmed additionalMembersCount is NULL with DEFAULT 0 — not the issue
- [x] Confirmed all direct PlanetScale inserts succeed from sandbox
- [x] Confirmed production server (Render) returns 500 on every submit
- [x] Root cause: DATABASE_URL env var is not set on Render deployment
- [x] Improved error logging in db.ts and routers.ts to surface this clearly
- [x] 75 tests passing, 0 TypeScript errors
- [ ] User must add DATABASE_URL to Render environment variables

## Production DB Migration — TiDB (April 2026)
- [x] Identified production DB is TiDB Cloud (gateway05.us-east-1.prod.aws.tidbcloud.com), not PlanetScale
- [x] Added neighborhood varchar(64) NULL column to production TiDB submissions table
- [x] Added additionalMembersCount int NULL DEFAULT 0 column to production TiDB submissions table
- [x] Verified test insert with 6-char ref number succeeds with all columns
- [x] 75 tests passing, 0 TypeScript errors
- [ ] Sync to GitHub and redeploy on Render

## Vercel 404 Fix
- [x] Inspected package.json build scripts — build outputs dist/index.js + dist/public/
- [x] Fixed vercel.json: removed broken static asset route, route all traffic through dist/index.js
- [x] Fixed server/_core/vite.ts: replaced import.meta.dirname with fileURLToPath(__filename) for Vercel ESM compatibility
- [x] 75 tests passing, 0 TypeScript errors, production build verified
- [ ] Sync to GitHub for Vercel rebuild

## Vercel Serverless Entry Fix
- [x] Created api/index.ts — Express app exported without listen() for Vercel serverless
- [x] Updated vercel.json with functions config (nodejs20.x) pointing to api/index.js
- [x] Updated build script to compile api/index.ts → api/index.js via esbuild
- [x] Fixed serveStatic path resolution to handle both dist/ and api/ entry contexts
- [x] 75 tests passing, 0 TypeScript errors, build verified
- [ ] Sync to GitHub for Vercel redeploy

## Vercel Correct Fix — api/ Directory (April 2026)
- [x] Created api/index.js via esbuild from src/index.ts — exports Express app (no listen()), includes serveStatic
- [x] Updated vercel.json: rewrites all traffic to /api/index, no functions block
- [x] Updated build script: esbuild src/index.ts → api/index.js as part of pnpm build
- [x] serveStatic path resolution: api/__dirname → ../dist/public (correct for Vercel Lambda at /var/task/api/)
- [x] 75 tests passing, 0 TypeScript errors, build verified (api/index.js 71.6kb)
- [ ] Sync to GitHub for Vercel redeploy

## FINAL Vercel Fix — Zero Config Express Detection
- [x] Deleted vercel.json entirely — Vercel auto-detects Express from src/index.ts
- [x] Deleted api/index.js — not needed, Vercel compiles src/index.ts itself
- [x] src/index.ts exports default Express app (no listen())
- [x] Build script: vite build + esbuild dist/index.js + cp dist/public to public/
- [x] public/ created by build for Vercel CDN static assets (express.static() ignored by Vercel)
- [x] 75 tests passing, 0 TypeScript errors
- [ ] Sync to GitHub for Vercel redeploy

## DEFINITIVE Vercel Fix — @vercel/node Runtime (April 2026)
- [ ] Create api/index.js as CommonJS serverless function entry point
- [ ] Create vercel.json with functions (@vercel/node runtime) and rewrites
- [ ] Ensure dist/public is bundled correctly for frontend assets
- [ ] Verify build and tests pass after changes
- [ ] Sync to GitHub for Vercel redeploy

## Definitive Vercel Fix Round 2 (April 17 2026)
- [ ] Read and understand every file in the build chain
- [ ] Create api/index.js compiled entry point with @vercel/node builds config
- [ ] Create vercel.json with explicit builds + routes (NOT rewrites)
- [ ] Stop build from creating public/ (prevents Vercel static site detection)
- [ ] Test build locally, verify all paths
- [ ] Push and verify live deployment

## Definitive Vercel Fix Round 3 — Express Auto-Detection (April 17 2026)
- [x] Fix vercel.json: add outputDirectory pointing to dist/public
- [x] Fix build script: compile index.mjs at root for Vercel Express auto-detection
- [x] Fix build script: remove cp -r dist/public public (prevents Vercel static site detection)
- [x] Fix .gitignore: remove 'public' entry so Vercel can see build output if needed
- [x] Verify build works locally
- [x] Verify dev server still works
- [ ] Push and verify live deployment

## Fix Vercel API Routing (April 17 2026)
- [ ] Diagnose: tRPC API calls return HTML instead of JSON on production
- [ ] Fix API routing so Express serverless function handles /api/* requests
- [ ] Verify form submission works on live site

## Definitive Vercel Fix Round 4 — Build Output API (April 17 2026)
- [x] Create scripts/vercel-build.sh with Build Output API structure
- [x] Create scripts/copy-deps.mjs for selective dependency copying (pnpm-aware)
- [x] Update vercel.json: buildCommand → bash scripts/vercel-build.sh, outputDirectory → .vercel/output
- [x] Update .gitignore for .vercel/output/
- [x] Verify all imports resolve in the function bundle (12 packages + 83 transitive deps)
- [x] Verify function size under 250MB Vercel limit (45MB total)
- [x] Verify dev server still works (200 on / and /api/trpc)
- [ ] Push and verify live deployment

## Admin Login & Referral Program Audit (April 17 2026)
- [ ] Test admin login on live site (freshselectmeals.com/admin/login)
- [ ] Test referral link generation and tracking
- [ ] Test referral person login and dashboard
- [ ] Fix any issues found

## Fix SPA Routing — Remove serveStatic from Serverless Function (April 17 2026)
- [x] Remove serveStatic() call from src/index.ts (Express function must not serve static files on Vercel — use VERCEL env check)
- [x] Vercel config.json routes /(.*) → /index.html — SPA routing handled by CDN
- [x] Rebuild Vercel bundle and verify static/index.html + assets/ are correct
- [x] Verify /api/* routes still work (tRPC + OAuth) — dev server returns 200
- [x] Push and redeploy on Vercel

## Admin Dashboard Enhancements (Apr 2026)

- [x] Show vendor/supermarket in AdminClientDetail Overview tab (Client Information card)
- [x] Add editable adminNotes (Assessment notes) to AdminClientDetail Assessment tab with Save button
- [x] Add server-side PDF generation endpoint for Household Attestation + HIPAA document
- [x] Add "Download PDF" button in AdminClientDetail to download Household Attestation + HIPAA PDF

## Document Upload Fix & Household Form (Apr 2026)

- [x] Fix document upload: replace broken custom AWS S3 with Manus built-in storage (storagePut via Forge API)
- [x] Fix household member count dropdown: remove None, add "Please select..." placeholder, make required
- [x] Add marriage license upload field when Husband is selected as relationship
- [x] Verify uploaded documents appear in admin portal Documents section (confirmed end-to-end)
- [x] Remove PDF generation feature (pdfkit CJS/ESM conflict broke Vercel bundle) — restore clean ESM build
- [x] 79 tests passing, 0 TypeScript errors, Vercel bundle verified clean

## Household Attestation + HIPAA PDF Generation (April 19, 2026)
- [x] Install pdf-lib (pure ESM, no CJS conflicts) for server-side PDF generation
- [x] Create server/generateAttestationPdf.ts helper that produces a 1-page professional PDF
- [x] Integrate PDF generation into submission flow with try/catch error isolation (never blocks form submission)
- [x] Store generated PDF in Manus built-in storage and save URL in documents table
- [x] Add signature validation — form cannot submit without a signature
- [x] Add admin dashboard button to view/download the signed attestation PDF
- [x] Verify Vercel ESM bundle builds and starts cleanly with pdf-lib
- [x] End-to-end test: submit form → verify PDF appears in admin portal

## Production Issues (April 19, 2026 - Session 2)
- [x] Fix document uploads not working on production (storage.ts now falls back to VITE_FRONTEND_FORGE_API_KEY; Vercel needs BUILT_IN_FORGE_API_KEY env var added manually)
- [x] Fix custom domain https://www.freshselectmeals.com/ not working (domain resolves correctly to Vercel; upload fix is the real issue)
- [x] Add "Wife" relationship option that also triggers marriage license upload

## Platform Independence Migration (April 19, 2026)
- [x] Rewrite email.ts: retry logic (3 attempts, exponential backoff), idempotency keys, RESEND_FROM_EMAIL env var
- [x] Rewrite storage.ts: Cloudflare R2 primary (AWS SDK v3), Manus Forge fallback for local dev
- [x] Update env.ts: add R2 config fields, resendFromEmail field, keep Forge as optional fallback
- [x] Update security.ts: remove manus.space from ALLOWED_ORIGINS, remove manus.im from CSP, add R2 CDN domains
- [x] Add @aws-sdk/client-s3 and @aws-sdk/s3-request-presigner to copy-deps.mjs for Vercel bundle
- [ ] User action: Set up Cloudflare R2 bucket and add R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_URL to Vercel env vars
- [ ] User action: Verify freshselectmeals.com domain in Resend dashboard (add SPF + DKIM DNS records)
- [ ] User action: After domain verification, set RESEND_FROM_EMAIL = "FreshSelect Meals <noreply@freshselectmeals.com>" in Vercel env vars
- [ ] User action: Add BUILT_IN_FORGE_API_KEY to Vercel env vars (temporary, until R2 is configured)
- [ ] Optional: Set up Sentry or BetterStack for error monitoring
- [ ] Optional: Set up BetterStack Uptime for uptime monitoring and alerting

## Admin Dashboard Improvements (April 19, 2026 - Session 3)
- [x] Show uploaded documents (with download links) in client application detail view
- [x] Add filter by referral source to admin clients list
- [x] Add bulk select + select-all checkbox + bulk delete to admin clients list
- [x] Show total household members count in admin dashboard stats card
- [x] Trigger Vercel redeploy to activate RESEND_FROM_EMAIL env var (done via browser)
- [ ] Set up Sentry error monitoring (frontend + backend)
- [x] Add GitHub Actions CI workflow (.github/workflows/ci.yml — runs type check + tests + build on every push/PR)

## Admin User Management System (April 19, 2026 - Session 4)
- [x] Update DB schema: add super_admin/viewer roles, passwordResetToken, passwordResetExpires fields to users table
- [x] Build forgot password flow: generate secure token, send reset email via Resend
- [x] Build reset password page: validate token, set new password
- [x] Build admin user management page: list workers, add new worker, edit role, deactivate/reactivate
- [x] Add permission guards: super_admin can do everything, admin can manage clients, viewer is read-only
- [x] Add Forgot Password link to admin login page
- [x] Seed super-admin account: a.krausz@levelupresources.org (password: hatzlacha — change after first login)
- [x] Add createStaff procedure (create staff accounts without OAuth)

## Sidebar & Navigation
- [x] Add Staff Management link to sidebar (visible to super_admin and admin only)

## Members & Referrer Notifications
- [x] Add Members column to Clients list (primary member + household count, e.g. "1 + 3")
- [x] Add Total Members stat card to Referral Links page
- [x] Create referrer_messages table in DB schema (id, senderId, referrerId, clientId, message, createdAt, readAt)
- [x] Add DB migration for referrer_messages table
- [x] Add tRPC procedures: sendMessage, listMessages, markRead
- [x] Build notification inbox UI on Referral Links page (bell icon + unread count per referrer)
- [x] Build message compose dialog: @mention referrer, link to a client, free-text message
- [x] Show unread notification badge on referrer rows in Referral Links table

## Referrer Portal & Client Messaging
- [x] Add Total Members stat to referrer portal (/referrer) myStats endpoint and UI
- [x] Add Referrer Notes section to client detail page (AdminApplicationDetail), next to Case Notes
- [x] Referrer Notes: admin can write a message tagged to this client, sends via referrerMessages table
- [x] Show referrer messages on /referrer portal page so referrers can see action items from admin

## Referrer Messages UX
- [x] Include client firstName + lastName in referrer message list (join submissions table in listReferrerMessages)
- [x] Display "Re: Client Name" label on each message in the referrer portal Messages tab

## Referrer Reply & Client Email Thread
- [x] Add referrer reply to portal: referrer can type a reply in the Messages tab, stored in referrerMessages with direction=referrer
- [x] Show reply thread in admin Referral Links page (admin sees referrer's reply inline)
- [x] Create clientEmails table (id, submissionId, direction, subject, body, fromEmail, toEmail, attachmentUrls, sentAt, messageId, threadId)
- [x] Add DB migration for clientEmails table
- [x] Add sendClientEmail tRPC procedure (sends via Resend from info@freshselectmeals.com, stores in DB)
- [x] Add inbound email webhook endpoint to receive client replies via Resend
- [x] Build email thread UI on client detail page (compose with file attach, view thread with sent/received bubbles)

## Messaging & Email Thread Improvements
- [x] Add delete referrer note by admin (deleteReferrerNote procedure)
- [x] Add delete referrer note by referrer in portal (referrerPortal.deleteMessage procedure)
- [x] Auto-mark all messages as read when referrer opens Messages tab
- [x] Unify admin notes + referrer replies into one chronological thread log (single list, both directions)
- [x] Add attachment support to referrer notes (admin can attach file when sending note)
- [x] Client email replies (inbound) appear in the Email Thread log on client detail page
- [x] Confirm /api/inbound-email webhook correctly stores inbound emails in clientEmails table

## Staff Permissions — Sidebar Control
- [x] Add showReferralLinks to permissions JSON field (no migration needed — uses existing permissions column)
- [x] Update all permissions schemas in routers.ts (promote, updatePermissions, createStaff, updateStaff) to include showReferralLinks
- [x] Add showReferralLinks toggle to Staff Management page PERM_LIST (checkbox in create/edit modals)
- [x] Show 'No Referral Links' amber badge on worker rows in Staff Management when showReferralLinks is false
- [x] Hide Referral Links sidebar item for workers where showReferralLinks is false (AdminLayout filter)

## Email Reply Fix & Assessment Edits (April 20, 2026)
- [x] Fix client email reply-to: change from noreply@ to info@freshselectmeals.com so replies don't bounce
- [x] Add delete email procedure (admin.deleteClientEmail) and delete button in Email Thread UI
- [x] Make SCN assessment questions editable on client detail Assessment tab
- [x] Add "Mark Assessment Completed" toggle/button on Assessment tab
- [x] Store assessmentCompletedAt timestamp in submissions table

## SCN Assessment Editing Fix (April 20, 2026)
- [ ] Fix errors when saving SCN screening questionnaire edits
- [ ] Make screener name editable in Assessment tab
- [ ] Make screening date editable in Assessment tab
- [ ] Ensure all 16 SCN questions are editable and save correctly
- [ ] Verify save/cancel flow works end-to-end without errors

## Assessor Role (continued)
- [x] AdminClients: auto-lock to assessment-completed clients when viewed by assessor (hide filters that don't apply, lock assessmentCompleted=true in query)
- [x] Expose assessmentCompleted param in admin.list tRPC procedure so the DB-level filter works for assessors

## Assessor Role
- [x] Expand Edit Client dialog to include DOB, address (street, apt, city, state, zip), borough, neighborhood, vendor/supermarket, referral source
- [x] Add assessor role to user enum (DB migration applied)
- [x] Add assessorProcedure guard in routers.ts (assessor + admin + super_admin)
- [x] Add assessorList procedure: returns only assessment-completed clients
- [x] Add approveClient procedure: sets status to approved (assessor + admin)
- [x] Build AssessorPortal page at /assessor: shows assessment-completed clients, Approve button with confirmation dialog
- [x] Add /assessor route to App.tsx

## Pagination & Edit Client Fixes (Apr 21)
- [x] Fix pagination for "Assessment Completed" filter — currently treated as client-side virtual stage so DB returns all pages unfiltered; move to DB-level assessmentCompleted param
- [x] Add household member editing to Edit Client dialog (add/edit/remove members with name, DOB, Medicaid ID, relationship)

## Household Member Count Sync (Apr 21)
- [x] Sync additionalMembersCount when household members are edited via Edit Client dialog or Add Household Member action

## Email Setup - Resend Domain Verified (Apr 21)
- [x] Update outbound sender FROM address to use verified domain (noreply@freshselectmeals.com)
- [x] Verify inbound webhook route exists and parses Resend inbound payload correctly
- [x] Set inbound webhook URL in Resend dashboard
- [x] Add Svix webhook signature verification to inbound email handler
- [x] Write vitest for outbound email send (gracefully skips on network-restricted sandbox)
- [x] Write vitest for inbound webhook parsing (signed payload + missing headers rejection)
- [x] Update RESEND_API_KEY to krauszari account where both domains are verified
- [x] 99/99 tests passing

## Email Reply-To & Inbound Fix (Apr 21)
- [x] Fix inbound webhook to use correct Resend email.received payload format (data.to array, fetch body via API)
- [x] 99/99 tests passing with real outbound email send confirmed
- [ ] Test full round-trip: send email → client replies → reply appears in thread (requires live test)

## Fix Vercel 404 for /api/inbound-email (Apr 21)
- [x] Add inbound email webhook handler to src/index.ts (Vercel serverless entry point)
- [x] Add svix to copy-deps.mjs REQUIRED list so it's bundled into the Vercel function
- [x] Add --external:svix to vercel-build.sh esbuild command
- [x] 99/99 tests passing
- [ ] Push to GitHub to trigger Vercel redeploy
- [ ] Verify Resend webhook deliveries return 200 after redeploy

## Assessment Report & Bulk PDF Export

- [ ] Assessment Completion Report page (stats by stage/vendor/neighborhood)
- [ ] Bulk client selection on AdminClients page
- [ ] Export selected clients as one combined PDF (client info + assessment answers)

## Regressions to fix (Apr 22)
- [ ] Filter option counts missing on Clients page (vendor, neighborhood, stage counts)
- [ ] Zipcode filter not working
- [ ] Transfer agency name not showing in client list

## Notification Bell System (April 2026)
- [ ] notifications DB table (id, type, title, body, link, isRead, createdAt)
- [ ] tRPC procedures: notifications.list, notifications.markRead, notifications.markAllRead, notifications.unreadCount
- [ ] Auto-create notification on inbound client email reply
- [ ] Auto-create notification on referrer message reply
- [ ] Auto-create notification on new form submission
- [ ] Auto-create notification on task status change
- [ ] AdminNotifications.tsx page with full list, read/unread state, click-to-navigate
- [ ] Bell icon in AdminLayout sidebar with live unread count badge

## Notification Bell System (April 2026)
- [ ] notifications DB table (id, type, title, body, link, isRead, createdAt)
- [ ] tRPC procedures: notifications.list, notifications.markRead, notifications.markAllRead, notifications.unreadCount
- [ ] Auto-create notification on inbound client email reply
- [ ] Auto-create notification on referrer message reply
- [ ] Auto-create notification on new form submission
- [ ] Auto-create notification on task status change
- [ ] AdminNotifications.tsx page with full list, read/unread state, click-to-navigate
- [ ] Bell icon in AdminLayout sidebar with live unread count badge
