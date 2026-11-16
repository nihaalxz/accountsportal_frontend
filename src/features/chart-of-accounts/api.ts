/**
 * Chart of Accounts API client.
 * All calls use centralized apiFetch — no raw fetch allowed.
 */

import { apiFetch } from '$lib/api/api-client';
import type {
	ChartOfAccountResponse,
	CreateChartOfAccountRequest,
	UpdateChartOfAccountRequest
} from './types';

const BASE = '/api/chartofaccounts';

/** GET /api/chartofaccounts — returns full flat list */
export async function getChartOfAccounts(signal?: AbortSignal): Promise<ChartOfAccountResponse[]> {
	return apiFetch<ChartOfAccountResponse[]>(BASE, { signal });
}

/** GET /api/chartofaccounts/{id} */
export async function getChartOfAccountById(
	id: number,
	signal?: AbortSignal
): Promise<ChartOfAccountResponse> {
	return apiFetch<ChartOfAccountResponse>(`${BASE}/${id}`, { signal });
}

/** POST /api/chartofaccounts — RequireMasterAccountant */
export async function createChartOfAccount(
	data: CreateChartOfAccountRequest,
	signal?: AbortSignal
): Promise<ChartOfAccountResponse> {
	return apiFetch<ChartOfAccountResponse>(BASE, {
		method: 'POST',
		body: JSON.stringify(data),
		signal
	});
}

/** PUT /api/chartofaccounts/{id} — RequireMasterAccountant */
export async function updateChartOfAccount(
	id: number,
	data: UpdateChartOfAccountRequest,
	signal?: AbortSignal
): Promise<ChartOfAccountResponse> {
	return apiFetch<ChartOfAccountResponse>(`${BASE}/${id}`, {
		method: 'PUT',
		body: JSON.stringify(data),
		signal
	});
}

/** DELETE /api/chartofaccounts/{id} — RequireMasterAccountant */
export async function deleteChartOfAccount(id: number, signal?: AbortSignal): Promise<void> {
	return apiFetch<void>(`${BASE}/${id}`, {
		method: 'DELETE',
		signal
	});
}

/** POST /api/chartofaccounts/seed — RequireMasterAccountant */
export async function seedSystemAccounts(signal?: AbortSignal): Promise<{ message: string }> {
	return apiFetch<{ message: string }>(`${BASE}/seed`, {
		method: 'POST',
		signal
	});
}
