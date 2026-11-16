# Phase 3 Permission Gating Matrix

## RBAC Verification

The table below specifies access policies for each frontend route and backend controller.

| Feature Area                 | Route / Action             | Accountant Role | Master Accountant Role | Backend Policy Enforcement |
| ---------------------------- | -------------------------- | --------------- | ---------------------- | -------------------------- |
| **Chart of Accounts**        | List / Detail View         | ALLOW           | ALLOW                  | `RequireAccountant`        |
|                              | Create / Edit Account      | DENY            | ALLOW                  | `RequireMasterAccountant`  |
|                              | Seed System Accounts       | DENY            | ALLOW                  | `RequireMasterAccountant`  |
| **Accounting Periods**       | List / Detail View         | ALLOW           | ALLOW                  | `RequireAccountant`        |
|                              | Close Period               | DENY            | ALLOW                  | `RequireMasterAccountant`  |
|                              | Reopen Period              | DENY            | ALLOW                  | `RequireMasterAccountant`  |
| **Expense Claims**           | List / Detail View         | ALLOW           | ALLOW                  | `RequireAccountant`        |
|                              | Create Claim               | ALLOW           | ALLOW                  | `RequireAccountant`        |
|                              | Submit / Cancel Claim      | ALLOW           | ALLOW                  | `RequireAccountant`        |
|                              | Approve / Reject Claim     | DENY            | ALLOW                  | `RequireMasterAccountant`  |
| **Journal Entries**          | List / Detail View         | ALLOW           | ALLOW                  | `RequireAccountant`        |
|                              | Create Draft               | ALLOW           | ALLOW                  | `RequireAccountant`        |
|                              | Submit / Post Entry        | ALLOW           | ALLOW                  | `RequireAccountant`        |
|                              | Approve / Reject / Reverse | DENY            | ALLOW                  | `RequireMasterAccountant`  |
| **General Ledger / Reports** | View / Query               | ALLOW           | ALLOW                  | `RequireAccountant`        |
| **Reconciliation**           | View / Run Sweep           | ALLOW           | ALLOW                  | `RequireAccountant`        |
