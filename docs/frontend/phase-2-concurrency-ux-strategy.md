# Phase 2 Concurrency UX Strategy

This document describes how the frontend identifies and handles concurrency conflicts during financial write operations.

## Backend Concurrency Context

- **No Entity Versioning**: The C# API entities (e.g. Account, Bank) do not expose standard `RowVersion` or `ETag` concurrency tokens.
- **Business Logic Gating**: Concurrency conflicts are instead triggered on business rule violations at the controller/database level, returning a `409 Conflict` response.
    - _Example 1_: Approving a transaction that has already been approved or rejected by another Master Accountant.
    - _Example 2_: Postings targeting a bank account that was deactivated in another concurrent session.

---

## Concurrency Recovery Flow

When a financial action returns a `409 Conflict` response, the app triggers the `ConflictDialog` recovery block:

1.  **Intercepting the 409**: The central API fetch middleware catches the 409 status code.
2.  **Displaying the Dialog**: Instead of showing a raw error banner or crashing the page, the user is presented with a non-dismissible modal overlay: `ConflictDialog.svelte`.
3.  **Conflict Message**: The modal clearly explains that another user has modified the records, and the local screen has become stale.
4.  **Enforced Data Refresh**: The only action available in the dialog is a "Reload & Refresh" button.
    - Clicking this button calls the page's data-reloading functions, updating the page state with the authoritative server state.
    - This dismisses the dialog and updates the UI so the user can see what has changed.
