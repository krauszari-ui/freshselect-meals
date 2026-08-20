# High-Severity Security and Workflow Audit

**Date:** August 20, 2026  
**Scope:** Recent high-blast-radius changes, authorization boundaries, public intake, document uploads, assessor actions, referrer access, scheduled endpoints, and the critical staff workflow.

## Executive Summary

The audit confirmed and remediated **eight concrete security or correctness defects**. The most serious findings could have exposed client information to an unauthorized referrer or assessor, allowed unintended scheduled-job execution, or let an assessor change an unrelated client’s status. All confirmed defects received narrowly scoped fixes. The public intake path was then validated end-to-end with one clearly labelled non-real QA application, reference **FSM-FED69D91D117**.

| Result | Count |
|---|---:|
| Confirmed high-impact defects fixed | 8 |
| New or expanded regression tests | 12+ authorization and workflow cases |
| Focused security/workflow tests passing | 97 / 97 |
| TypeScript errors | 0 |
| Live QA public-submission records created | 1 clearly labelled non-real record |

## Confirmed Findings and Remediations

| Finding | Impact and concrete trigger | Root cause | Remediation and validation |
|---|---|---|---|
| **Referrer portal authorization bypass** | Anyone possessing a public referral code could call referrer portal procedures and obtain client lists, statistics, or messages associated with that code. | The public referral code was treated as an authorization credential instead of an identifier. | Added a signed, expiring, server-side referrer session established only after password login; required it for all client, statistics, and messaging operations; cleared it on logout. Regression coverage confirms a referral code alone cannot disclose client data. |
| **Scheduled report authorization bypass** | An ordinary signed-in staff user could invoke daily-digest test behavior or the QA health path and trigger operational work or retrieve report-related data. | Test-mode/session branches were broader than cron-only access. | Restricted both paths to cron credentials or the shared scheduled-job secret. Dedicated daily-digest authorization tests pass. |
| **Assessor PII exposure through global endpoints** | An assessor could query unrelated-client data through duplicate scan, assessment export, bulk retrieval, global task lists, or task statistics. | Several staff-accessible read procedures did not apply assessor organization/client scope. | Blocked assessors from unscoped global endpoints and enforced accessible-client scope for permitted bulk reads. Regression tests cover unauthorized duplicate, bulk-client, and global-task access. |
| **Unauthorized Not Eligible transition** | An assessor could directly invoke the Not Eligible mutation for a client outside their assigned organization. | The terminal stage mutation did not reuse the established assessor client-access guard. | Enforced assigned-organization access before the transition and added a regression test for an unrelated client. |
| **Organization assessor could not open eligible teammate cases** | Organization staff could see a teammate-assigned client in their organization list but were denied the client-detail route and could not add notes. | Client-detail authorization used a narrower rule than organization visibility and case-note access. | Reused the shared organization-aware assessor access helper for the client detail route. Regression coverage proves a teammate-organization assessor can open the client. |
| **Assessment completion could be browser-forced** | A caller could mark an incomplete assessment complete without all required answers or a due date, creating inaccurate workflow status. | Required-field and due-date checks existed only in the browser. | Enforced completion criteria server-side and preserved automatic stage behavior. Regression tests cover missing answers, missing due date, and valid completion. |
| **Rare reference-number collision misreported as a duplicate application** | Two submissions generated in the same reference-number collision window could receive a false duplicate response despite distinct Medicaid IDs. | A short random reference was treated like the unique Medicaid duplicate condition. | Switched to collision-resistant references and added a bounded collision retry that distinguishes a true Medicaid duplicate from a reference-key collision. |
| **Generated attestation PDFs could not be opened** | A newly submitted client’s **View PDF** button returned “Could not open document,” blocking staff from viewing signed attestations. | The UI preferred the storage key, which entered a storage-refresh route that failed for the stored Forge/CloudFront document URL. | Prefer the permanent stored URL, with storage-key fallback, in the client detail and document library. The generated attestation and a newly uploaded QA PDF both opened successfully in the browser. |

## End-to-End Workflow Evidence

One explicitly approved **non-real** QA application was submitted using reserved test contact values and the label **QA Audit**. The application completed all four stages: personal information, screening and health, meal preferences and attestation, and vendor selection. The confirmation page returned reference **FSM-FED69D91D117**.

The record appeared immediately in the authenticated staff client list, opened without a crash, and displayed the submitted household, screening-derived preferences, selected vendor, and generated attestation. A clearly labelled internal QA case note was saved successfully. Document validation covered both outcomes: an unsupported `text/plain` upload was correctly rejected by the MIME-type allowlist, while a harmless QA PDF uploaded successfully and opened in the browser viewer.

> The test record, note, and QA PDF remain clearly labelled in the system for traceability. They can be removed by an administrator if they are no longer needed.

## Validation

The final validation used the production-shaped preview environment and focused regression tests.

| Validation activity | Result |
|---|---|
| TypeScript type check | Passed with **0 errors** |
| Focused authorization, submission, and scheduled-job tests | **97 / 97 passed** |
| Authenticated admin UI review | Dashboard, client list, notification link, client detail, assessment, chat, organization chat, notes, document actions rendered and remained responsive |
| Public intake E2E | Submitted successfully and surfaced in staff workflow |
| Generated attestation opening | Failed before the fix; opened successfully after the URL-first fix |
| Allowed and rejected upload paths | Supported PDF succeeded; unsupported text format was rejected server-side |

The full test command reported four expected configuration assertions in this sandbox because `CRON_SECRET`, `RESEND_INBOUND_DOMAIN`, and `R2_PUBLIC_URL` are not injected here. These are deployment configuration checks, not regressions introduced by this audit. The focused suites that exercise the changed code pass.

## Remaining Operational Recommendations

The deployment should retain a strong `CRON_SECRET` (at least 32 characters) and configure the inbound-email and R2 public URL settings in every environment where those services are enabled. The current server behavior fails closed for protected scheduled and webhook paths when required secrets are unavailable, which is preferable to accepting unauthenticated calls.

No additional confirmed high-severity vulnerability remained in the audited paths at the conclusion of this pass.
