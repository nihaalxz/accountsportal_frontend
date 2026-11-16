import { describe, it, expect } from 'vitest';
import {
	getStatusConfig,
	getTypeConfig,
	getPaymentMethodLabel,
	getReferenceTypeLabel,
	getAllowedActions
} from './financial';

describe('Financial Types Configuration', () => {
	it('should return correct visual tones for status values', () => {
		const pending = getStatusConfig('pending');
		expect(pending.tone).toBe('pending');
		expect(pending.label).toBe('Pending');

		const approved = getStatusConfig('approved');
		expect(approved.tone).toBe('positive');
		expect(approved.label).toBe('Approved');

		const rejected = getStatusConfig('rejected');
		expect(rejected.tone).toBe('negative');
		expect(rejected.label).toBe('Rejected');

		// Unknown status fallback
		const unknown = getStatusConfig('unknown_status');
		expect(unknown.tone).toBe('neutral');
		expect(unknown.label).toBe('unknown_status');
	});

	it('should return correct directional flags for transaction types', () => {
		const incoming = getTypeConfig('incoming');
		expect(incoming.direction).toBe('in');

		const outgoing = getTypeConfig('outgoing');
		expect(outgoing.direction).toBe('out');

		const contra = getTypeConfig('contra');
		expect(contra.direction).toBe('neutral');
	});

	it('should return allowed master_accountant workflow transitions', () => {
		expect(getAllowedActions('pending')).toContain('approve');
		expect(getAllowedActions('pending')).toContain('reject');
		expect(getAllowedActions('approved')).toHaveLength(0);
		expect(getAllowedActions('rejected')).toHaveLength(0);
	});
});
