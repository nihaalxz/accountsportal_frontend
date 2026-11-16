# Concurrency and Idempotency Contract

This document registers safety contracts for data modification operations in the Accounts Portal.

## 1. Idempotency Key Headers

All POST/PUT financial and sync operations that perform mutative actions (like creating postings, salary payments, or syncs) must carry an `Idempotency-Key` header.

- **Header Name**: `Idempotency-Key`
- **Format**: GUID (UUID v4)
- **Error Behavior**: If an action is retried with the same `Idempotency-Key` but a different payload, the backend returns `409 Conflict`. If the request succeeds previously, the backend returns the cached success response.

## 2. Optimistic Concurrency Controls

Endpoints that update financial entities (such as approving/rejecting postings) require a concurrency check to prevent overwriting updates.

- **Mechanism**: RowVersion byte array token.
- **Request Payload Field**: `rowVersion` (Base64 encoded string).
- **Error Behavior**: If the `rowVersion` does not match the current database value, the backend throws a `DbUpdateConcurrencyException`, mapping to `409 Conflict` via `GlobalExceptionHandler`.
