# Phase 1 End-to-End Testing Strategy

This document governs browser automated test scenarios using Playwright.

## Test Projects

1. **Mocked Project (`tests/mocked/`)**:
    - Uses Playwright's `page.route` to mock backend API payloads.
    - Tests form layout validation, redirect triggers, and Sidebar link structures.
    - Command: `npx playwright test --project=mocked`

2. **Real Backend Project (`tests/real-backend/`)**:
    - Direct connection from the browser to the running C# API.
    - Requires the local backend to be running on `http://localhost:5028`.
    - Command: `npx playwright test --project=real-backend`

## Key E2E Test Cases

- **Authentication Redirects**:
    - Visiting a protected route (like `/dashboard`) when logged out should redirect to `/login?returnTo=%2Fdashboard`.
    - Logging in successfully should redirect to `/dashboard`.
- **Session Restoration**:
    - Closing the browser and returning should retain the active login via the secure rotated refresh cookie.
- **Role Permissions UI**:
    - Verify that standard `Accounts` users do not see the "Administration" sidebar element or submenu options.
- **Error Boundaries**:
    - Accessing non-existing routes should render the custom Svelte global 404 page context.
