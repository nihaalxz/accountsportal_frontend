# Phase 2 Financial Write Strategy

This document describes the safety checks, validations, and confirmations enforced during financial updates.

## Submission Safeguards

To protect the general ledger from accidental double-posting, network timeouts, or malicious inputs, the write pipeline implements a three-tier defense model:

### Tier 1: Client-Side Gating & Validation

- All forms (Incoming/Outgoing/Contra, Balance Correction) perform strict field validations before dispatching requests:
    - Amounts must be positive numbers (`> 0`).
    - Accounts/Banks selections are checked for active state.
    - Contra transfers must not target the exact same source and destination.
- The "Submit" button is immediately disabled upon click, replacing the text with a spinner to block double-clicks.

### Tier 2: Idempotent Headers

- Every submission includes an `Idempotency-Key` header.
- If a request encounters a network drop, resubmitting continues to send the identical key. If the server successfully completed the posting on the first attempt, the duplicate is cleanly rejected with a 409 Conflict, preserving database integrity.

### Tier 3: High-Friction Dialogue Confirmation

- Balance corrections and state transitions (Approve / Reject) are guarded behind explicit confirmation modals.
- Rejection actions require a text reason input to record audits.
