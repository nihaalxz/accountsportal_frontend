# Phase 2 API Coverage Matrix

This document maps all backend C# controllers and actions for Phase 2 to their respective frontend TypeScript features.

## API Coverage Map

| Backend Controller / Action  | HTTP Method | Endpoint                                    | Frontend Feature       | Frontend API Method           | Status / Coverage                                                  |
| :--------------------------- | :---------- | :------------------------------------------ | :--------------------- | :---------------------------- | :----------------------------------------------------------------- |
| **AuthController**           |             |                                             |                        |                               |                                                                    |
| `Login`                      | POST        | `/api/auth/login`                           | Auth Store             | `login()`                     | Fully Integrated                                                   |
| `Refresh`                    | POST        | `/api/auth/refresh`                         | Auth Store             | `attemptRefresh()`            | Fully Integrated                                                   |
| `Logout`                     | POST        | `/api/auth/logout`                          | Auth Store             | `logout()`                    | Fully Integrated                                                   |
| `GetMe`                      | GET         | `/api/auth/me`                              | Auth Store             | `bootstrapSession()`          | Fully Integrated                                                   |
| **TransactionController**    |             |                                             |                        |                               |                                                                    |
| `GetTransactions`            | GET         | `/api/transaction`                          | Financial Transactions | `getTransactions()`           | Fully Integrated (with list filter & pagination query)             |
| `PostIncoming`               | POST        | `/api/transaction/incoming`                 | Financial Transactions | `createIncomingTransaction()` | Fully Integrated (with Idempotency-Key support)                    |
| `PostOutgoing`               | POST        | `/api/transaction/outgoing`                 | Financial Transactions | `createOutgoingTransaction()` | Fully Integrated (with Idempotency-Key support)                    |
| `PostContra`                 | POST        | `/api/transaction/contra`                   | Financial Transactions | `createContraTransaction()`   | Fully Integrated (with Idempotency-Key support)                    |
| `Approve`                    | POST        | `/api/transaction/{id}/approve`             | Financial Transactions | `approveTransaction()`        | Fully Integrated (Master Accountant gated)                         |
| `Reject`                     | POST        | `/api/transaction/{id}/reject`              | Financial Transactions | `rejectTransaction()`         | Fully Integrated (Master Accountant gated with reject reason body) |
| **AccountController**        |             |                                             |                        |                               |                                                                    |
| `GetAccounts`                | GET         | `/api/account`                              | Cash Accounts          | `getAccounts()`               | Fully Integrated                                                   |
| `CreateAccount`              | POST        | `/api/account`                              | Cash Accounts          | `createAccount()`             | Fully Integrated (Master Accountant gated)                         |
| `UpdateAccount`              | PUT         | `/api/account/{id}`                         | Cash Accounts          | `updateAccount()`             | Fully Integrated (Master Accountant gated)                         |
| `ToggleStatus`               | POST        | `/api/account/{id}/toggle-status`           | Cash Accounts          | `toggleAccountStatus()`       | Fully Integrated (Master Accountant gated)                         |
| `CorrectBalance`             | POST        | `/api/account/{id}/correct-balance`         | Cash Accounts          | `correctAccountBalance()`     | Fully Integrated (Master Accountant gated with Idempotency-Key)    |
| **BankController**           |             |                                             |                        |                               |                                                                    |
| `GetBanks`                   | GET         | `/api/bank`                                 | Bank Accounts          | `getBanks()`                  | Fully Integrated                                                   |
| `CreateBank`                 | POST        | `/api/bank`                                 | Bank Accounts          | `createBank()`                | Fully Integrated (Master Accountant gated)                         |
| `UpdateBank`                 | PUT         | `/api/bank/{id}`                            | Bank Accounts          | `updateBank()`                | Fully Integrated (Master Accountant gated)                         |
| `ToggleStatus`               | POST        | `/api/bank/{id}/toggle-status`              | Bank Accounts          | `toggleBankStatus()`          | Fully Integrated (Master Accountant gated)                         |
| **ReconciliationController** |             |                                             |                        |                               |                                                                    |
| `GetSummary`                 | GET         | `/api/reconciliation/summary`               | Dashboard              | `getReconciliationSummary()`  | Fully Integrated                                                   |
| **ReportingController**      |             |                                             |                        |                               |                                                                    |
| `GetGeneralLedgerReport`     | GET         | `/api/reporting/general-ledger/{accountId}` | Cash Accounts Detail   | `getGeneralLedgerReport()`    | Fully Integrated (date-range statement view)                       |
