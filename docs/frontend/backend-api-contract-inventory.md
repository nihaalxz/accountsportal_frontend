# Backend API Contract Inventory (Phase 2 Update)

> Last updated: Phase 2 backend re-audit  
> Backend: ASP.NET Core 9, JWT Bearer, Policy-based authorization

---

## Authentication & Authorization

### Roles (from `Program.cs`)

| Policy                      | Accepted Roles                                                                          |
| :-------------------------- | :-------------------------------------------------------------------------------------- |
| `RequireAccountant`         | `Accounts`, `accountant`, `Normal Accountant`, `master_accountant`, `Master Accountant` |
| `RequireMasterAccountant`   | `master_accountant`, `Master Accountant`                                                |
| `AccountsInternalApiAccess` | `InternalService` (service-to-service only)                                             |

### Auth Endpoints

| Method | Route               | Auth      | Notes                                                                                                          |
| :----- | :------------------ | :-------- | :------------------------------------------------------------------------------------------------------------- |
| POST   | `/api/auth/login`   | Anonymous | Body: `{ email, password }`. Returns `{ accessToken, refreshToken, userType, name, email, portalPermissions }` |
| POST   | `/api/auth/refresh` | Anonymous | Body: `{ refreshToken }`. Returns `{ accessToken, refreshToken }`                                              |
| POST   | `/api/auth/logout`  | Anonymous | Body: `{ refreshToken }`. Revokes token.                                                                       |
| GET    | `/api/auth/me`      | Bearer    | Returns `{ id, name, email, userType, portalPermissions, isActive }`                                           |

---

## Financial Transactions (`/api/transaction`)

### Endpoints

| Method | Route                           | Policy                  | Idempotency              | Notes                                                                                                           |
| :----- | :------------------------------ | :---------------------- | :----------------------- | :-------------------------------------------------------------------------------------------------------------- |
| GET    | `/api/transaction`              | RequireAccountant       | —                        | Filters: `status`, `type`, `referenceType`, `referenceId`, `page` (default 1), `pageSize` (default 20, max 100) |
| POST   | `/api/transaction/incoming`     | RequireAccountant       | `Idempotency-Key` header | Body: `CreateIncomingTransactionRequest`                                                                        |
| POST   | `/api/transaction/outgoing`     | RequireAccountant       | `Idempotency-Key` header | Body: `CreateOutgoingTransactionRequest`                                                                        |
| POST   | `/api/transaction/contra`       | RequireAccountant       | `Idempotency-Key` header | Body: `CreateContraTransactionRequest`                                                                          |
| POST   | `/api/transaction/{id}/approve` | RequireMasterAccountant | —                        | No body. Returns updated `TransactionResponse`.                                                                 |
| POST   | `/api/transaction/{id}/reject`  | RequireMasterAccountant | —                        | Body: `{ reason: string }`                                                                                      |

**NOT SUPPORTED:**

- `GET /api/transaction/{id}` — No single-record endpoint
- `DELETE /api/transaction/{id}` — Financial history is immutable
- `/api/transaction/{id}/reverse` — No reversal endpoint

### Request DTOs

```
CreateIncomingTransactionRequest:
  DestinationAccountId?: long
  DestinationBankId?: long
  Amount: decimal (must be > 0)
  PaymentMethod: string ("cash" | "bank" | "credit" | "banktransfer" | "wallet")
  ReferenceType?: string
  ReferenceId?: string
  Description?: string

CreateOutgoingTransactionRequest:
  SourceAccountId?: long
  SourceBankId?: long
  Amount: decimal (must be > 0)
  PaymentMethod: string
  ReferenceType?: string
  ReferenceId?: string
  Description?: string
  SupplierId?: long
  SupplierName?: string

CreateContraTransactionRequest:
  SourceAccountId?: long
  SourceBankId?: long
  DestinationAccountId?: long
  DestinationBankId?: long
  Amount: decimal (must be > 0)
  Description?: string

RejectTransactionRequest:
  Reason: string (required)
```

### Response DTO

```
TransactionResponse:
  Id: long
  TransactionType: string (lowercase enum)
  SourceAccountId?: long
  DestinationAccountId?: long
  SourceBankId?: long
  DestinationBankId?: long
  Amount: decimal
  BalanceAfter?: decimal
  PaymentMethod: string
  ReferenceType?: string
  ReferenceId?: string
  Description?: string
  Status: string ("pending" | "approved" | "rejected")
  ApprovedBy?: long
  ApprovedAt?: DateTime
  RejectedBy?: long
  RejectedAt?: DateTime
  ReturnReason?: string
  SupplierId?: long
  SupplierName?: string
  ExpenseHeaderId?: long
  CreatedBy: long
  CreatedAt: DateTime
```

### Enum Values (all returned as lowercase strings)

**TransactionType:** `incoming`, `outgoing`, `contra`, `purchasereturn`, `salesreturn`, `walletdebit`

**PaymentMethod:** `cash`, `bank`, `credit`, `banktransfer`, `wallet`

**TransactionStatus:** `pending`, `approved`, `rejected`

**ReferenceType:** `sale`, `expense`, `refund`, `supplierpayment`, `openingbalance`, `correction`, `transfer`, `suppliercreditclearance`, `supplierwallet`, `salary`, `advance`, `loan`

### State Machine

```
Pending ──[approve (MasterAccountant)]──► Approved
Pending ──[reject  (MasterAccountant)]──► Rejected
Approved ──► (terminal — no reversal endpoint)
Rejected ──► (terminal — no re-submission endpoint)
```

### Error Responses

