# Phase 4 Threat Model

This document outlines potential security threats and mitigation strategies for Payroll, Staff Profiles, and Supplier Wallets.

---

## 1. Threat Inventory & Mitigations

### T1: Double Posting of Supplier Payments
- **Threat**: User clicks "Post Payment" multiple times due to a slow network, leading to double-debited cash/bank accounts.
- **Mitigation**: Post requests are sent with a unique `Idempotency-Key` UUID. The backend stores key hashes and throws a `409 Conflict` or returns the cached response if a duplicate is sent.
- **Risk Rating**: High (Financial impact) -> Mitigated (Low risk).

### T2: Unauthorized Access to Salary Config Profiles
- **Threat**: A regular Accountant attempts to set basic salary and allowances.
- **Mitigation**: The configuration page is restricted using `hasRole('master_accountant')`. The backend controller checks roles and throws `403 Forbidden` if validation fails.
- **Risk Rating**: Critical -> Mitigated (Zero risk).

### T3: Concurrency Conflict on Supplier Payments (RowVersion)
- **Threat**: Two users load a supplier wallet and attempt to debit/credit funds simultaneously.
- **Mitigation**: DB update mappings verify optimistic concurrency tokens (`RowVersion`). The backend throws a database update concurrency exception and blocks execution.
- **Risk Rating**: Medium -> Mitigated.
