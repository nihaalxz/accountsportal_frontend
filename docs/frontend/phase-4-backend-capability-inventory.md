# Phase 4 Backend Capability Inventory

This document lists all the backend controllers, endpoints, and DTOs that are relevant for SvelteKit frontend Phase 4 implementation.

---

## 1. Authentication & Authorization Policies

The backend enforces standard ASP.NET Core JWT authorization. Policies are mapped to roles:
- `RequireAccountant`: Accessible by `Accounts`, `accountant`, `Normal Accountant`, `master_accountant`, `Master Accountant` roles.
- `RequireMasterAccountant`: Accessible only by `master_accountant` or `Master Accountant` roles.
- `AccountsInternalApiAccess`: Service-to-service policy for cross-portal internal sync.

---

## 2. Supplier Management & Wallets (`api/Supplier`)

Manages the supplier entities and their wallets.

### Endpoints

| HTTP Method | Route | Controller Action | Policy | Idempotency / Concurrency | Financial / GL Side Effects |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `api/Supplier` | `GetSuppliers` | `RequireAccountant` | None | None |
| `POST` | `api/Supplier` | `CreateSupplier` | `RequireMasterAccountant` | None | None |
| `PUT` | `api/Supplier/{id}` | `UpdateSupplier` | `RequireMasterAccountant` | None | None |

### DTOs

#### CreateSupplierRequest
- `Name`: string (required)
- `Code`: string (required, unique)
- `Categories`: list of string (optional)

#### UpdateSupplierRequest
- `Name`: string (required)
- `Categories`: list of string (optional)

#### SupplierResponse
- `Id`: long
- `Name`: string
- `Code`: string
- `Wallet`: decimal (authoritative wallet balance)
- `CreditWallet`: decimal (authoritative credit wallet balance)
- `IsVerified`: bool
- `Categories`: list of string
- `CreatedAt`: DateTime

---

## 3. Supplier Payments (`api/supplier-payments`)

Manages posting and status changes of payments to suppliers.

### Endpoints

| HTTP Method | Route | Controller Action | Policy | Idempotency / Concurrency | Financial / GL Side Effects |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `POST` | `api/supplier-payments` | `Post` | `RequireAccountant` | `Idempotency-Key` Header | Debits supplier wallet, creates pending outgoing payment |
| `POST` | `api/supplier-payments/{id}/approve` | `Approve` | `RequireMasterAccountant` | None | Approves the transaction, locks supplier ledger credit, posts GL journal entries |
| `POST` | `api/supplier-payments/{id}/reject` | `Reject` | `RequireMasterAccountant` | None | Rejects payment, releases pending wallet block |

### DTOs

#### CreateSupplierPaymentRequest
- `SupplierId`: long (required)
- `Amount`: decimal (must be > 0)
- `PaymentMethod`: string (`cash` or `bank`)
- `SourceAccountId`: long? (required if method is cash)
- `SourceBankId`: long? (required if method is bank)
- `ReferenceNumber`: string?
- `Description`: string?

#### RejectSupplierPaymentRequest
- `Reason`: string (required)

#### SupplierPaymentResponse
- `Id`: long
- `SupplierId`: long
- `Amount`: decimal
- `Currency`: string
- `PaymentMethod`: string
- `SourceType`: string
- `SourceAccountId`: long?
- `SourceBankId`: long?
- `ReferenceNumber`: string?
- `ExternalReference`: string?
- `ServiceType`: string?
- `Description`: string?
- `Status`: string (`pending`, `approved`, `rejected`)
- `RejectionReason`: string?
- `CreatedBy`: long
- `CreatedAt`: DateTime
- `RowVersion`: byte[]

---

## 4. Supplier reconciliation and statements (`api/reconciliation`)

Queries transactions filtered for suppliers, trial balance summaries, and general ledger postings.

### Endpoints

| HTTP Method | Route | Controller Action | Policy | Idempotency | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `api/reconciliation/summary` | `GetSummary` | `RequireAccountant` | None | Dashboard totals (banks, cash, supplier wallets, credit wallets) |
| `GET` | `api/reconciliation/supplier-statement/{supplierId}` | `GetSupplierStatement` | `RequireAccountant` | None | Paginated financial statement for a supplier |
| `GET` | `api/reconciliation/gl-reconciliation` | `GetGlReconciliation` | `RequireAccountant` | None | Audit list of missing journals, unbalanced entries, duplicate postings |

### DTOs

#### ReconciliationSummaryResponse
- `TotalBankBalance`: decimal
- `TotalAccountBalance`: decimal
- `TotalSupplierWalletBalance`: decimal
- `TotalSupplierCreditWalletBalance`: decimal