| Status | Condition                                               |
| :----- | :------------------------------------------------------ |
| 400    | Invalid payload                                         |
| 401    | Unauthenticated                                         |
| 403    | Insufficient role                                       |
| 404    | Transaction not found (approve/reject)                  |
| 409    | Conflict — e.g., approving already-approved transaction |

---

## Cash Accounts (`/api/account`)

### Endpoints

| Method | Route                               | Policy                  | Idempotency              | Notes                                                 |
| :----- | :---------------------------------- | :---------------------- | :----------------------- | :---------------------------------------------------- |
| GET    | `/api/account`                      | RequireAccountant       | —                        | Returns all accounts, ordered by Name. No pagination. |
| POST   | `/api/account`                      | RequireMasterAccountant | —                        | Create account                                        |
| PUT    | `/api/account/{id}`                 | RequireMasterAccountant | —                        | Update name/type/ledgerType/bankId                    |
| POST   | `/api/account/{id}/toggle-status`   | RequireMasterAccountant | —                        | Toggle `isActive`                                     |
| POST   | `/api/account/{id}/correct-balance` | RequireMasterAccountant | `Idempotency-Key` header | Balance correction                                    |

**NOT SUPPORTED:**

- `GET /api/account/{id}` — No single-record endpoint
- `DELETE /api/account/{id}`
- Account movements/statement endpoint (use reporting)

### Request DTOs

```
CreateAccountRequest:
  Name: string (required)
  Type: string ("cash" | "bank" | "credit")
  LedgerType: string ("asset" | "liability" | "capital" | "income" | "expense")
  OpeningBalance: decimal
  BankId?: long

UpdateAccountRequest:
  Name: string (required)
  Type: string (required)
  LedgerType: string (required)
  BankId?: long

BalanceCorrectionRequest:
  AdjustmentAmount: decimal
  Reason: string (required)
```

### Response DTO

```
AccountResponse:
  Id: long
  Name: string
  Type: string ("cash" | "bank" | "credit")
  LedgerType: string
  Balance: decimal (opening/book balance)
  CurrentBalance: decimal (running balance)
  BankId?: long
  IsActive: bool
  CreatedAt: DateTime
```

**Note:** No `RowVersion` / concurrency token on Account entity.

---

## Bank Accounts (`/api/bank`)

### Endpoints

| Method | Route                          | Policy                  | Notes                                                 |
| :----- | :----------------------------- | :---------------------- | :---------------------------------------------------- |
| GET    | `/api/bank`                    | RequireAccountant       | Returns all banks ordered by BankName. No pagination. |
| POST   | `/api/bank`                    | RequireMasterAccountant | Create bank. Duplicate AccountNumber returns 409.     |
| PUT    | `/api/bank/{id}`               | RequireMasterAccountant | Update name/account number                            |
| POST   | `/api/bank/{id}/toggle-status` | RequireMasterAccountant | Toggle `isActive`                                     |

**NOT SUPPORTED:**

- `GET /api/bank/{id}` — No single-record endpoint
- `DELETE /api/bank/{id}`
- Deposit/withdrawal/transfer endpoints (use transaction posting)
- Bank statement endpoint (use reporting)

### Request DTOs

```
CreateBankRequest:
  BankName: string (required)
  AccountNumber: string (required, must be unique)
  OpeningBalance: decimal

UpdateBankRequest:
  BankName: string (required)
  AccountNumber: string (required)
```

### Response DTO

```
BankResponse:
  Id: long
  BankName: string
  AccountNumber: string
  Balance: decimal (opening/book balance)
  CurrentBalance: decimal (running balance)
  IsActive: bool
  CreatedAt: DateTime
```

---

## Reconciliation (`/api/reconciliation`)

### Endpoints

| Method | Route                                                 | Policy            | Notes                                                                                    |
| :----- | :---------------------------------------------------- | :---------------- | :--------------------------------------------------------------------------------------- |
| GET    | `/api/reconciliation/summary`                         | RequireAccountant | Dashboard summary metrics                                                                |
| GET    | `/api/reconciliation/supplier-statement/{supplierId}` | RequireAccountant | Paginated transactions for supplier. Filters: `startDate`, `endDate`, `page`, `pageSize` |
| GET    | `/api/reconciliation/gl-reconciliation`               | RequireAccountant | GL audit: missing journals, unbalanced, duplicate postings                               |

### Summary Response

```
ReconciliationSummaryResponse:
  TotalBankBalance: decimal
  TotalAccountBalance: decimal
  TotalSupplierWalletBalance: decimal
  TotalSupplierCreditWalletBalance: decimal
```

---

## Reporting (`/api/reporting`)

### Endpoints

| Method | Route                                       | Policy            | Notes                                                                  |
| :----- | :------------------------------------------ | :---------------- | :--------------------------------------------------------------------- |
| GET    | `/api/reporting/trialbalance`               | RequireAccountant | `?asOfDate=` (optional)                                                |
| GET    | `/api/reporting/general-ledger/{accountId}` | RequireAccountant | `?startDate=&endDate=` (required)                                      |
| GET    | `/api/reporting/statement/{accountCode}`    | RequireAccountant | `?startDate=&endDate=` (required). accountCode is a string identifier. |
| GET    | `/api/reporting/expenses`                   | RequireAccountant | `?startDate=&endDate=` (required)                                      |

---

## Concurrency / Idempotency

| Feature            | Implementation                                                                          |
| :----------------- | :-------------------------------------------------------------------------------------- |
| Idempotency-Key    | Header on POST /incoming, /outgoing, /contra, /account/{id}/correct-balance             |
| RowVersion         | NOT IMPLEMENTED — no optimistic concurrency tokens in backend entities                  |
| Conflict detection | 409 returned when business-state conflict occurs (e.g., approving approved transaction) |
