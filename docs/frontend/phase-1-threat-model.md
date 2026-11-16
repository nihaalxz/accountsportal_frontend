# Phase 1 Threat Model

This document maps frontend vulnerabilities, threat vectors, and active mitigation controls.

## Threat Mapping & Mitigations

| Threat                                | Target             | Mitigation Control                                                                                                                                                                                  |
| :------------------------------------ | :----------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **XSS (Cross-Site Scripting)**        | Access Token theft | In-memory token store storage. Access tokens are never committed to `localStorage` or `sessionStorage` which is accessible to malicious scripts. Svelte 5 automatically context-escapes text nodes. |
| **CSRF (Cross-Site Request Forgery)** | Session hijacking  | Cookie parameters default to `SameSite=Strict` and `Secure`. Read/Write actions require Bearer token authorization headers, which browsers do not auto-inject on cross-site form posts.             |
| **Data Leakage in telemetry**         | Log exposures      | The logging boundary (`logger.ts`) recursively audits log context parameters, replacing sensitive fields (like passwords, keys, tokens) with `[MASKED]`.                                            |
| **Silent Session Takeovers**          | Cookie hijacking   | Refresh tokens have short lifetimes (7 days), and undergo rotation on every validation cycle. Failed refreshes immediately purge the client-side session store.                                     |
| **Duplicate submissions**             | Double postings    | Button components display inline spinners and transition to a disabled state during active API operations. Write operations support idempotency tracking.                                           |
