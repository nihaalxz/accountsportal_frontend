# Phase 2 Bundle Delta

This document estimates the bundle size impact of the Phase 2 feature modules.

## Estimated Code Size Additions

| Feature Module / File              | Estimated Gzipped Size | Purpose / Context                                |
| :--------------------------------- | :--------------------- | :----------------------------------------------- |
| **Financial Types & Utils**        |                        |                                                  |
| `src/lib/types/financial.ts`       | ~1.2 KB                | Domain enum configuration, status configurations |
| `src/lib/utils/idempotency.ts`     | ~0.4 KB                | UUID generation, state retirement utility        |
| `src/lib/utils/query-params.ts`    | ~0.8 KB                | URL parsing, serialization                       |
| **Shared UI Elements**             |                        |                                                  |
| `MoneyAmount.svelte`               | ~0.9 KB                | Intl dinar formatter wrapper                     |
| Badge / Chip / Card Skeletons      | ~1.8 KB                | Table, card skeletons, state chips               |
| Dialog / Modal Components          | ~2.5 KB                | Confirm, reject, conflict modals                 |
| **Main Routes & Pages**            |                        |                                                  |
| `/dashboard`                       | ~2.2 KB                | Metric grids and recent ledger tables            |
| `/transactions`                    | ~4.5 KB                | Server-side filters, paginated tables            |
| `/transactions/new`                | ~3.8 KB                | Tabbed forms (incoming, outgoing, contra)        |
| `/accounts` (Listing/Details/Edit) | ~6.2 KB                | Cash accounts view and GL statement reports      |
| `/banks` (Listing/Details/Edit)    | ~4.5 KB                | Bank treasury view and status settings           |
| **Total Estimated Delta**          | **~28.7 KB**           | Dynamic chunk additions                          |

## Summary

The addition of Phase 2 business logic adds approximately **28 KB** to the compressed web application footprint, which is well within acceptable budget constraints (~150 KB initial bundle target).
All pages are lazily loaded on navigation, ensuring no impact on initial login load speeds.
