# Phase 2 Architecture Rules

This document outlines strict coding guidelines and engineering rules for Phase 2 financial modules.

## Architecture Enforcement Rules

### 1. Separation of Concerns

- All API network requests must go through the dedicated feature folders (`src/features/*/api.ts`). Direct `fetch()` calls inside Svelte files are strictly prohibited.
- Type interfaces representing backend contracts must reside in `src/features/*/types.ts` or `src/lib/types/financial.ts`. Do not define ad-hoc interfaces directly in the markup.

### 2. Idempotency Gating

- All financial writing actions must include a unique `Idempotency-Key` header generated via `crypto.randomUUID()`.
- Retrying an identical request (due to connection loss) must reuse the same key. Modifying form inputs must refresh the key.

### 3. No Frontend Calculations

- The frontend must never calculate account balances locally. All values shown under "Current Balance" must be fetched directly from the backend API.

### 4. Strict Type Safety

- TypeScript strict mode must be preserved. Avoid using `any` or `@ts-ignore` / `@ts-nocheck` overrides.
