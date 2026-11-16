# Phase 3 Real-Backend Test Data Strategy

## Sandbox Principles

All verification uses the isolated testing database. No production records are queried or mutated.

## Seed Scenarios for E2E

### 1. Isolated Accounts

- Standard chart of accounts includes Cash Drawer, primary bank account, and category expenses.
- Seed data ensures these accounts exist with non-zero balances for debit/credit operations.

### 2. Fiscal Periods

- Seeding defines at least one `Open` period.
- Standard transactions are targeted within the date bounds of the open period.

### 3. Expense Claims

- Expenses are initialized uniquely with custom `Correlation-ID` values per run.
- Workflows test transition logic sequentially: draft -> submit -> approve -> posted.

### 4. Balanced Journal Entries

- Journal entries use dynamic line arrays matching ledger accounts.
- Tests verify unbalanced journal rejection (returns HTTP 400 Bad Request ProblemDetails) and successful balanced entry posting.

### 5. Collision Avoidance

- Unique identifiers (such as `Date.now()` timestamps) are appended to Reference values to prevent key collision exceptions.
- Test sequences run serially to avoid shared state race conditions.
