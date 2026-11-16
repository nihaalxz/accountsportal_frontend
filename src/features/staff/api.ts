/**
 * Staff Feature API client.
 * Calls backend endpoints via centralized apiFetch.
 */

import { apiFetch } from '$lib/api/api-client';
import type {
	StaffCompensationProfileResponse,
	CreateStaffCompensationProfileRequest,
	SalaryComponentResponse,
	CreateSalaryComponentRequest,
	UpdateSalaryComponentRequest,
	StaffAdvanceResponse,
	RequestStaffAdvanceRequest,
	StaffLoanResponse,
	RequestStaffLoanRequest,
	ReimbursementResponse,
	SubmitReimbursementRequest,
	PayReimbursementIndependentRequest
} from './types';

// Compensation Profiles
export async function getActiveCompensationProfile(
	staffId: number,
	date?: string,
	signal?: AbortSignal
): Promise<StaffCompensationProfileResponse> {
	return apiFetch<StaffCompensationProfileResponse>(
		`/api/StaffCompensationProfiles/staff/${staffId}`,
		{
			params: date ? { date } : undefined,
			signal
		}
	);
}

export async function createCompensationProfile(
	data: CreateStaffCompensationProfileRequest,
	signal?: AbortSignal
): Promise<StaffCompensationProfileResponse> {
	return apiFetch<StaffCompensationProfileResponse>('/api/StaffCompensationProfiles', {
		method: 'POST',
		body: JSON.stringify(data),
		signal
	});
}

// Salary Components
export async function getSalaryComponents(
	page = 1,
	pageSize = 50,
	sortBy?: string,
	desc = false,
	signal?: AbortSignal
): Promise<SalaryComponentResponse[]> {
	return apiFetch<SalaryComponentResponse[]>('/api/SalaryComponents', {
		params: { page, pageSize, sortBy, desc },
		signal
	});
}

export async function getSalaryComponentById(
	id: number,
	signal?: AbortSignal
): Promise<SalaryComponentResponse> {
	return apiFetch<SalaryComponentResponse>(`/api/SalaryComponents/${id}`, { signal });
}

export async function createSalaryComponent(
	data: CreateSalaryComponentRequest,
	signal?: AbortSignal
): Promise<SalaryComponentResponse> {
	return apiFetch<SalaryComponentResponse>('/api/SalaryComponents', {
		method: 'POST',
		body: JSON.stringify(data),
		signal
	});
}

export async function updateSalaryComponent(
	id: number,
	data: UpdateSalaryComponentRequest,
	signal?: AbortSignal
): Promise<SalaryComponentResponse> {
	return apiFetch<SalaryComponentResponse>(`/api/SalaryComponents/${id}`, {
		method: 'PUT',
		body: JSON.stringify(data),
		signal
	});
}

export async function activateSalaryComponent(
	id: number,
	signal?: AbortSignal
): Promise<SalaryComponentResponse> {
	return apiFetch<SalaryComponentResponse>(`/api/SalaryComponents/${id}/activate`, {
		method: 'POST',
		signal
	});
}

export async function deactivateSalaryComponent(
	id: number,
	signal?: AbortSignal
): Promise<SalaryComponentResponse> {
	return apiFetch<SalaryComponentResponse>(`/api/SalaryComponents/${id}/deactivate`, {
		method: 'POST',
		signal
	});
}

// Staff Advances
export async function getStaffAdvances(
	staffId: number,
	signal?: AbortSignal
): Promise<StaffAdvanceResponse[]> {
	return apiFetch<StaffAdvanceResponse[]>(`/api/StaffAdvances/staff/${staffId}`, { signal });
}

export async function requestStaffAdvance(
	data: RequestStaffAdvanceRequest,
	signal?: AbortSignal
): Promise<StaffAdvanceResponse> {
	return apiFetch<StaffAdvanceResponse>('/api/StaffAdvances', {
		method: 'POST',
		body: JSON.stringify(data),
		signal
	});
}

export async function disburseStaffAdvance(
	id: number,
	signal?: AbortSignal
): Promise<StaffAdvanceResponse> {
	return apiFetch<StaffAdvanceResponse>(`/api/StaffAdvances/${id}/disburse`, {
		method: 'POST',
		signal
	});
}

// Staff Loans
export async function getStaffLoans(
	staffId: number,
	signal?: AbortSignal
): Promise<StaffLoanResponse[]> {
	return apiFetch<StaffLoanResponse[]>(`/api/StaffLoans/staff/${staffId}`, { signal });
}

export async function requestStaffLoan(
	data: RequestStaffLoanRequest,
	signal?: AbortSignal
): Promise<StaffLoanResponse> {
	return apiFetch<StaffLoanResponse>('/api/StaffLoans', {
		method: 'POST',
		body: JSON.stringify(data),
		signal
	});
}

export async function disburseStaffLoan(
	id: number,
	signal?: AbortSignal
): Promise<StaffLoanResponse> {
	return apiFetch<StaffLoanResponse>(`/api/StaffLoans/${id}/disburse`, {
		method: 'POST',
		signal
	});
}

// Staff Reimbursements
export async function getStaffReimbursements(
	staffId: number,
	signal?: AbortSignal
): Promise<ReimbursementResponse[]> {
	return apiFetch<ReimbursementResponse[]>(`/api/StaffReimbursements/staff/${staffId}`, { signal });
}

export async function submitReimbursement(
	data: SubmitReimbursementRequest,
	signal?: AbortSignal
): Promise<ReimbursementResponse> {
	return apiFetch<ReimbursementResponse>('/api/StaffReimbursements', {
		method: 'POST',
		body: JSON.stringify(data),
		signal
	});
}

export async function approveReimbursement(
	id: number,
	signal?: AbortSignal
): Promise<ReimbursementResponse> {
	return apiFetch<ReimbursementResponse>(`/api/StaffReimbursements/${id}/approve`, {
		method: 'POST',
		signal
	});
}

export async function rejectReimbursement(
	id: number,
	signal?: AbortSignal
): Promise<ReimbursementResponse> {
	return apiFetch<ReimbursementResponse>(`/api/StaffReimbursements/${id}/reject`, {
		method: 'POST',
		signal
	});
}

export async function payReimbursementIndependent(
	id: number,
	data: PayReimbursementIndependentRequest,
	signal?: AbortSignal
): Promise<ReimbursementResponse> {
	return apiFetch<ReimbursementResponse>(`/api/StaffReimbursements/${id}/pay`, {
		method: 'POST',
		body: JSON.stringify(data),
		signal
	});
}
