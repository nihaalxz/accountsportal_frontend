# Phase 3 Architecture Enforcement Rules

## Code Rules & Lint Standards

### 1. Unified API Client

- **Rule**: Do not perform raw `fetch()` calls in route files or components. All server communications must route through the centralized `apiFetch` in `$lib/api/api-client`.
- **Enforcement**: Monitored by ESLint checks and codebase audits.

### 2. Business Logic Boundaries

- **Rule**: Business domain calculations (like balance checks, posted journal entry matching, discrepancies) are computed by backend models. The client performs pre-validations only to improve user feedback.
- **Enforcement**: Evaluated during code reviews.

### 3. Role-Based Access Control Gating

- **Rule**: Administrative buttons, deletions, reversals, or adjustments must check user authorization permissions (`hasRole`). Direct API access is secured at backend controller filters.
- **Enforcement**: Checked on page routing and element presence guards.

### 4. Correlation & Idempotency Propagation

- **Rule**: Financial writes (Expense creation, Journal Entry creation) must propagate unique correlation identifiers (`X-Correlation-ID`) auto-injected by the apiFetch client.
- **Enforcement**: Tested in playwright E2E sweeps.
