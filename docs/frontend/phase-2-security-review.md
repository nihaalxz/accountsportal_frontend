# Phase 2 Security Review

This document audits the client-side security policies implemented in the Phase 2 accounts portal modules.

## Security Control Mechanisms

### 1. Zero Sensitive Data in LocalStorage

- No ledger balances, account numbers, transactions DTOs, or other financial records are cached in `localStorage` or `sessionStorage`. All financial queries are re-fetched from the authoritative API server.
- User identity metrics in the auth store (e.g. name, userType, permissions list) are held purely in-memory.

### 2. Token Security

- **Access Token**: Held in-memory only. Not exposed to persistent browser storage.
- **Refresh Token**: Stored in a secure cookie with strict flag configurations:
    - `SameSite=Strict`: Restricts cookie transfer to first-party requests only, preventing Cross-Site Request Forgery (CSRF).
    - `Expires`: Set to 7 days to support reasonable session restoration windows.

### 3. URL Parameter Sanitization

- All synchronized query params (e.g. status, type, referenceType) are deserialized through an allowlist validator (`parseTransactionFilters` in `src/lib/utils/query-params.ts`).
- Any arbitrary strings or malicious injection scripts in URL search queries are discarded and normalized to null defaults on load.

### 4. Account Number Masking

- Bank account numbers are partially masked (`maskAccountNumber` in `banks/+page.svelte`) on listing and details screens, leaving only the last 4 digits visible to prevent unauthorized exposure.
