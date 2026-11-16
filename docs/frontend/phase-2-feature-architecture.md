# Phase 2 Feature Architecture

This document describes the design patterns and folder structures introduced in Phase 2.

## Feature Folder Structure

To enforce separation of concerns and avoid high coupling in large modules, all code implemented in Phase 2 is segregated by features:

```
src/features/
├── dashboard/
│   ├── api.ts          # Composers for summary and recent transaction endpoints
│   └── types.ts        # Dashboard metrics response contracts
│
├── financial-transactions/
│   ├── api.ts          # Endpoint wrappers for incoming, outgoing, contra, approve, reject
│   └── types.ts        # Request and response models
│
├── cash-accounts/
│   ├── api.ts          # CRUD and toggle-status, correct-balance wrappers
│   └── types.ts        # Account DTO models
│
└── bank-accounts/
    ├── api.ts          # CRUD and toggle-status bank wrappers
    └── types.ts        # Bank DTO models
```

---

## State Bindings

All routing pages under `src/routes/(app)` load data on mount and reactively bind values using Svelte 5 runes:

- `$state`: Declares reactive lists, details, loads, and dialog states.
- `$derived`: Automatically filters lists client-side and dynamically format dynamic metrics.
- `$effect`: Automatically syncs URL search query updates with route actions.

---

## Shared UI Framework

A unified set of financial domain widgets is established in `src/lib/components/financial/`:

- `MoneyAmount.svelte`: Format dynamically using dynamic Dinars decimal configurations.
- `FinancialStatusBadge.svelte`: Non-color-only statuses indicator badge.
- `TransactionTypeChip.svelte`: Directional flag chip indicating outgoing, incoming, and contra postings.
- `FinancialTableSkeleton.svelte` / `FinancialCardSkeleton.svelte`: Structured placeholder skeletons for loading indicators.
