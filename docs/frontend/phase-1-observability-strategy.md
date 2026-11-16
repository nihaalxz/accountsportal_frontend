# Phase 1 Observability Strategy

This document governs client telemetry collection, trace reporting, and data privacy limits.

## Telemetry Boundaries

1. **Centralized Logger Wrapper**:
    - Application components must not call `console.log` or `console.error` directly.
    - All diagnostic logs use the unified logging boundary in `$lib/utils/logger`.

2. **Error Report Payload**:
    - Captured logs include:
        - Log severity (Info, Warning, Error, Fatal).
        - Active route path.
        - Correlation ID and Server Trace ID (when mapped from `ApiError`).
        - App build version and target environment.

3. **Strict Data Masking Rules**:
    - To protect sensitive information, the following data must **never** be logged:
        - User passwords or pin codes.
        - Authentication Access or Refresh tokens.
        - Complete financial payloads (such as supplier payment cards, ledger journals, or bank credentials).
        - Personally Identifiable Information (PII) beyond user ID.