#### GlReconciliationReportResponse
- `MissingJournals`: list of `MissingJournalItem`
- `UnbalancedJournals`: list of `UnbalancedJournalItem`
- `DuplicatePostings`: list of `DuplicatePostingItem`
- `IsReconciled`: bool

---

## 5. Payroll Periods (`api/PayrollPeriods`)

Creates and manages periods of payroll execution.

### Endpoints

| HTTP Method | Route | Controller Action | Policy | Side Effects |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `api/PayrollPeriods` | `GetPeriods` | Authorized | None |
| `POST` | `api/PayrollPeriods` | `CreatePeriod` | `RequireMasterAccountant` | None |
| `POST` | `api/PayrollPeriods/{id}/close` | `ClosePeriod` | `RequireMasterAccountant` | Marks the period as closed. Prevents modifications. |

### DTOs

#### CreatePayrollPeriodRequest
- `Month`: int (1-12)
- `Year`: int (four-digit)
- `StartDate`: DateTime
- `EndDate`: DateTime

#### PayrollPeriodResponse
- `Id`: long
- `Month`: int
- `Year`: int
- `StartDate`: DateTime
- `EndDate`: DateTime
- `IsClosed`: bool
- `RowVersion`: byte[]

---

## 6. Payroll Runs (Processing & Posting) (`api/PayrollRuns`)

Executes generation, preview, recalculation, approval, and general ledger posting of a payroll cycle.

### Endpoints

| HTTP Method | Route | Controller Action | Policy | Side Effects / Concurrency |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `api/PayrollRuns` | `GetPayrollRuns` | Authorized | None |
| `GET` | `api/PayrollRuns/{id}` | `GetPayrollRunById` | Authorized | None |
| `GET` | `api/PayrollRuns/{id}/employees` | `GetPayrollRunEmployees` | Authorized | Returns employee line-item breakdown |
| `POST` | `api/PayrollRuns` | `CreatePayrollRun` | `RequireMasterAccountant` | Generates draft lines for all active staff. |
| `POST` | `api/PayrollRuns/{id}/calculate` | `CalculatePayrollRun` | `RequireMasterAccountant` | Runs authoritative backend computations for all active compensation, loans, advances, commissions, adjustments. Status -> `calculated`. |
| `POST` | `api/PayrollRuns/{id}/recalculate` | `RecalculateDraftPayrollRun` | `RequireMasterAccountant` | Re-calculates calculated/draft runs. |
| `POST` | `api/PayrollRuns/{id}/approve` | `ApprovePayrollRun` | `RequireMasterAccountant` | Marks run as approved, transitions associated sub-elements to posted. Status -> `approved`. |
| `POST` | `api/PayrollRuns/{id}/post-gl` | `PostPayrollRunToGeneralLedger` | `RequireMasterAccountant` | Validates active accounting period, posts journal entry, registers outbox events. Status -> `posted`. |
| `POST` | `api/PayrollRuns/{id}/reverse` | `ReversePayrollRun` | `RequireMasterAccountant` | Body is raw JSON string reason. Status -> `reversed`. |

### DTOs

#### CreatePayrollRunRequest
- `PayrollPeriodId`: long (required)

#### PayrollRunResponse
- `Id`: long
- `PayrollPeriodId`: long
- `Status`: string (`draft`, `calculated`, `approved`, `posted`, `reversed`, `rejected`)
- `CreatedBy`: long
- `CreatedAt`: DateTime
- `ApprovedBy`: long?
- `ApprovedAt`: DateTime?
- `PostedJournalEntryId`: long?
- `Period`: PayrollPeriodResponse?
- `RowVersion`: byte[]

#### PayrollRunEmployeeResponse
- `Id`: long
- `StaffId`: long
- `StaffName`: string
- `BasicSalary`: decimal
- `HousingAllowance`: decimal
- `TransportAllowance`: decimal
- `GrossEarnings`: decimal
- `TotalDeductions`: decimal
- `NetSalary`: decimal
- `IsPaid`: bool
- `PaidAmount`: decimal
- `Notes`: string?
- `Components`: list of `PayrollRunEmployeeComponentResponse`

---

## 7. Payroll Adjustments (`api/PayrollAdjustments`)

Manages earnings or deductions adjustments for employees.

### Endpoints

