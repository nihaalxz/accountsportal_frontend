# Phase 2 E2E Database Safety Strategy

To guarantee that E2E tests do not run against, alter, or access Production databases/servers, we enforce strict multi-layered automated checks.

## Safety Invariants

1. **Host Prohibitions**:
    - The database host DataSource string must not contain `prod`, `live`, `azure`, `rds`, or `production`.
    - The API Base URL must be a local server address (e.g., `localhost` or `127.0.0.1`).
2. **Database Catalog Name Verification**:
    - The database name catalog must explicitly contain a development or test marker (`Dev` or `Test`).
3. **Environment Boundary**:
    - The backend `ASPNETCORE_ENVIRONMENT` must be explicitly verified to be `Development` (and **NOT** `Production` or `Staging`).

## Automated Check Implementation

We configure an automated safety test file at **`tests/real-backend/safety.spec.ts`** that executes before any other real-backend tests. This safety test:

1. Queries the frontend configuration and verifies `BACKEND_API_URL` points to `localhost`.
2. Makes a baseline health call to `http://localhost:5028/` or `health/ready` if available.
3. Performs a login step to check that the seeded `admin@texas.com` development user is active.
4. Validates that the backend environment and test databases are localized.
