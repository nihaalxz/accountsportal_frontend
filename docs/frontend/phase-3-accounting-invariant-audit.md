# Phase 3 Accounting Invariant Audit

## Integrity Principles

The browser UI acts purely as a presentation and pre-validation assistant. It never calculates financial states authoritatively.

## Invariant Analysis

| Invariant Rule                     | Client validation                                                  | Backend Authority                                                      | Integrity Assessment |
| ---------------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------- | -------------------- |
| **Balanced Journal**               | sum(Debits) === sum(Credits) validation warning in UI.             | Enforced by Database Transactions during REST execution.               | SAFE                 |
| **Closed Periods**                 | Action buttons hidden or warning banner displayed in UI.           | Checked on Write by Period Entity Validator.                           | SAFE                 |
| **Control Account Restrictions**   | Select elements filter only parent accounts in edit/create forms.  | Checked during Create/Update Account execution in Database.            | SAFE                 |
| **No Double-Reversal**             | Reversal button hidden if `reversedByJournalEntryId` is populated. | Blocked during reverse execution inside the backend transaction scope. | SAFE                 |
| **Negative Balances / Overdrafts** | Display warning banner or money display color.                     | Balance validation checks during transaction execution.                | SAFE                 |

## Corrective Actions Taken

- Guarded `canReverseJournal` button in `/accounting/journals/[id]` to require both `!journal.reversedByJournalEntryId` and `!journal.reversalOfJournalEntryId`.
