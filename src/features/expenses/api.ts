import { apiFetch } from '$lib/api/api-client';
import type {
	ExpenseResponse,
	CreateExpenseRequest,
	RejectExpenseRequest,
	ExpenseHeaderResponse,
	CreateExpenseHeaderRequest,
	ExpenseSummaryResponse
} from './types';

const BASE = '/api/expenses';

/** GET /api/expenses/headers */
export async function getExpenseHeaders(signal?: AbortSignal): Promise<ExpenseHeaderResponse[]> {
	return apiFetch<ExpenseHeaderResponse[]>(`${BASE}/headers`, { signal });
}

/** POST /api/expenses/headers — RequireMasterAccountant */
export async function createExpenseHeader(
	data: CreateExpenseHeaderRequest,
	signal?: AbortSignal
): Promise<ExpenseHeaderResponse> {
	return apiFetch<ExpenseHeaderResponse>(`${BASE}/headers`, {
		method: 'POST',
		body: JSON.stringify(data),
		signal
	});
}

/** GET /api/expenses/summary */
export async function getExpenseSummary(signal?: AbortSignal): Promise<ExpenseSummaryResponse> {
	return apiFetch<ExpenseSummaryResponse>(`${BASE}/summary`, { signal });
}

/** GET /api/expenses */
export async function getExpenses(signal?: AbortSignal): Promise<ExpenseResponse[]> {
	return apiFetch<ExpenseResponse[]>(BASE, { signal });
}

/** GET /api/expenses/{id} */
export async function getExpenseById(id: number, signal?: AbortSignal): Promise<ExpenseResponse> {
	return apiFetch<ExpenseResponse>(`${BASE}/${id}`, { signal });
}

/** POST /api/expenses — RequireAccountant */
export async function createExpense(
	data: CreateExpenseRequest,
	signal?: AbortSignal
): Promise<ExpenseResponse> {
	return apiFetch<ExpenseResponse>(BASE, {
		method: 'POST',
		body: JSON.stringify(data),
		signal
	});
}

/** POST /api/expenses/{id}/submit — RequireAccountant */
export async function submitExpense(id: number, signal?: AbortSignal): Promise<ExpenseResponse> {
	return apiFetch<ExpenseResponse>(`${BASE}/${id}/submit`, {
		method: 'POST',
		signal
	});
}

/** POST /api/expenses/{id}/approve — RequireMasterAccountant */
export async function approveExpense(
	id: number,
	idempotencyKey?: string,
	rowVersion?: string | null,
	signal?: AbortSignal
): Promise<ExpenseResponse> {
	const key = idempotencyKey || `ApproveExpense_${id}_${Date.now()}`;
	const headers: Record<string, string> = {
		'Idempotency-Key': key
	};
	if (rowVersion) {
		headers['Row-Version'] = rowVersion;
	}

	return apiFetch<ExpenseResponse>(`${BASE}/${id}/approve`, {
		method: 'POST',
		headers,
		signal
	});
}

/** POST /api/expenses/{id}/reject — RequireMasterAccountant */
export async function rejectExpense(
	id: number,
	data: RejectExpenseRequest,
	signal?: AbortSignal
): Promise<ExpenseResponse> {
	return apiFetch<ExpenseResponse>(`${BASE}/${id}/reject`, {
		method: 'POST',
		body: JSON.stringify(data),
		signal
	});
}

/** POST /api/expenses/{id}/cancel — RequireAccountant */
export async function cancelExpense(id: number, signal?: AbortSignal): Promise<ExpenseResponse> {
	return apiFetch<ExpenseResponse>(`${BASE}/${id}/cancel`, {
		method: 'POST',
		signal
	});
}
