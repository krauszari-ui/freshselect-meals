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
