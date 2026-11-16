# Phase 4 Security Review

This document audits security mechanisms, role-based access control (RBAC), and transactional invariants implemented in Phase 4.

---

## 1. Authentication & Session Security
- **JWT tokens propagation**: All requests are dispatched using the centralized `apiFetch` client which attaches bearer tokens in the authorization header and handles automated token refreshes.
- **Session expiration**: Automatic redirection blocks page rendering if authentication is revoked or session validity expires.

---

## 2. Role-Based Access Control (RBAC)
- **Role Guards**: Frontend layouts query `hasRole('master_accountant')` or permission helpers before showing action links or submitting forms.
- **Backend Enforced**: All write endpoints (Create Supplier, Post Payment, Recalculate Run, Close Period) verify role permissions on the backend API layer.

---

## 3. Transaction Safety & Invariants
- **Idempotency keys**: Supplier payment requests append a randomly generated `Idempotency-Key` UUID. This prevents dual execution of payments in case of duplicate submissions.
- **State Transition Validations**: Payroll processing buttons are visible only in valid states (e.g. Calculate only in `draft`, Post GL only in `approved`, Reverse only in `posted`).
