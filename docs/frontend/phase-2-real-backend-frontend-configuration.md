# Phase 2 Real Backend Frontend Configuration

This document registers the configuration details of the frontend Svelte application targeting the local backend.

## API Connection Settings

- **Configured base URL**: `http://localhost:5028` (explicitly declared in `.env.development`)
- **Resolution Source**: `src/lib/config/index.ts` reads `PUBLIC_BACKEND_API_URL` dynamically from the environment.
- **Credentials Mode**: The frontend calls use the standard Fetch API. Cookies and tokens are handled securely without local disk persistence to guard against XSS vulnerabilities.

## Mock Interception Isolation

- Mocking is isolated entirely inside the **`mocked`** Playwright project using local `page.route` interception on a per-test basis.
- No service workers or global fetch interception wrappers are present in production-destined code.
- The **`real-backend`** test suite sends request payloads directly to `http://localhost:5028`.
