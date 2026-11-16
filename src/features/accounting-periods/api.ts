/**
 * Accounting Periods API client.
 * All calls use centralized apiFetch.
 */

import { apiFetch } from '$lib/api/api-client';
import type {
	AccountingPeriodResponse,
	CreateAccountingPeriodRequest,
	ReopenAccountingPeriodRequest
} from './types';

const BASE = '/api/accountingperiods';

/** GET /api/accountingperiods */
export async function getAccountingPeriods(
	signal?: AbortSignal
): Promise<AccountingPeriodResponse[]> {
	return apiFetch<AccountingPeriodResponse[]>(BASE, { signal });
}

/** GET /api/accountingperiods/{id} */
export async function getAccountingPeriodById(
	id: number,
	signal?: AbortSignal
): Promise<AccountingPeriodResponse> {
	return apiFetch<AccountingPeriodResponse>(`${BASE}/${id}`, { signal });
}

/** POST /api/accountingperiods — RequireMasterAccountant */
export async function createAccountingPeriod(
	data: CreateAccountingPeriodRequest,
	signal?: AbortSignal
): Promise<AccountingPeriodResponse> {
	return apiFetch<AccountingPeriodResponse>(BASE, {
		method: 'POST',
		body: JSON.stringify(data),
		signal
	});
}

/** POST /api/accountingperiods/{id}/close — RequireMasterAccountant */
export async function closeAccountingPeriod(
	id: number,
	signal?: AbortSignal
): Promise<AccountingPeriodResponse> {
	return apiFetch<AccountingPeriodResponse>(`${BASE}/${id}/close`, {
		method: 'POST',
		signal
	});
}

/** POST /api/accountingperiods/{id}/reopen — RequireMasterAccountant */
export async function reopenAccountingPeriod(
	id: number,
	data: ReopenAccountingPeriodRequest,
	signal?: AbortSignal
): Promise<AccountingPeriodResponse> {
	return apiFetch<AccountingPeriodResponse>(`${BASE}/${id}/reopen`, {
		method: 'POST',
		body: JSON.stringify(data),
		signal
	});
}
