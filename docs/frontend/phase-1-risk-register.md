# Phase 1 Risk Register

This document registers potential risks and mitigation plans for the frontend foundation setup.

| Risk ID | Risk Description                            | Severity | Mitigation Plan                                                                                                                                                      |
| ------- | ------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1      | Unsecured Token Storage (XSS vulnerability) | High     | Store JWT Access Tokens strictly in memory. Store refresh tokens in a cookie configured with `SameSite=Strict; Secure`.                                              |
| R2      | CSRF on Token Refresh / Operations          | Medium   | Leverage CORS controls on backend. Ensure same-site attributes on cookies are strictly configured.                                                                   |
| R3      | Concurrent Refresh Storms                   | Medium   | Implement refresh queueing in the API client; multiple concurrent 401s should block behind a single active `/api/auth/refresh` request.                              |
| R4      | Hydration Mismatches                        | Medium   | Ensure no browser-only API references (like `document`, `window`, `localStorage`) are parsed during SSR execution. Use Svelte's `browser` environment guard.         |
| R5      | Yellow Color Accessibility (Contrast rules) | Medium   | Avoid neon yellow backgrounds. Use dark foreground colors (`#1a1503` or similar deep amber-grays) on yellow elements to comply with WCAG AA/AAA contrast guidelines. |
