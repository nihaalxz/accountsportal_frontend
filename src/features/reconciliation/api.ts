/**
 * Reconciliation API client.
 * Uses centralized apiFetch.
 */

import { apiFetch } from '$lib/api/api-client';
import type { ReconciliationSummaryResponse, GlReconciliationReportResponse } from './types';
import type { TransactionResponse } from '../financial-transactions/types';

/** GET /api/reconciliation/summary */
export async function getReconciliationSummary(
	signal?: AbortSignal
): Promise<ReconciliationSummaryResponse> {
	return apiFetch<ReconciliationSummaryResponse>('/api/reconciliation/summary', { signal });
}

/** GET /api/reconciliation/gl-reconciliation */
export async function getGlReconciliation(
	signal?: AbortSignal
): Promise<GlReconciliationReportResponse> {
	return apiFetch<GlReconciliationReportResponse>('/api/reconciliation/gl-reconciliation', {
		signal
	});
}

/** GET /api/reconciliation/supplier-statement/{supplierId} */
export async function getSupplierStatement(
	supplierId: number,
	params?: { startDate?: string; endDate?: string; page?: number; pageSize?: number },
	signal?: AbortSignal
): Promise<TransactionResponse[]> {
	return apiFetch<TransactionResponse[]>(`/api/reconciliation/supplier-statement/${supplierId}`, {
		params: {
			startDate: params?.startDate,
			endDate: params?.endDate,
			page: params?.page,
			pageSize: params?.pageSize
		},
		signal
	});
}
