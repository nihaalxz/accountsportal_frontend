# Phase 4 API Coverage Matrix

This matrix maps backend capabilities to frontend pages, modules, permission guards, idempotency configurations, and E2E coverage.

| Backend Endpoint | Frontend Module | Route / Page | Classification | Description & Gap Justification |
| :--- | :--- | :--- | :--- | :--- |
| **Staff Registry Queries** | — | `/payroll/staff` | **BLOCKED BY CONTRACT GAP** | The backend `StaffProfile` entity is not exposed via any query or listing endpoints. There is no `GET api/Staff` or `GET api/StaffProfiles`. We must block/defer displaying the staff list dynamically, or fall back to displaying employees via the active payroll period registers or showing dummy lists if required. For active operations, we block direct listing since the endpoint doesn't exist. |
| `POST api/public/staff/sync` | `staff` | — | **BACKEND-ONLY** | Internal service synchronization endpoint. Accessed only by the Sales Portal. |
| `GET api/StaffCompensationProfiles/staff/{staffId}` | `staff` | `/payroll/staff/[id]/financial-profile` | **IMPLEMENT NOW** | Fetch active compensation profile for staff. |
| `POST api/StaffCompensationProfiles` | `staff` | `/payroll/staff/[id]/financial-profile` | **IMPLEMENT NOW** | Configure basic salary and allowances. Restricted to Master Accountant. |
| `GET api/PayrollPeriods` | `payroll` | `/payroll` | **IMPLEMENT NOW** | List all payroll periods. |
| `POST api/PayrollPeriods` | `payroll` | `/payroll` | **IMPLEMENT NOW** | Create new payroll period. Restricted to Master Accountant. |
| `POST api/PayrollPeriods/{id}/close` | `payroll` | `/payroll` | **IMPLEMENT NOW** | Close a payroll period. Restricted to Master Accountant. |
| `GET api/PayrollRuns` | `payroll` | `/payroll/runs` | **IMPLEMENT NOW** | List all payroll runs. |
| `GET api/PayrollRuns/{id}` | `payroll` | `/payroll/runs/[id]` | **IMPLEMENT NOW** | Detail page of a payroll run. |
| `GET api/PayrollRuns/{id}/employees` | `payroll` | `/payroll/runs/[id]` | **IMPLEMENT NOW** | List employee line items for a payroll run. |
| `POST api/PayrollRuns` | `payroll` | `/payroll/runs` | **IMPLEMENT NOW** | Generate a payroll run. Requires `Idempotency-Key` or confirmation. |
| `POST api/PayrollRuns/{id}/calculate` | `payroll` | `/payroll/runs/[id]` | **IMPLEMENT NOW** | Calculate payroll totals. Restricted to Master Accountant. |
| `POST api/PayrollRuns/{id}/recalculate` | `payroll` | `/payroll/runs/[id]` | **IMPLEMENT NOW** | Recalculate draft run. |
| `POST api/PayrollRuns/{id}/approve` | `payroll` | `/payroll/runs/[id]` | **IMPLEMENT NOW** | Approve payroll run. Restricted to Master Accountant. |
| `POST api/PayrollRuns/{id}/post-gl` | `payroll` | `/payroll/runs/[id]` | **IMPLEMENT NOW** | Post payroll run to General Ledger. |
| `POST api/PayrollRuns/{id}/reverse` | `payroll` | `/payroll/runs/[id]` | **IMPLEMENT NOW** | Reverse posted payroll run. Requires reversal reason. |
| `GET api/SalaryPayments` | `payroll` | `/payroll/payments` | **IMPLEMENT NOW** | List salary payments. |
| `POST api/SalaryPayments/run/{runId}` | `payroll` | `/payroll/payments/pay/[runId]` | **IMPLEMENT NOW** | Post payment execution for a payroll run. Restricted to Master Accountant. |
| `GET api/PayrollAdjustments` | `payroll` | `/payroll/adjustments` | **IMPLEMENT NOW** | List all adjustments. |
| `POST api/PayrollAdjustments` | `payroll` | `/payroll/adjustments/new` | **IMPLEMENT NOW** | Request/create allowance or deduction adjustments. |
| `POST api/PayrollAdjustments/{id}/approve` | `payroll` | `/payroll/adjustments` | **IMPLEMENT NOW** | Approve adjustment. Restricted to Master Accountant. |
| `POST api/PayrollAdjustments/{id}/reject` | `payroll` | `/payroll/adjustments` | **IMPLEMENT NOW** | Reject adjustment. |
| `GET api/Supplier` | `suppliers` | `/suppliers` | **IMPLEMENT NOW** | List suppliers and wallets. |
| `POST api/Supplier` | `suppliers` | `/suppliers` | **IMPLEMENT NOW** | Create new supplier. Restricted to Master Accountant. |
| `PUT api/Supplier/{id}` | `suppliers` | `/suppliers` | **IMPLEMENT NOW** | Update supplier. Restricted to Master Accountant. |
| `POST api/supplier-payments` | `suppliers` | `/suppliers/[id]` | **IMPLEMENT NOW** | Create a supplier payment transaction. Requires `Idempotency-Key`. |
| `POST api/supplier-payments/{id}/approve` | `suppliers` | `/suppliers` | **IMPLEMENT NOW** | Approve supplier payment. |
| `POST api/supplier-payments/{id}/reject` | `suppliers` | `/suppliers` | **IMPLEMENT NOW** | Reject supplier payment. Requires rejection reason. |
| `GET api/reconciliation/supplier-statement/{supplierId}` | `suppliers` | `/suppliers/[id]/statement` | **IMPLEMENT NOW** | Display supplier transaction statement history. |
| `GET api/reconciliation/gl-reconciliation` | `reconciliation` | `/reconciliation` | **IMPLEMENT NOW** | Show discrepancies, missing journals, unbalanced items. |
| `GET api/PayrollReconciliation/summary` | `reconciliation` | `/reconciliation` | **IMPLEMENT NOW** | Payroll run GL discrepancies and variance analysis. |
| **Outbox / Integration Messages** | — | — | **BLOCKED BY CONTRACT GAP** | No endpoints expose the `OutboxMessage` table. Safely hidden on backend for system access only. |
