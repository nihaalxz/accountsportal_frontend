# Phase 3 Contract Mismatch Report

## Summary

| ID  | Mismatch Description                                                                                                                                    | Component / File                        | Severity | Fix Actions                                                                                                           |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------- |
| 1   | `ExpenseStatus` does not match the backend `ExpenseStatus` enum. Frontend expects `'submitted'`, backend returns `'pendingapproval'`.                   | `src/features/expenses/types.ts`        | HIGH     | Change `'submitted'` to `'pendingapproval'`.                                                                          |
| 2   | Expense cancellation is permitted in both `'draft'` and `'submitted'` states on the frontend, but the backend throws an exception for non-draft states. | `src/features/expenses/types.ts`        | MEDIUM   | Restrict `canCancelExpense` logic to check only `'draft'` status.                                                     |
| 3   | Rejecting a Journal Entry payload uses type `RejectJournalRequest` which is `{ reason }`. Backend consumes `RejectTransactionRequest(string Reason)`.   | `src/features/journal-entries/types.ts` | LOW      | Verified compatible (auto camelCase serialization handles it), but update types to reflect backend parameter exactly. |
| 4   | Double reversals must be guarded against at the UI layer to prevent submitting duplicate reversals.                                                     | `src/features/journal-entries/types.ts` | MEDIUM   | Add UI checks guarding `canReverseJournal` if `reversedByJournalEntryId` is populated.                                |

## Mismatch Resolution Detail

- Mismatch #1: Fixed Svelte type and mappings in `types.ts`, lists, detail components.
- Mismatch #2: Adjusted `canCancelExpense` helper logic.
- Mismatch #3: None needed, standard serialization holds.
- Mismatch #4: UI actions check reversedByJournalEntryId before showing reversal dialog.
