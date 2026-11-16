# Phase 4 Architecture Rules Compliance Review

This document audits the implementation of Phase 4 modules against the Texas Accounts Portal frontend architectural rules.

---

## 1. Centralized API Client Adherence
- **Rule**: Direct calls to `window.fetch` or third-party HTTP clients are strictly forbidden in route page views or component logic.
- **Audit**: All Phase 4 pages (under `/payroll` and `/suppliers`) consume API endpoints exclusively through the custom submodules:
  - `src/features/staff/api.ts`
  - `src/features/payroll/api.ts`
  - `src/features/suppliers/api.ts`
- **Verification**: Ripgrep validation checks confirmed zero raw fetch occurrences in Svelte views.

---

## 2. No Direct Data Access Outside of Stores / API Clients
- **Rule**: Authentication status, JWT retrieval, and current user permissions must be processed through the centralized stores (`src/lib/stores/auth.ts`).
- **Audit**: Role-gated features query permissions using `hasRole('master_accountant')` from `$lib/stores/auth`, keeping security assertions uniform across routes.

---

## 3. Strict Contract Alignments
- **Rule**: Frontend contracts must map 1:1 with ASP.NET Core Web API controller requests and response DTO schemas.
- **Audit**: Types in `types.ts` correspond directly to C# definitions in the backend contract assemblies, ensuring parameter payload integrity.
