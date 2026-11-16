/**
 * Idempotency key management for financial write operations.
 *
 * Rules (from Phase 2 spec):
 * - One key per logical user operation
 * - Retries reuse the same key
 * - User edits payload after failure → new key must be generated
 * - Successful completion → key retired (caller must call retire())
 * - New user operation → new key via createOperation()
 */

/**
 * Creates a new crypto-random idempotency key.
 * Uses `crypto.randomUUID()` — available in all modern browsers and Node.js 15+.
 */
export function generateIdempotencyKey(): string {
	return crypto.randomUUID();
}

/**
 * Represents a single idempotent financial write operation.
 * Hold this object for the lifetime of a single form submission flow.
 *
 * @example
 * const op = createIdempotentOperation();
 * // First attempt or retry with same payload:
 * await submitForm(op.key);
 * // On success:
 * op.retire();
 * // On user editing the form (new logical op):
 * op.regenerate();
 */
export interface IdempotentOperation {
	/** The current idempotency key. Use this as the Idempotency-Key header value. */
	readonly key: string;
	/**
	 * Regenerate the key when the user intentionally changes the payload.
	 * This creates a semantically new operation.
	 */
	regenerate(): void;
	/**
	 * Retire the key after a successful operation.
	 * Subsequent calls to `key` after retire will return a new key (lazy generation).
	 */
	retire(): void;
	/** Whether this operation has been retired (successfully completed). */
	readonly isRetired: boolean;
}

/**
 * Creates a managed idempotent operation container.
 * The key is generated immediately and persists across retries.
 */
export function createIdempotentOperation(): IdempotentOperation {
	let _key = generateIdempotencyKey();
	let _retired = false;

	return {
		get key() {
			if (_retired) {
				// Auto-generate new key if accessed after retirement (safety net)
				_key = generateIdempotencyKey();
				_retired = false;
			}
			return _key;
		},
		regenerate() {
			_key = generateIdempotencyKey();
			_retired = false;
		},
		retire() {
			_retired = true;
		},
		get isRetired() {
			return _retired;
		}
	};
}
