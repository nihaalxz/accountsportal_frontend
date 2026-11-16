# Phase 3 Feature Inventory

## Inventory Classifications

We evaluate the implementation matching of the Svelte client against the backend ASP.NET Core API.

### 1. Chart of Accounts

- **Hierarchy Rendering**: `COMPLETE`
    - _Evidence_: Indented tree items showing ledger codes.
- **Account Details**: `COMPLETE`
    - _Evidence_: Shows parent references and activity.
- **Account Creation**: `COMPLETE`
    - _Evidence_: REST call mapping to `POST api/chartofaccounts`.
- **Account Editing**: `COMPLETE`
    - _Evidence_: REST call mapping to `PUT api/chartofaccounts/{id}`.
- **Seed System Accounts**: `COMPLETE`
    - _Evidence_: Rest call mapping to `POST api/chartofaccounts/seed`.

### 2. Accounting Periods

- **Period List**: `COMPLETE`
    - _Evidence_: Chronological sorting on the frontend.
- **Close Period**: `COMPLETE`
    - _Evidence_: REST call mapping to `POST api/accountingperiods/{id}/close`.
- **Reopen Period**: `COMPLETE`
    - _Evidence_: REST call mapping to `POST api/accountingperiods/{id}/reopen` passing a custom reason string.
- **Create Period**: `COMPLETE`
    - _Evidence_: REST call mapping to `POST api/accountingperiods`.

### 3. Expense Claims

- **Expense List**: `COMPLETE`
    - _Evidence_: Renders correctly with type safety filters.
- **Conditional Source Validation**: `COMPLETE`
    - _Evidence_: Renders Cash Accounts selector when cash payment method is selected; Bank Accounts selector when Bank/BankTransfer is selected.
- **Expense Submit**: `COMPLETE`
    - _Evidence_: REST call mapping to `POST api/expenses/{id}/submit`.
- **Expense Cancel**: `CONTRACT MISMATCH`
    - _Evidence_: Frontend permits cancellation on both draft & submitted states, but backend only allows draft.
- **Expense Approve**: `COMPLETE`
    - _Evidence_: REST call mapping to `POST api/expenses/{id}/approve`.
- **Expense Reject**: `COMPLETE`
    - _Evidence_: REST call mapping to `POST api/expenses/{id}/reject`.

### 4. Journal Entries

- **Journal List**: `COMPLETE`
    - _Evidence_: Table summary calculation logic.
- **Double-Entry balanced editor**: `COMPLETE`
    - _Evidence_: Live summation checking debits/credits.
- **Submit/Approve/Reject/Post/Reverse workflows**: `COMPLETE`
    - _Evidence_: Maps to matching POST endpoints in `JournalEntriesController`.

### 5. General Ledger & Reports

- **Trial Balance**: `COMPLETE`
    - _Evidence_: Fetching trial balance asOfDate.
- **Account Statement**: `COMPLETE`
    - _Evidence_: Shows running ledger.
- **Expense Categorization**: `COMPLETE`
    - _Evidence_: Category aggregates.

### 6. Reconciliation

- **Sweep Summary**: `COMPLETE`
    - _Evidence_: Sweeps cash drawers, banks and wallets.
- **Discrepancy Engine**: `COMPLETE`
    - _Evidence_: Highlights unbalanced, duplicate or missing general ledger postings.
