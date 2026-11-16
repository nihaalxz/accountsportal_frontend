# Authorization Contract

This document inventories the roles, policies, and claim rules mapping to frontend views.

## Roles

The Accounts Portal defines the following key roles in `UserType` parameters:

- `master_accountant` (or `Master Accountant` case-insensitively): Super-user role with complete override access to financial, salary, and policy endpoints.
- `Accounts` (or `accountant`, `Normal Accountant` case-insensitively): Standard accounting user who can register postings, process returns, view statements, and prepare reconciliation reports.

## Policies & Claims Mapping

The backend maps specific `ClaimsIdentity` parameters to policies in `Program.cs`:

1. **RequireMasterAccountant Policy**
    - **Backend Claim Rule**: `policy.RequireRole("master_accountant", "Master Accountant")`
    - **Allowed Actions**: Approval or Rejection of postings/transactions, processing staff salary payments, creating staff loans and advances, managing adjustments and payroll runs.
    - **Frontend Action**: Controls visual triggers for approval paths and master administration settings.

2. **RequireAccountant Policy**
    - **Backend Claim Rule**: `policy.RequireRole("Accounts", "accountant", "Normal Accountant", "master_accountant", "Master Accountant")`
    - **Allowed Actions**: Reading dashboards, creating transactions/postings, reading chart of accounts, submitting journals, requesting reconciliation tasks.
    - **Frontend Action**: Standard portal layout view privileges.

3. **AccountsInternalApiAccess Policy**
    - **Backend Claim Rule**: Guarded by `InternalServiceAuth` credentials.
    - **Allowed Actions**: Cross-portal service synchronization (e.g. staff profile syncing).
    - **Frontend Action**: **N/A** (Service-to-service call only, no user session role).
