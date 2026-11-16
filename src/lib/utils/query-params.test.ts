import { describe, it, expect } from 'vitest';
import {
	parseTransactionFilters,
	serializeTransactionFilters,
	hasActiveFilters,
	DEFAULT_TRANSACTION_FILTERS
} from './query-params';

describe('URL Query Parameter Utility', () => {
	it('should parse valid search query filters correctly', () => {
		const url = new URL(
			'http://localhost/transactions?status=pending&type=incoming&page=3&pageSize=50'
		);
		const filters = parseTransactionFilters(url);

		expect(filters.status).toBe('pending');
		expect(filters.type).toBe('incoming');
		expect(filters.page).toBe(3);
		expect(filters.pageSize).toBe(50);
		expect(hasActiveFilters(filters)).toBe(true);
	});

	it('should normalize invalid search query values', () => {
		const url = new URL(
			'http://localhost/transactions?status=hacked&type=fake_type&page=-5&pageSize=99'
		);
		const filters = parseTransactionFilters(url);

		expect(filters.status).toBeNull();
		expect(filters.type).toBeNull();
		expect(filters.page).toBe(1);
		expect(filters.pageSize).toBe(20); // fallbacks to default
	});

	it('should serialize active filters to search params correctly', () => {
		const filters = {
			status: 'approved' as const,
			type: 'contra' as const,
			referenceType: 'transfer' as const,
			referenceId: 'TX-101',
			page: 2,
			pageSize: 50
		};

		const params = serializeTransactionFilters(filters as any);
		expect(params.get('status')).toBe('approved');
		expect(params.get('type')).toBe('contra');
		expect(params.get('referenceType')).toBe('transfer');
		expect(params.get('referenceId')).toBe('TX-101');
		expect(params.get('page')).toBe('2');
		expect(params.get('pageSize')).toBe('50');
	});

	it('should omit default filter values from serialized search params', () => {
		const params = serializeTransactionFilters(DEFAULT_TRANSACTION_FILTERS);
		expect(params.toString()).toBe('');
	});
});
