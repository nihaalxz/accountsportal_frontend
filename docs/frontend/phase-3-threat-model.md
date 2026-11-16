# Phase 3 Threat Model

## Threat Taxonomy & Mitigations

### 1. Financial Transaction Manipulation

- **Threat**: A client modifies the amount or destination of an expense or journal line during creation.
- **Impact**: Financial discrepancy in ledger records.
- **Mitigation**: The backend recalculates journal balances and checks that debit totals match credit totals before saving. The client UI is purely a presenter of results.

### 2. Double-Posting of Expenses/Journals

- **Threat**: Double-clicking submission buttons or retrying a request during network timeouts creates duplicate records.
- **Impact**: Duplicate ledger payouts.
- **Mitigation**: Idempotency Key / Correlation ID is populated by the frontend during draft creation and locked on the backend database unique constraints.

### 3. Reversing Reversed Journal Entries

- **Threat**: Tampering with page states to issue a reversal request for a journal entry that is already reversed.
- **Impact**: Double-crediting or circular balance updates.
- **Mitigation**: Backend checks `reversedByJournalEntryId` inside the transaction lock before reversing. The UI gates access by hiding actions for entries with existing linkages.

### 4. Bypassing Period Locks

- **Threat**: Modifying browser dates or request payloads to post journal transactions in a closed fiscal month.
- **Impact**: Compliance audit failure.
- **Mitigation**: Backend validates transaction dates against `AccountingPeriodStatus` status codes. The client UI disables posting workflows for dates in closed periods.
