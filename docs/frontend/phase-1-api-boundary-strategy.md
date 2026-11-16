# Phase 1 API Boundary Strategy

This document governs backend network communications, correlation mapping, and error handling.

## Rules for Backend Communication

1. **Centralized Client Execution**:
    - Every fetch request to `/api/*` must pass through the `apiFetch` client in `$lib/api/api-client`. Direct fetch calls inside components or page handlers are forbidden.

2. **Rfc-7807 Exception Mapping**:
    - The API Client must intercept non-2xx status codes and call the `parseProblemDetails` parser.
    - Standard runtime errors will be translated into typed classes (`ValidationError`, `AuthenticationError`, etc.) before being thrown, permitting components to reactively display targeted feedback.

3. **Telemetry & Tracking**:
    - Every outbound request automatically receives a unique `X-Correlation-ID` header.
    - This identifier is logged by the observability system and allows tracking errors from the browser back to backend audit logs.

4. **Concurrent Token Refresh**:
    - When a 401 error occurs, the client queues subsequent requests and initiates a single `/api/auth/refresh` request.
    - If the refresh succeeds, all queued requests are retried with the new token.
    - If the refresh fails, the client clears session state and redirects to the login screen.
