# Phase 2 Data Flow Strategy

This document details the unidirectional data flow pattern enforced across all Phase 2 financial modules.

## Unidirectional Data Flow

The portal enforces a clean, unidirectional data cycle to prevent UI de-synchronization:

```
                  ┌──────────────────────────────┐
                  │ URL Search Query Parameters  │
                  └──────────────┬───────────────┘
                                 │
                                 ▼ (parseTransactionFilters)
                  ┌──────────────────────────────┐
                  │ Reactive Page Store ($state) │
                  └──────────────┬───────────────┘
                                 │
                                 ▼ (API Fetch Trigger)
                  ┌──────────────────────────────┐
                  │ Backend Database Posting     │
                  └──────────────┬───────────────┘
                                 │
                                 ▼ (Server Confirmed Refresh)
                  ┌──────────────────────────────┐
                  │ State Updates & UI Rendered  │
                  └──────────────────────────────┘
```

1.  **State Source of Truth**: The browser's active URL parameters (e.g. `?status=pending&page=2`) serve as the single source of truth for list filtering.
2.  **Trigger-Driven Loading**: Changing a dropdown filter or navigation link updates the URL parameters via SvelteKit's `goto()`. Svelte's reactive `$effect()` watches for page url changes, immediately fetching a clean dataset from the backend API.
3.  **No Local State Cache**: Once a write operation is confirmed by the backend, the screen calls reload hooks to sync the reactive UI directly from the API response instead of projecting locally calculated results.
