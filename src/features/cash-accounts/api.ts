/**
 * Cash Account API service.
 * Uses centralized Phase 1 apiFetch client.
 */

import { apiFetch } from '$lib/api/api-client';
import type {
	AccountResponse,
	CreateAccountRequest,
	UpdateAccountRequest,
	BalanceCorrectionRequest,
	BalanceCorrectionResponse,
	ToggleStatusResponse
} from './types';

/**
 * Fetches all accounts.
 * GET /api/account (RequireAccountant)
 * Returns all accounts ordered by name — no pagination.
 */
export async function getAccounts(signal?: AbortSignal): Promise<AccountResponse[]> {
	return apiFetch<AccountResponse[]>('/api/account', { signal });
}

/**
 * Creates a new account.
 * POST /api/account (RequireMasterAccountant)
 */
export async function createAccount(
	request: CreateAccountRequest,
	signal?: AbortSignal
): Promise<AccountResponse> {
	return apiFetch<AccountResponse>('/api/account', {
		method: 'POST',
		body: JSON.stringify(request),
		signal
	});
}

/**
 * Updates an existing account.
 * PUT /api/account/{id} (RequireMasterAccountant)
 */
export async function updateAccount(
	id: number,
	request: UpdateAccountRequest,
	signal?: AbortSignal
): Promise<void> {
	await apiFetch<void>(`/api/account/${id}`, {
		method: 'PUT',
		body: JSON.stringify(request),
		signal
	});
}

/**
 * Toggles the active/inactive status of an account.
 * POST /api/account/{id}/toggle-status (RequireMasterAccountant)
 */
export async function toggleAccountStatus(
	id: number,
	signal?: AbortSignal
): Promise<ToggleStatusResponse> {
	return apiFetch<ToggleStatusResponse>(`/api/account/${id}/toggle-status`, {
		method: 'POST',
		signal
	});
}

/**
 * Applies a balance correction to an account.
 * POST /api/account/{id}/correct-balance (RequireMasterAccountant)
 * Requires Idempotency-Key header for safe retry behavior.
 */
export async function correctAccountBalance(
	id: number,
	request: BalanceCorrectionRequest,
	idempotencyKey: string,
	signal?: AbortSignal
): Promise<BalanceCorrectionResponse> {
	return apiFetch<BalanceCorrectionResponse>(`/api/account/${id}/correct-balance`, {
		method: 'POST',
		body: JSON.stringify(request),
		headers: { 'Idempotency-Key': idempotencyKey },
		signal
	});
}
