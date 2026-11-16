/**
 * Dashboard feature API service.
 * Composes data from GET /api/reconciliation/summary + GET /api/transaction (recent).
 */

import { apiFetch } from '$lib/api/api-client';
import type { ReconciliationSummary } from './types';
import type { TransactionResponse } from '../financial-transactions/types';

/**
 * Fetches the reconciliation summary (balance overview).
 * GET /api/reconciliation/summary
 */
export async function getReconciliationSummary(
	signal?: AbortSignal
): Promise<ReconciliationSummary> {
	return apiFetch<ReconciliationSummary>('/api/reconciliation/summary', { signal });
}

/**
 * Fetches the most recent transactions for the dashboard feed.
 * Uses GET /api/transaction with pageSize=10.
 */
export async function getRecentTransactions(signal?: AbortSignal): Promise<TransactionResponse[]> {
	return apiFetch<TransactionResponse[]>('/api/transaction?pageSize=10', { signal });
}
