# Phase 1 API Client Strategy

This document governs the API client design, interceptors, and request lifecycles.

## Core Capabilities

1. **Centralized Boundary**:
    - `apiFetch` serves as the single gatekeeper for backend queries.
    - It references the validated `BACKEND_API_URL` dynamically configured in the environment.

2. **JWT Lifecycle & Storage Rules**:
    - The short-lived **Access Token** is kept strictly in local memory.
    - The longer-lived **Refresh Token** is stored in a secure SameSite=Strict cookie.
    - When a request responds with `401 Unauthorized`, the client suspends outgoing requests, reads the cookie, and submits a rotation request to `/api/auth/refresh`. On success, the rotated cookie is stored, and execution resumes.

3. **Telemetry & Tracing**:
    - Outbound requests automatically receive a UUID-v4 correlation header (`X-Correlation-ID`).
    - Telemetry trace IDs are propagated back in exceptions to assist debugging.

4. **Reliability Guardrails**:
    - Timeout thresholds default to **15 seconds** to fail fast when backend servers are unresponsive.
    - Financial POST/PUT writes do not support automated retries to avoid duplicating transactions.
