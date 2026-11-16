# Phase 2 Backend Contract Gaps

> Documented gaps found during Phase 2 backend re-audit.
> These are features required by the frontend specification that are NOT supported by the current backend.

---

## GAP-001: No Single Transaction GET Endpoint

**Required:** `GET /api/transaction/{id}`  
**Classification:** NOT SUPPORTED  
**Impact:** HIGH — Transaction detail page cannot fetch a specific transaction directly.

**Workaround:**

- Transaction detail page loads `GET /api/transaction?page=1&pageSize=100` and finds by ID in the result window.
- If the transaction is older than the first 100 records, it shows NOT FOUND.
- This is a degraded experience — recommended to add `GET /api/transaction/{id}` to the backend.

---

## GAP-002: No Transaction Reversal Endpoint

**Required:** `POST /api/transaction/{id}/reverse`  
**Classification:** NOT SUPPORTED  
**Impact:** MEDIUM — Reversal UI will show an informational "Not Available" message.

**Notes:**

- The `FinancialTransaction` domain entity has no `Reverse()` method.
- Financial history is immutable by current design.
- Any future reversal should create a compensating transaction (new outgoing/incoming to offset), not modify the original.

---

## GAP-003: No Pagination Metadata

**Required:** Total record count in transaction list responses for proper pagination UI.  
**Classification:** NOT SUPPORTED  
**Impact:** MEDIUM — Cannot show "Page X of Y" or total count.

**Workaround:**

- Detect last page by: `results.length < pageSize`
- Show "No more results" instead of page count.
- Recommend adding `X-Total-Count` header or wrapping response in `{ items: [], totalCount: int }`.

---

## GAP-004: No Single Account GET Endpoint

**Required:** `GET /api/account/{id}`  
**Classification:** NOT SUPPORTED  
**Impact:** LOW — All accounts returned in single GET call (no pagination on accounts list).

**Workaround:**

- Account detail page loads full `GET /api/account` list and finds by ID in memory.
- Acceptable given accounts list is small and unpaginated.

---

## GAP-005: No Single Bank GET Endpoint

**Required:** `GET /api/bank/{id}`  
**Classification:** NOT SUPPORTED  
**Impact:** LOW — Same workaround as accounts (list-based lookup).

---

## GAP-006: No Account Movements Endpoint

**Required:** `GET /api/account/{id}/movements` or filtered transaction list by account ID.  
**Classification:** NOT SUPPORTED  
**Impact:** MEDIUM — Account detail "Recent Movements" section cannot show account-specific transactions.

**Workaround:**

- Use `GET /api/reporting/general-ledger/{accountId}` for GL-level movements with date range.
- The transaction list does NOT support filtering by `sourceAccountId` or `destinationAccountId`.
- Account detail will show GL report section instead of movements.

---

## GAP-007: No Bank Movements Endpoint

**Required:** `GET /api/bank/{id}/movements` or filtered transaction list by bank ID.  
**Classification:** NOT SUPPORTED  
**Impact:** MEDIUM — Bank detail cannot show bank-specific transaction history.

**Workaround:**

- No equivalent reporting endpoint for bank-level GL.
- Bank detail will show account-level transactions only where `sourceBankId` or `destinationBankId` matches — but transaction list API does NOT filter by bank ID.
- Bank movements section will be labeled "Not Available — Use transaction list filtered by reference."

---

## GAP-008: No RowVersion / Optimistic Concurrency Tokens

**Required:** Concurrency tokens on financial entities to prevent lost-update scenarios.  
**Classification:** NOT SUPPORTED  
**Impact:** LOW — Business-logic 409s (e.g., approving an already-approved transaction) serve as the conflict detection mechanism.

**Frontend handling:**

- Any 409 response from approve/reject/correct-balance is treated as a conflict.
- User is shown a conflict dialog explaining the data may have changed.
- User must manually refresh and retry.

---

## GAP-009: No Account Statement Endpoint (Direct)

**Available:** `GET /api/reporting/statement/{accountCode}` — uses string `accountCode`, not `long accountId`.  
**Classification:** PARTIAL SUPPORT  
**Impact:** MEDIUM — `AccountCode` is not exposed in `AccountResponse` DTO. Cannot correlate account ID to accountCode without additional data.

**Workaround:**

- Use `GET /api/reporting/general-ledger/{accountId}` with `long accountId` for account GL report.
- This provides debit/credit entries per account with date-range filtering.

---

## Summary Table

| Gap ID  | Feature                   | Severity | Workaround                          |
| :------ | :------------------------ | :------- | :---------------------------------- |
| GAP-001 | Single transaction GET    | HIGH     | List + client-side filter (100 max) |
| GAP-002 | Transaction reversal      | MEDIUM   | Informational UI only               |
| GAP-003 | Pagination metadata       | MEDIUM   | Last-page heuristic                 |
| GAP-004 | Single account GET        | LOW      | Full list + client filter           |
| GAP-005 | Single bank GET           | LOW      | Full list + client filter           |
| GAP-006 | Account movements         | MEDIUM   | GL report by accountId              |
| GAP-007 | Bank movements            | MEDIUM   | Not available — inform user         |
| GAP-008 | RowVersion concurrency    | LOW      | 409 as conflict signal              |
| GAP-009 | Account statement by code | MEDIUM   | GL report by accountId              |
