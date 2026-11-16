/**
 * Financial transaction API service.
 * Uses the centralized Phase 1 apiFetch client.
 * All requests go through the established API boundary.
 */

import { apiFetch } from '$lib/api/api-client';
import type {
	TransactionResponse,
	CreateIncomingTransactionRequest,
	CreateOutgoingTransactionRequest,
	CreateContraTransactionRequest,
	RejectTransactionRequest,
	TransactionListQuery
} from './types';

/**
 * Fetches the financial transaction list.
 * GET /api/transaction
 *
 * @param query - Filter, pagination params (all optional)
 * @param signal - AbortSignal for request cancellation on navigation/filter change
 */
export async function getTransactions(
	query: TransactionListQuery = {},
	signal?: AbortSignal
): Promise<TransactionResponse[]> {
	const params = new URLSearchParams();

	if (query.status) params.set('status', query.status);
	if (query.type) params.set('type', query.type);
	if (query.referenceType) params.set('referenceType', query.referenceType);
	if (query.referenceId) params.set('referenceId', query.referenceId);
	if (query.bankId) params.set('bankId', String(query.bankId));
	if (query.accountId) params.set('accountId', String(query.accountId));
	if (query.search) params.set('search', query.search);
	if (query.startDate) params.set('startDate', query.startDate);
	if (query.endDate) params.set('endDate', query.endDate);
	if (query.page && query.page > 1) params.set('page', String(query.page));
	if (query.pageSize && query.pageSize !== 20) params.set('pageSize', String(query.pageSize));

	const qs = params.toString();
	const url = `/api/transaction${qs ? `?${qs}` : ''}`;

	return apiFetch<TransactionResponse[]>(url, { signal });
}

/**
 * Fetches a single financial transaction by ID.
 * GET /api/transaction/{id}
 */
export async function getTransactionById(
	id: number,
	signal?: AbortSignal
): Promise<TransactionResponse> {
	return apiFetch<TransactionResponse>(`/api/transaction/${id}`, { signal });
}

/**
 * Creates an incoming financial transaction.
 * POST /api/transaction/incoming
 * Requires Idempotency-Key header.
 */
export async function createIncomingTransaction(
	request: CreateIncomingTransactionRequest,
	idempotencyKey: string,
	signal?: AbortSignal
): Promise<TransactionResponse> {
	return apiFetch<TransactionResponse>('/api/transaction/incoming', {
		method: 'POST',
		body: JSON.stringify(request),
		headers: { 'Idempotency-Key': idempotencyKey },
		signal
	});
}

/**
 * Creates an outgoing financial transaction.
 * POST /api/transaction/outgoing
 * Requires Idempotency-Key header.
 */
export async function createOutgoingTransaction(
	request: CreateOutgoingTransactionRequest,
	idempotencyKey: string,
	signal?: AbortSignal
): Promise<TransactionResponse> {
	return apiFetch<TransactionResponse>('/api/transaction/outgoing', {
		method: 'POST',
		body: JSON.stringify(request),
		headers: { 'Idempotency-Key': idempotencyKey },
		signal
	});
}

/**
 * Creates a contra (internal transfer) transaction.
 * POST /api/transaction/contra
 * Requires Idempotency-Key header.
 */
export async function createContraTransaction(
	request: CreateContraTransactionRequest,
	idempotencyKey: string,
	signal?: AbortSignal
): Promise<TransactionResponse> {
	return apiFetch<TransactionResponse>('/api/transaction/contra', {
		method: 'POST',
		body: JSON.stringify(request),
		headers: { 'Idempotency-Key': idempotencyKey },
		signal
	});
}

/**
 * Approves a pending financial transaction.
 * POST /api/transaction/{id}/approve
 * Requires RequireMasterAccountant policy.
 */
export async function approveTransaction(
	id: number,
	signal?: AbortSignal
): Promise<TransactionResponse> {
	return apiFetch<TransactionResponse>(`/api/transaction/${id}/approve`, {
		method: 'POST',
		signal
	});
}

/**
 * Rejects a pending financial transaction.
 * POST /api/transaction/{id}/reject
 * Requires RequireMasterAccountant policy.
 */
export async function rejectTransaction(
	id: number,
	request: RejectTransactionRequest,
	signal?: AbortSignal
): Promise<TransactionResponse> {
	return apiFetch<TransactionResponse>(`/api/transaction/${id}/reject`, {
		method: 'POST',
		body: JSON.stringify(request),
		signal
	});
}
