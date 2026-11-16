/**
 * Bank Account API service.
 * Uses centralized Phase 1 apiFetch client.
 */

import { apiFetch } from '$lib/api/api-client';
import type {
	BankResponse,
	CreateBankRequest,
	UpdateBankRequest,
	BankToggleStatusResponse
} from './types';

/**
 * Fetches all bank accounts.
 * GET /api/bank (RequireAccountant)
 * Returns all banks ordered by name — no pagination.
 */
export async function getBanks(signal?: AbortSignal): Promise<BankResponse[]> {
	return apiFetch<BankResponse[]>('/api/bank', { signal });
}

/**
 * Creates a new bank account.
 * POST /api/bank (RequireMasterAccountant)
 * Returns 409 if AccountNumber is already registered.
 */
export async function createBank(
	request: CreateBankRequest,
	signal?: AbortSignal
): Promise<BankResponse> {
	return apiFetch<BankResponse>('/api/bank', {
		method: 'POST',
		body: JSON.stringify(request),
		signal
	});
}

/**
 * Updates an existing bank account's name and account number.
 * PUT /api/bank/{id} (RequireMasterAccountant)
 * Returns 409 if the new AccountNumber is already used by another bank.
 */
export async function updateBank(
	id: number,
	request: UpdateBankRequest,
	signal?: AbortSignal
): Promise<void> {
	await apiFetch<void>(`/api/bank/${id}`, {
		method: 'PUT',
		body: JSON.stringify(request),
		signal
	});
}

/**
 * Toggles the active/inactive status of a bank account.
 * POST /api/bank/{id}/toggle-status (RequireMasterAccountant)
 */
export async function toggleBankStatus(
	id: number,
	signal?: AbortSignal
): Promise<BankToggleStatusResponse> {
	return apiFetch<BankToggleStatusResponse>(`/api/bank/${id}/toggle-status`, {
		method: 'POST',
		signal
	});
}
