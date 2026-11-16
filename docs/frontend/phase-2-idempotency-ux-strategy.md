# Phase 2 Idempotency UX Strategy

This document outlines the frontend implementation strategy for idempotent write operations on financial entities.

## Background

To prevent double-posting or duplicate-charge errors during slow network conditions or double-click events, the accounts portal enforces idempotency keys for all write requests:

1.  **Incoming Flow Postings**: `POST /api/transaction/incoming`
2.  **Outgoing Flow Postings**: `POST /api/transaction/outgoing`
3.  **Contra (Internal Transfer) Postings**: `POST /api/transaction/contra`
4.  **Balance Corrections**: `POST /api/account/{id}/correct-balance`

---

## Idempotency Key Lifecycle Rules

The frontend uses the `IdempotentOperation` utility (`src/lib/utils/idempotency.ts`) to manage keys:

```
              ┌───────────────────────────┐
              │ User loads submission Form│
              └─────────────┬─────────────┘
                            │
                            ▼
              ┌───────────────────────────┐
              │ Generate primary UUID key │
              └─────────────┬─────────────┘
                            │
            ┌───────────────┴───────────────┐
      User edits field?               Form submitted?
            │                               │
            ▼ (new logical operation)        ▼
      ┌──────────────┐              ┌──────────────┐
      │Regenerate key│              │Send write API│
      └──────────────┘              └───────┬──────┘
                                            │
                    ┌───────────────────────┴───────────────────────┐
             200 OK Response?                                Network Failure?
                    │                                               │
                    ▼ (successful execution)                        ▼ (transient retry)
            ┌──────────────┐                                ┌───────────────┐
            │Retire key/op │                                │Re-send same key│
            └──────────────┘                                └───────────────┘
```

1.  **Strict Operation Boundary**: One unique `Idempotency-Key` header (using UUID v4) is generated when the user loads the form.
2.  **User-Edit Reset**: If the user modifies any field input after a failure, the transaction is recognized as a new logical operation, and a fresh key is generated.
3.  **Transient Network Retries**: If the submission fails due to a network connection error (e.g. timeout), clicking "Submit" again retries the request using the **exact same** key.
4.  **Key Retirement**: Upon receiving a successful `200 OK` response, the key is permanently retired. Navigating away or resetting the form forces a fresh key.

---

## Concurrency Conflict UX Response (409)

When the backend receives a duplicate key, it returns a `409 Conflict` (indicating the operation was already processed).

- **Response mapping**: The client captures the 409 and displays a clean error explanation instead of breaking the flow.
- **Redirect safety**: The user is informed that the record has already been recorded, and they are redirected back to the transactions checklist.
