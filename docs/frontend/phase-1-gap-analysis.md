# Phase 1 E2E Gap Analysis

## Overview

This document outlines any gaps or vulnerabilities discovered while auditing and stabilizing the Phase 1 test coverage suite.

## Findings

### 1. Test Context Contamination

- **Issue**: In the initial test runs, Playwright contexts sometimes reused persistent state or cookies from previous sessions. This caused `bootstrapSession` to attempt to query `/api/auth/refresh` with stale tokens, making the auth initialization spinner hang indefinitely.
- **Resolution**: Implemented explicit `test.use({ storageState: { cookies: [], origins: [] } })` or clear context configurations in mock test suites to guarantee a fully clean context for every individual test run.

### 2. Svelte 5 Auth Bootstrap Timing Races

- **Issue**: Svelte 5 uses reactive `$effect` and `onMount` execution blocks. Because SvelteKit client-side hydration happens asynchronously, the redirect checks often fire a few ticks after navigation begins.
- **Resolution**: Updated Playwright assertions to utilize `page.waitForURL` with generous timeouts (10 seconds) instead of checking `expect(page).toHaveURL()` immediately. This accommodates the async hydration cycle cleanly.

### 3. Server Cold Starts

- **Issue**: During cold starts of the Vite dev server, the first E2E test execution block often times out or fails with `net::ERR_ABORTED` because the server is not fully accepting requests yet.
- **Resolution**: Increased the `webServer.timeout` config parameter in `playwright.config.ts` from 30 seconds to 60 seconds and configured a retry count of 1.

## Recommendations

- Ensure that any test using standard routes mocks all possible endpoints that might be fetched during hydration (specifically `/api/auth/refresh` and `/api/auth/me`).
- Always use clean storage state contexts for unauthenticated redirect testing to prevent cookies from bleeding into the test profile.
