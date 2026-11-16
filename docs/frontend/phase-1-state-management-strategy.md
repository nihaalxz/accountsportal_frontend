# Phase 1 State Management Strategy

This document details the state lifecycle, reactive store design, and state ownership guidelines.

## Principles

1. **Leverage Svelte Store API**:
    - Use standard Svelte stores (`writable`, `derived`, `readonly`) for shared application cross-cutting state (e.g. auth context, navigation active route, active theme).
    - This matches the patterns used in operational and sales portals in the workspace.

2. **Single Source of Truth**:
    - The auth store (`$lib/stores/auth.ts`) owns the authenticated status, user DTO, and initialization state.
    - Page and layout views subscribe to these values and do not modify them directly.

3. **Memory Isolation**:
    - The JWT Access Token is kept strictly in-memory (an internal module variable inside `api-client.ts`). It is never stored in `localStorage` or `sessionStorage` to mitigate cross-site scripting (XSS) extraction risks.
    - The secure session restoration token (refresh token) is written to a client-side SameSite cookie.

4. **Component Local State**:
    - Standard UI components (collapsible elements, interactive tabs, confirmation dialog visibility) manage state locally using standard Svelte props/variables.
