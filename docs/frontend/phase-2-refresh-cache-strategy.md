# Phase 2 Refresh & Cache Strategy

This document details the cache control and data refresh strategy implemented in Phase 2 financial modules.

## Refresh Mechanics

To balance performance with real-time financial reporting correctness, the portal utilizes the following refresh patterns:

### 1. Manual Refresh Triggers

- Every list view (e.g. Transactions, Cash Accounts, Banks) and details sheet includes a prominent "Refresh" button (equipped with spinning loading feedback).
- This triggers manual re-fetches to sync local browser states with the server, avoiding aggressive background polling.

### 2. Post-Write Refresh (Event-driven)

- Whenever a financial write operation successfully completes (e.g. approving a transaction, applying a balance correction, updating an account's metadata):
    1.  The dialog/form is closed.
    2.  A success toast notification is dispatched.
    3.  The parent view calls its reload logic to refresh state (re-fetching the latest balance or updating status flags immediately).

### 3. Zero Cache Policy

- All requests to `/api/reconciliation/summary`, `/api/transaction`, `/api/account`, and `/api/bank` are made dynamically with zero frontend caching.
- Browser client side session states do not cache balances in memory across route changes. Navigating to a page always triggers a fresh API fetch.
