# Phase 2 Financial State Transition Matrix

---

## Financial Transaction State Machine

```
                    [Accountant creates]
                           │
                           ▼
                       ┌─────────┐
                       │ Pending │
                       └─────────┘
                          │    │
        [MasterAccountant]│    │[MasterAccountant]
             approve       │    │    reject
                           │    │
              ┌────────────┘    └────────────┐
              ▼                              ▼
         ┌──────────┐                 ┌──────────┐
         │ Approved │                 │ Rejected │
         └──────────┘                 └──────────┘
              │                              │
           TERMINAL                      TERMINAL
    (no reversal endpoint)        (no re-submission endpoint)
```

### Allowed Transitions

| From       | Action   | To         | Policy                  | Endpoint                             |
| :--------- | :------- | :--------- | :---------------------- | :----------------------------------- |
| `pending`  | approve  | `approved` | RequireMasterAccountant | `POST /api/transaction/{id}/approve` |
| `pending`  | reject   | `rejected` | RequireMasterAccountant | `POST /api/transaction/{id}/reject`  |
| `approved` | _(none)_ | —          | —                       | NOT SUPPORTED                        |
| `rejected` | _(none)_ | —          | —                       | NOT SUPPORTED                        |

### Error States During Transition

| Scenario                               | HTTP Status   | Frontend Handling                                   |
| :------------------------------------- | :------------ | :-------------------------------------------------- |
| Approving already-approved transaction | 409 Conflict  | ConflictDialog — "Transaction was already approved" |
| Approving already-rejected transaction | 409 Conflict  | ConflictDialog — "Transaction was already rejected" |
| Transaction not found                  | 404 Not Found | ErrorState — "Transaction not found"                |
| Insufficient role                      | 403 Forbidden | Hide action button (RBAC)                           |
| Network timeout                        | Timeout       | Toast error, no automatic retry                     |

---

## Cash Account State Machine

Cash accounts have only an `IsActive` boolean — no formal state machine.

```
IsActive=true  ──[toggle (MasterAccountant)]──► IsActive=false
IsActive=false ──[toggle (MasterAccountant)]──► IsActive=true
```

Inactive accounts still exist and retain their balance. Transactions against inactive accounts may be blocked at the backend (not explicitly documented in controller — controller does not validate IsActive on transaction posting).

---

## Bank Account State Machine

Same as Cash Accounts — `IsActive` boolean toggle only.

```
IsActive=true  ──[toggle (MasterAccountant)]──► IsActive=false
IsActive=false ──[toggle (MasterAccountant)]──► IsActive=true
```

---

## Financial Transaction Creation Flow

```
User selects type (incoming / outgoing / contra)
          │
          ▼
   Fill form fields
          │
          ▼
   Client validation passes?
          │ No ──► Show field errors, block submission
          │ Yes
          ▼
   Generate Idempotency-Key (new UUID per logical operation)
          │
          ▼
   POST /api/transaction/{type} with Idempotency-Key header
          │
          ├──[200 OK]──► Transaction created (status: pending)
          │               Redirect to /transactions
          │               Toast: "Transaction posted successfully"
          │
          ├──[409 Conflict]──► Same key / duplicate?
          │                    Show: "This operation may have already been submitted"
          │                    Offer: "View Transactions" button
          │
          ├──[404 Not Found]──► Account/Bank not found
          │                     Show field-level error
          │
          ├──[400 Bad Request]──► Validation failed
          │                      Map field errors from ProblemDetails
          │
          └──[Network Error]──► Toast error, allow retry with SAME key
```

---

## Balance Correction Flow

```
MasterAccountant clicks "Correct Balance" on Account detail
          │
          ▼
   High-friction confirmation dialog:
   - Shows current balance
   - Adjustment amount field (positive = credit, negative = debit)
   - Reason field (required)
   - Explicit confirmation button
          │
          ▼
   Generate Idempotency-Key
          │
          ▼
   POST /api/account/{id}/correct-balance
          │
          ├──[200 OK]──► Success, refresh account detail
          ├──[409]──────► Conflict dialog
          └──[404]──────► Account not found error
```