| HTTP Method | Route | Controller Action | Policy |
| :--- | :--- | :--- | :--- |
| `GET` | `api/PayrollAdjustments` | `GetAdjustments` | Authorized |
| `GET` | `api/PayrollAdjustments/{id}` | `GetAdjustmentById` | Authorized |
| `GET` | `api/PayrollAdjustments/staff/{staffId}` | `GetStaffAdjustments` | Authorized |
| `GET` | `api/PayrollAdjustments/staff/{staffId}/unapplied` | `GetStaffUnappliedAdjustments` | Authorized |
| `POST` | `api/PayrollAdjustments` | `CreateAdjustment` | Authorized |
| `PUT` | `api/PayrollAdjustments/{id}` | `UpdateAdjustment` | Authorized |
| `POST` | `api/PayrollAdjustments/{id}/approve` | `ApproveAdjustment` | `RequireMasterAccountant` |
| `POST` | `api/PayrollAdjustments/{id}/reject` | `RejectAdjustment` | `RequireMasterAccountant` |

### DTOs

#### CreatePayrollAdjustmentRequest
- `StaffId`: long
- `PayrollPeriodId`: long
- `SalaryComponentId`: long
- `Amount`: decimal
- `Type`: string (`Earning` or `Deduction`)
- `Reason`: string

#### PayrollAdjustmentResponse
- `Id`: long
- `StaffId`: long
- `PayrollPeriodId`: long
- `SalaryComponentId`: long
- `Amount`: decimal
- `Type`: string
- `Reason`: string
- `Status`: string (`pending`, `approved`, `rejected`)

---

## 8. Staff Compensation & Financial Profiles (`api/StaffCompensationProfiles` & `api/SalaryComponents`)

Maintains custom financial allocations and configurations for employees.

### Endpoints

| HTTP Method | Route | Controller Action | Policy |
| :--- | :--- | :--- | :--- |
| `POST` | `api/StaffCompensationProfiles` | `CreateProfile` | `RequireMasterAccountant` |
| `GET` | `api/StaffCompensationProfiles/staff/{staffId}` | `GetActiveProfile` | Authorized |
| `GET` | `api/SalaryComponents` | `GetComponents` | Authorized |
| `GET` | `api/SalaryComponents/{id}` | `GetComponentById` | Authorized |
| `POST` | `api/SalaryComponents` | `CreateComponent` | `RequireMasterAccountant` |
| `PUT` | `api/SalaryComponents/{id}` | `UpdateComponent` | `RequireMasterAccountant` |
| `POST` | `api/SalaryComponents/{id}/activate` | `ActivateComponent` | `RequireMasterAccountant` |
| `POST` | `api/SalaryComponents/{id}/deactivate` | `DeactivateComponent` | `RequireMasterAccountant` |

---

## 9. Salary Disbursements (`api/SalaryPayments`)

Tracks disbursement of salary amounts.

### Endpoints

| HTTP Method | Route | Controller Action | Policy |
| :--- | :--- | :--- | :--- |
| `GET` | `api/SalaryPayments` | `GetSalaryPayments` | Authorized |
| `GET` | `api/SalaryPayments/{id}` | `GetSalaryPaymentById` | Authorized |
| `GET` | `api/SalaryPayments/staff/{staffId}` | `GetEmployeePaymentHistory` | Authorized |
| `POST` | `api/SalaryPayments/run/{runId}` | `PayPayrollRun` | `RequireMasterAccountant` |
| `GET` | `api/SalaryPayments/reversals` | `GetReversals` | Authorized |
| `GET` | `api/SalaryPayments/reversals/{id}` | `GetReversalById` | Authorized |

---

## 10. Staff Financial Sub-Elements (Advances, Loans, Reimbursements, Commissions, Incentives)

These controllers store outstanding loans, advances, or commissions.

### Endpoints

- `StaffAdvancesController` (`api/StaffAdvances`): `RequestAdvance`, `DisburseAdvance`, `GetAdvanceById`, `GetStaffAdvances`
- `StaffLoansController` (`api/StaffLoans`): `RequestLoan`, `DisburseLoan`, `GetLoanById`, `GetStaffLoans`
- `StaffReimbursementsController` (`api/StaffReimbursements`): `SubmitReimbursement`, `ApproveReimbursement`, `RejectReimbursement`, `PayReimbursementIndependent`
- `CommissionsController` (`api/Commissions`): `CreateCommission`, `GetStaffUnappliedCommissions`
- `IncentivesController` (`api/Incentives`): `CreateIncentive`, `GetStaffUnappliedIncentives`

---

## 11. Reports & Reconciliation (`api/PayrollReports` & `api/PayrollReconciliation`)

Generates payslips, register history, and tracks variance between runs and general ledger.

- `api/PayrollReports/summary`: `GetSummaryReport`
- `api/PayrollReports/register`: `GetRegisterReport`
- `api/PayrollReports/payslip/staff/{staffId}/period/{periodId}`: `GetEmployeePayslip`
- `api/PayrollReconciliation/summary`: `GetReconciliationSummary`
- `api/PayrollReconciliation/discrepancies`: `GetDiscrepancies`
