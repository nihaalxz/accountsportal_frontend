/**
 * Journal Entries API client.
 * Uses centralized apiFetch.
 */

import { apiFetch } from '$lib/api/api-client';
import type {
	JournalEntryResponse,
	CreateJournalEntryRequest
} from './types';

const BASE = '/api/journalentries';

/** GET /api/journalentries */
export async function getJournalEntries(signal?: AbortSignal): Promise<JournalEntryResponse[]> {
	return apiFetch<JournalEntryResponse[]>(BASE, { signal });
}

/** GET /api/journalentries/{id} */
export async function getJournalEntryById(
	id: number,
	signal?: AbortSignal
): Promise<JournalEntryResponse> {
	return apiFetch<JournalEntryResponse>(`${BASE}/${id}`, { signal });
}

/** POST /api/journalentries — RequireAccountant */
export async function createJournalEntry(
	data: CreateJournalEntryRequest,
	signal?: AbortSignal
): Promise<JournalEntryResponse> {
	return apiFetch<JournalEntryResponse>(BASE, {
		method: 'POST',
		body: JSON.stringify(data),
		signal
	});
}

/** POST /api/journalentries/{id}/approve — RequireMasterAccountant */
export async function approveJournalEntry(
	id: number,
	idempotencyKey: string,
	rowVersion?: string,
	signal?: AbortSignal
): Promise<JournalEntryResponse> {
	const headers: Record<string, string> = {
		'Idempotency-Key': idempotencyKey
	};
	if (rowVersion) {
		headers['Row-Version'] = rowVersion;
	}

	return apiFetch<JournalEntryResponse>(`${BASE}/${id}/approve`, {
		method: 'POST',
		headers,
		signal
	});
}

/** POST /api/journalentries/{id}/reject — RequireMasterAccountant */
export async function rejectJournalEntry(
	id: number,
	signal?: AbortSignal
): Promise<JournalEntryResponse> {
	return apiFetch<JournalEntryResponse>(`${BASE}/${id}/reject`, {
		method: 'POST',
		signal
	});
}
