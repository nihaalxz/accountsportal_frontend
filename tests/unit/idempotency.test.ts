import { describe, it, expect } from 'vitest';
import { generateIdempotencyKey, createIdempotentOperation } from '../../src/lib/utils/idempotency';

describe('Idempotency Key Utility', () => {
	it('should generate valid UUIDv4 keys', () => {
		const key = generateIdempotencyKey();
		expect(key).toBeDefined();
		expect(key).toHaveLength(36);
		// Regex for UUIDv4
		expect(key).toMatch(
			/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
		);
	});

	it('should generate unique keys across calls', () => {
		const key1 = generateIdempotencyKey();
		const key2 = generateIdempotencyKey();
		expect(key1).not.toBe(key2);
	});

	it('should manage key containers lifecycle correctly', () => {
		const op = createIdempotentOperation();
		const initialKey = op.key;

		expect(initialKey).toBeDefined();
		expect(op.isRetired).toBe(false);

		// Key should persist across reads before retirement
		expect(op.key).toBe(initialKey);

		// Regenerate should create new key
		op.regenerate();
		const secondKey = op.key;
		expect(secondKey).not.toBe(initialKey);
		expect(op.isRetired).toBe(false);

		// Retire should mark retired and force a new key on next access
		op.retire();
		expect(op.isRetired).toBe(true);

		const thirdKey = op.key;
		expect(thirdKey).not.toBe(secondKey);
		expect(op.isRetired).toBe(false); // Lazy re-init on read
	});
});
