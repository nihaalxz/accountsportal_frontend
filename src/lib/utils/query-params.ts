/**
 * URL query parameter utilities for financial list pages.
 *
 * Rules:
 * - Only backend-supported filter values are allowed through
 * - Invalid or unknown values are silently normalized (not passed to API)
 * - No arbitrary string passthrough for enum fields
 */

import {
	TRANSACTION_STATUS_VALUES,
	TRANSACTION_TYPE_VALUES,
	REFERENCE_TYPE_VALUES,
	type TransactionStatus,
	type TransactionType,
	type ReferenceType
} from '$lib/types/financial';

// ─── Transaction Filters ─────────────────────────────────────────────────────

export interface TransactionFilters {
	status: TransactionStatus | null;
	type: TransactionType | null;
	referenceType: ReferenceType | null;
	referenceId: string | null;
	startDate: string | null;
	endDate: string | null;
	page: number;
	pageSize: number;
}

export const DEFAULT_TRANSACTION_FILTERS: TransactionFilters = {
	status: null,
	type: null,
	referenceType: null,
	referenceId: null,
	startDate: null,
	endDate: null,
	page: 1,
	pageSize: 20
};

const ALLOWED_PAGE_SIZES = [10, 20, 50, 100] as const;

/**
 * Safely parses transaction filters from a URL's search params.
 * Invalid values are silently normalized to null/defaults.
 */
export function parseTransactionFilters(url: URL): TransactionFilters {
	const params = url.searchParams;

	const statusRaw = params.get('status');
	const typeRaw = params.get('type');
	const refTypeRaw = params.get('referenceType');
	const refId = params.get('referenceId');
	const startDateRaw = params.get('startDate') || params.get('from');
	const endDateRaw = params.get('endDate') || params.get('to');
	const pageRaw = params.get('page');
	const pageSizeRaw = params.get('pageSize');

	const status =
		statusRaw && (TRANSACTION_STATUS_VALUES as readonly string[]).includes(statusRaw)
			? (statusRaw as TransactionStatus)
			: null;

	const normalizedTypeRaw = typeRaw?.toLowerCase();
	const type =
		normalizedTypeRaw && (TRANSACTION_TYPE_VALUES as readonly string[]).includes(normalizedTypeRaw)
			? (normalizedTypeRaw as TransactionType)
			: (normalizedTypeRaw === 'receipts' ? 'receipt' : null);

	const referenceType =
		refTypeRaw && (REFERENCE_TYPE_VALUES as readonly string[]).includes(refTypeRaw)
			? (refTypeRaw as ReferenceType)
			: null;

	// Sanitize referenceId: only allow alphanumeric + dash + underscore
	const referenceId = refId && /^[\w-]{1,100}$/.test(refId) ? refId : null;

	const startDate = startDateRaw && /^\d{4}-\d{2}-\d{2}$/.test(startDateRaw) ? startDateRaw : null;
	const endDate = endDateRaw && /^\d{4}-\d{2}-\d{2}$/.test(endDateRaw) ? endDateRaw : null;

	const pageNum = parseInt(pageRaw ?? '1', 10);
	const page = isNaN(pageNum) || pageNum < 1 ? 1 : pageNum;

	const pageSizeNum = parseInt(pageSizeRaw ?? '20', 10);
	const pageSize = (ALLOWED_PAGE_SIZES as readonly number[]).includes(pageSizeNum)
		? pageSizeNum
		: 20;

	return { status, type, referenceType, referenceId, startDate, endDate, page, pageSize };
}

/**
 * Serializes transaction filters to URL search params.
 * Null values are omitted (clean URL).
 */
export function serializeTransactionFilters(
	filters: TransactionFilters,
	base: URL | string = 'http://localhost'
): URLSearchParams {
	const params = new URLSearchParams();

	if (filters.status) params.set('status', filters.status);
	if (filters.type) params.set('type', filters.type);
	if (filters.referenceType) params.set('referenceType', filters.referenceType);
	if (filters.referenceId) params.set('referenceId', filters.referenceId);
	if (filters.startDate) params.set('startDate', filters.startDate);
	if (filters.endDate) params.set('endDate', filters.endDate);
	if (filters.page > 1) params.set('page', String(filters.page));
	if (filters.pageSize !== 20) params.set('pageSize', String(filters.pageSize));

	void base; // suppress unused warning — kept for future extension
	return params;
}

/**
 * Returns a query string from filters (e.g., "?status=pending&page=2").
 * Returns empty string if all filters are at defaults.
 */
export function filtersToQueryString(filters: TransactionFilters): string {
	const params = serializeTransactionFilters(filters);
	const str = params.toString();
	return str ? `?${str}` : '';
}

/**
 * Returns true if the filters differ from defaults (i.e., active filters exist).
 */
export function hasActiveFilters(filters: TransactionFilters): boolean {
	return (
		filters.status !== null ||
		filters.type !== null ||
		filters.referenceType !== null ||
		filters.referenceId !== null ||
		filters.startDate !== null ||
		filters.endDate !== null ||
		filters.page > 1
	);
}
