# August 11 History Recovery Investigation

## Evidence collected without modifying data

| Dataset | Current retained range | August 11 count | Interpretation |
|---|---:|---:|---|
| Client messages | July 22 to August 11, 2026 | 29 | None are soft-deleted; the current table contains no messages after August 11. |
| Organization chat | July 22 to July 28, 2026 | 0 | No soft-deleted rows. |
| Case notes | May 3 to July 27, 2026 | 0 | No note rows after July 27 in the current database. |
| Tasks | May 7 to July 22, 2026 | 0 | No task rows after July 22 in the current database. |
| Stage history | April 20 to August 25, 2026 | 11 | Current stage changes continue after the apparent history cutoff. |
| Audit log | April 24 to August 25, 2026 | 227 | Current operational activity continues after the apparent history cutoff. |

The current database has no recorded physical client deletion on August 11. It has five `marked_not_interested` audit actions that day, which hide clients from the default client list without deleting them.

## Confirmed restoration evidence

All inspected core tables (`submissions`, `clientMessages`, `caseNotes`, `tasks`, `stageHistory`, and `auditLogs`) report a TiDB `Create_time` of **August 25, 2026 at approximately 06:37 UTC**. This confirms that the current database was recreated or restored on August 25 rather than being the original continuously running database.

## Working conclusion

The table-recreation evidence, together with history datasets ending at or before August 11, confirms that the active database is a restored dataset rather than the original continuously running production database. The exact backup timestamp still needs confirmation from the backup manifest, but the data pattern is consistent with an August 11 snapshot. No data has been written or reconstructed.

## Safe recovery order

1. Preserve the current database; do not overwrite it with an old snapshot.
2. Recover the previous Vercel `DATABASE_URL` version or a pre-restoration provider snapshot into a separate database.
3. Compare historical and current data by immutable IDs and timestamps.
4. Import only confirmed missing chat, note, task, document, and history rows after the user approves a reconciliation plan.
5. Do not invoke another Manus restoration until all backup packages and its one-time restore consequences are confirmed.

## Current recovery conclusion

No newer Manus Task Data backup and no access to the prior Vercel database connection have been identified. The Vercel environment-variable history confirms that a prior value existed, but it does not reveal or export the historical secret. Therefore, the post-snapshot chat, note, task, and upload history cannot be reconstructed reliably from the current restored database. The current database must remain preserved; no destructive restoration or synthetic reconstruction was performed.
