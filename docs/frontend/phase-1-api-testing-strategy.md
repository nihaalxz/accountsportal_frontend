# Phase 1 API Testing Strategy

This document governs backend network mock verifications and API integration tests.

## Mock Boundaries

1. **Global Fetch Interception**:
    - Instead of writing network mocks on an ad-hoc basis within components, we mock fetch via Vitest `vi.stubGlobal('fetch')`.
    - This isolates our tests from real network parameters and enables fast, deterministic assertions.

2. **Integration Verification Scopes**:
    - **Successful JSON responses**: Returns typed objects (e.g. `LoginResponse` DTO).
    - **204 No Content**: Correctly resolves to `null` values.
    - **Validation payload errors (400 / 422)**: Confirms the parser throws a `ValidationError` with field message lists.
    - **Concurrency collisions (409)**: Confirms the parser throws a `ConcurrencyConflictError` with message overrides.
    - **Authentication/Authorization failure (401 / 403)**: Confirms throws `AuthenticationError` / `AuthorizationError`.
    - **Gateway downtime (503 / 504)**: Confirms throws `DownstreamUnavailableError` / `TimeoutError`.
