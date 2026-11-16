# Phase 1 Environment Strategy

This document governs environment settings, production checks, and configuration rules.

## Strategy & Principles

1. **Strict Public vs Private Isolation**:
    - Only non-sensitive parameters (such as public API routes like `PUBLIC_BACKEND_API_URL`) may be exposed as public environment variables.
    - Access keys, service tokens, client secrets, and database credentials must never be prefixed with `PUBLIC_` or compiled into the client bundle.

2. **Production Fallback Protection**:
    - Falling back to `localhost` parameters in production environments is forbidden.
    - If the application is compiled or booted in non-development modes (`!dev`) and `PUBLIC_BACKEND_API_URL` is omitted, the configuration manager throws a fatal error on startup to prevent silent integration misdirection.

3. **Active URL Validation**:
    - The configuration manager instantiates a `URL` validator on boot.
    - If the configured path does not form a valid HTTP/HTTPS absolute address, it throws a startup failure.

4. **Variables Mappings**:
    - `PUBLIC_BACKEND_API_URL`: Targets the backend C# API server.
        - Local Dev Default: `http://localhost:5028`
        - Production/Staging: Must be explicitly configured (e.g. `https://api.accounts.texasportals.com`).
