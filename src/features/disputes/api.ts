import { apiFetch } from '$lib/api/api-client';
import type {
	DisputeResponse,
	DisputesDashboardResponse,
	DisputeDecisionRequest,
	DisputesQuery,
	PagedResponse
} from './types';

export async function getDisputes(
	query?: DisputesQuery,
	signal?: AbortSignal
): Promise<PagedResponse<DisputeResponse>> {
	const params = new URLSearchParams();
	if (query?.page) params.append('page', query.page.toString());
	if (query?.pageSize) params.append('pageSize', query.pageSize.toString());
	if (query?.status) params.append('status', query.status);
	if (query?.search) params.append('search', query.search);
	if (query?.sort) params.append('sort', query.sort);

	const queryString = params.toString();
	const url = queryString ? `/api/disputes?${queryString}` : '/api/disputes';
	return apiFetch<PagedResponse<DisputeResponse>>(url, { signal });
}

export async function getDisputesDashboard(
	signal?: AbortSignal
): Promise<DisputesDashboardResponse> {
	return apiFetch<DisputesDashboardResponse>('/api/disputes/dashboard', { signal });
}

export async function getDisputeById(
	id: number,
	signal?: AbortSignal
): Promise<DisputeResponse> {
	return apiFetch<DisputeResponse>(`/api/disputes/${id}`, { signal });
}

export async function submitDisputeDecision(
	id: number,
	request: DisputeDecisionRequest
): Promise<DisputeResponse> {
	return apiFetch<DisputeResponse>(`/api/disputes/${id}/decision`, {
		method: 'POST',
		body: JSON.stringify(request)
	});
}
