# Phase 2 Financial Permission Matrix

This document defines user authorization requirements across all financial features implemented in Phase 2.

## Authorization Roles & Policies

The portal utilizes two distinct application roles:

1.  **Accountant / Normal Accountant / Accounts**: Read-only access to ledger sheets, transaction lists, and cash account balances. Can write new transactions (which register as `pending`).
2.  **Master Accountant**: Full administrative privileges. Gated access to all creation, updates, adjustments, approvals, rejections, and toggle status workflows.

---

## Route & UI Action Matrix

| Feature Module    | Route                 | Action            | Role required     | Policy / Implementation                        |
| :---------------- | :-------------------- | :---------------- | :---------------- | :--------------------------------------------- |
| **Dashboard**     | `/dashboard`          | View metrics      | Accountant+       | Checked by app layout guard                    |
|                   |                       | Refresh metrics   | Accountant+       | Available via manual refresh                   |
| **Transactions**  | `/transactions`       | View list         | Accountant+       | Checked by app layout guard                    |
|                   |                       | Filter records    | Accountant+       | URL-synchronized filters                       |
|                   | `/transactions/[id]`  | View details      | Accountant+       | Checked by app layout guard                    |
|                   |                       | Approve Posting   | Master Accountant | Gated by `hasRole('master_accountant')`        |
|                   |                       | Reject Posting    | Master Accountant | Gated by `hasRole('master_accountant')`        |
|                   | `/transactions/new`   | Post Transaction  | Accountant+       | Any accountant can create a pending posting    |
| **Cash Accounts** | `/accounts`           | View list         | Accountant+       | Checked by app layout guard                    |
|                   |                       | Create Account    | Master Accountant | Gated by `hasRole('master_accountant')` check  |
|                   | `/accounts/[id]`      | View Details & GL | Accountant+       | Checked by app layout guard                    |
|                   |                       | Correct Balance   | Master Accountant | Gated by `hasRole('master_accountant')` dialog |
|                   |                       | Toggle Status     | Master Accountant | Gated by `hasRole('master_accountant')` button |
|                   | `/accounts/[id]/edit` | Edit Account      | Master Accountant | Gated by `hasRole('master_accountant')` check  |
| **Bank Accounts** | `/banks`              | View list         | Accountant+       | Checked by app layout guard                    |
|                   |                       | Register Bank     | Master Accountant | Gated by `hasRole('master_accountant')` check  |
|                   | `/banks/[id]`         | View Details      | Accountant+       | Checked by app layout guard                    |
|                   |                       | Toggle Status     | Master Accountant | Gated by `hasRole('master_accountant')` button |
|                   | `/banks/[id]/edit`    | Edit Bank         | Master Accountant | Gated by `hasRole('master_accountant')` check  |

---

## Technical Enforcement Methods

1.  **Route Protection**: Protected folders nested under `(app)` are gated via `src/routes/(app)/+layout.svelte` checking `$isAuthenticated`.
2.  **Route Page Guarding**: Inside `new/+page.svelte` and `[id]/edit/+page.svelte`, an `onMount` hook checks `if (!hasRole('master_accountant'))` and immediately redirects unauthorized attempts back to the listing.
3.  **Action Hiding**: Buttons and forms enabling writes/corrections/approvals are wrapped in Svelte blocks checking `{#if hasRole('master_accountant')}`.
4.  **Backend Verification**: The API client automatically returns a `403 Forbidden` if a user attempts a network POST to administrative endpoints (e.g. `/approve`, `/correct-balance`), which is captured and displayed in a standardized warning dialog.
