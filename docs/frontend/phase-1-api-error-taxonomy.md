# Phase 1 API Error Taxonomy

This document maps backend HTTP status codes to client exception classes.

## Exception Tree

- `Error` (Base browser type)
    - `NetworkError` (Thrown on network disconnection, timeout, or DNS failure)
    - `ApiError` (Standard RFC-7807 wrapper containing status, title, detail, instance, traceId)
        - `ValidationError` (Contains dictionary of field-level invalid mappings, status 400/422)
        - `AuthenticationError` (Missing or invalid session credentials, status 401)
        - `AuthorizationError` (Insufficient user roles or permissions, status 403)
        - `NotFoundError` (Resource does not exist in DB, status 404)
        - `ConflictError` (Resource locked or write conflict, status 409)
            - `ConcurrencyConflictError` (Entity rowVersion mismatch or outdated, status 409)
        - `RateLimitError` (API request rate limit exceeded, status 429)
        - `DownstreamUnavailableError` (Server or dependent database down, status 502/503)
        - `TimeoutError` (Server failed to reply within target, status 504)
        - `UnknownApiError` (Unmapped non-2xx status, e.g. status 500)

## Security Guidelines

- Raw Exception messages and stack traces from the C# backend are masked under a standard `"An unexpected error occurred. Please contact system support."` detail block before reaching user-facing widgets to avoid data leaks.
