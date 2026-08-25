# High-Severity Security and Workflow Audit

**Scope.** This review traced recent authentication, authorization, upload, referral, email, notification, and client-data changes. It focused on concrete compromise or workflow-failure scenarios rather than style or theoretical findings.

## Confirmed Findings Fixed

| Severity | Scenario and impact | Root cause | Remediation |
|---|---|---|---|
| High | An anonymous caller who guessed a short referral code could call the public lookup and receive referral metadata, including operational contact details and usage information. | The public `admin.referrals.getByCode` procedure returned nearly the full referral-link record after removing only its password hash. | The route now returns only `{ code, isActive }` for active links and is covered by the existing referral-code rate limiter. [1] [2] |
| High | An assessor could invoke global dashboard, recent-client, staff-directory, referral, and filter-count procedures directly, exposing data outside the assessor’s assigned-client scope. | These administrative procedures used a broad staff guard that included the `assessor` role. | Added a non-assessor staff guard to global procedures, preserving assessor access only to purpose-built, client-scoped routes. [1] |
| Medium-high | A viewer could submit a case note or referrer note by directly invoking a mutation despite being designated read-only. | The note mutations used the broad staff guard rather than a write-capable role guard. | Added a write guard that blocks viewers while retaining assessor notes only after the existing client-access check. [1] |
| High | A worker whose `showReferralLinks` permission was disabled in the sidebar could still manually call referral procedures; additionally, the staff message dialog called a referrer-session-only endpoint and could fail to load clients. | Referral access was enforced only in the UI, and the dialog reused an endpoint meant for a logged-in referrer. | Added server-side referral permission enforcement and a staff-scoped client lookup; the dialog now uses that authorized procedure. [1] [3] |
| Medium | During an assessor redirect away from the general client list, the page could still mount global staff, assessor-directory, referral, and filter queries, generating avoidable authorization failures. | The redirect runs after component mount while the global queries began immediately. | Disabled those global queries whenever the current user is an assessor; the scoped client list remains protected server-side. [1] |

## Workflow Validation

| Area | Validation performed | Result |
|---|---|---|
| Public application intake | Submitted one clearly labeled fake QA application through the actual local tRPC HTTP endpoint. | Passed. Application **FSM-FEFE6F81EAD1** saved with fake CIN `ZZ67942A`; outbound applicant/admin email side effects were intentionally suppressed for this QA record. |
| Public document upload | Uploaded a one-pixel PNG through `upload.document`, then included its returned URL in the QA application. | Passed. The storage object returned `200`, `image/png`, and `X-Content-Type-Options: nosniff`. |
| Attestation generation | Allowed the normal asynchronous attestation path to run after the QA intake. | Passed. A consent PDF was generated, persisted in the documents table, and retrieved with `200 application/pdf`. |
| Outbound email | Ran the verified Resend test-sink integration. | Passed. Resend accepted a test message and returned message ID `c17da81d-fc63-46a7-aa30-aa46f8b058c2`. |
| Inbound email hardening | Posted an unsigned payload to the local endpoint and the Vercel deployment. | Local development failed closed because `RESEND_WEBHOOK_SECRET` is absent locally; Vercel returned `400` for missing Svix headers, demonstrating its webhook secret is configured and unsigned payloads are rejected. [4] |
| Assessor notes | Reviewed the actual note procedure and existing mocked role regression. | The server permits an assessor to create notes only for an assigned or organization-visible client. The shared client-detail page now avoids global directory queries for assessors. A final browser click-through still requires an authenticated assessor session. [1] [5] |

## Regression and Deployment Validation

The full suite completed with **23 test files and 330 tests passing** when supplied with non-production values required by configuration-only tests. TypeScript completed without errors, and the repository’s Vercel Build Output API build completed successfully. The public Vercel site and its tRPC authentication endpoint were also previously confirmed reachable.

After the production database recovery, direct tRPC caller tests were added for assessor global-data restrictions, viewer case-note write denial, and the restricted-worker referral permission. The suite now completes with **23 test files and 333 tests passing** using validation-only configuration values. [1]

> The audit did **not** send messages to clients, alter real client records, or use real personal information. The one database record is clearly identified as a QA audit entry and uses an invalid `.example.invalid` address plus a `ZZ` test CIN.

## Remaining Operational Verification

The only unreproducible interaction is the final in-browser assessor note entry because the connected browser session is not signed in as an assessor. The server-side note path has a direct role regression test, but a live browser walkthrough should be completed with an assessor test account before declaring the UI click path fully audited.

## Production Login Recovery Addendum

On August 25, the Vercel production login endpoint returned a database `500` while the Manus-managed deployment returned the expected invalid-credential `401`. Vercel runtime output showed that its configured database was missing current application schema objects, including `emailBlasts`. The production, preview, and development Vercel `DATABASE_URL` values were rotated to the current managed database and the latest `main` deployment was redeployed. Post-recovery checks returned `200` for the public domain and login page, `401` for an invalid-credential administrator-login request, and a real administrator login succeeded. [6]

## References

[1]: https://github.com/krauszari-ui/freshselect-meals/blob/main/server/routers.ts "FreshSelect Meals authorization and workflow procedures"
[2]: https://github.com/krauszari-ui/freshselect-meals/blob/main/server/_core/index.ts "FreshSelect Meals request-level rate limiting"
[3]: https://github.com/krauszari-ui/freshselect-meals/blob/main/client/src/pages/AdminReferrals.tsx "FreshSelect Meals referral management workflow"
[4]: https://github.com/krauszari-ui/freshselect-meals/blob/main/server/_core/index.ts "FreshSelect Meals inbound email webhook verification"
[5]: https://github.com/krauszari-ui/freshselect-meals/blob/main/server/admin.test.ts "FreshSelect Meals assessor case-note regression test"
[6]: https://vercel.com/scn1/freshselect-meals "FreshSelect Meals Vercel project"
