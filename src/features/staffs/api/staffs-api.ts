import { apiFetch } from '$lib/api/api-client';
import type { StaffUserResponse, PortalType } from '../types/staff-types';

export async function fetchAccountsStaff(): Promise<StaffUserResponse[]> {
	const res = await apiFetch<StaffUserResponse[]>('api/staffs/accounts');
	return res || [];
}

export async function fetchSalesStaff(): Promise<StaffUserResponse[]> {
	const res = await apiFetch<StaffUserResponse[]>('api/staffs/sales');
	return res || [];
}

export async function fetchOperationalStaff(): Promise<StaffUserResponse[]> {
	const res = await apiFetch<StaffUserResponse[]>('api/staffs/operational');
	return res || [];
}

export async function createAccountsStaff(data: {
	name: string;
	email: string;
	password: string;
	role: string;
}): Promise<StaffUserResponse> {
	return await apiFetch<StaffUserResponse>('api/staffs/accounts', {
		method: 'POST',
		body: JSON.stringify(data)
	});
}

export async function createSalesStaff(data: {
	name: string;
	email: string;
	password: string;
	role: string;
}): Promise<{ message: string }> {
	return await apiFetch<{ message: string }>('api/staffs/sales', {
		method: 'POST',
		body: JSON.stringify(data)
	});
}

export async function createOperationalStaff(data: {
	name: string;
	email: string;
	password: string;
	role: string;
	permissions: string[];
}): Promise<{ message: string }> {
	return await apiFetch<{ message: string }>('api/staffs/operational', {
		method: 'POST',
		body: JSON.stringify(data)
	});
}

export async function updateOperationalPermissions(data: {
	name: string;
	email: string;
	userType: string;
	permissions: string[];
}): Promise<{ message: string }> {
	return await apiFetch<{ message: string }>('api/staffs/operational/permissions', {
		method: 'PUT',
		body: JSON.stringify(data)
	});
}

export async function updateStaffEmail(portal: PortalType, id: number, newEmail: string): Promise<{ message: string }> {
	return await apiFetch<{ message: string }>(`api/staffs/${portal}/${id}/email`, {
		method: 'PUT',
		body: JSON.stringify({ newEmail })
	});
}

export interface WorkloadLimit {
	id: number;
	entityType: string;
	maxActiveLimit: number;
	userId?: number | null;
}

export async function fetchWorkloadLimits(): Promise<WorkloadLimit[]> {
	const res = await apiFetch<WorkloadLimit[]>('api/staffs/workload-limits');
	return res || [];
}

export async function updateWorkloadLimits(limits: { entityType: string; maxActiveLimit: number }[]): Promise<{ message: string }> {
	return await apiFetch<{ message: string }>('api/staffs/workload-limits', {
		method: 'PUT',
		body: JSON.stringify({ limits })
	});
}

export async function updateSalesmanTargets(id: number, monthlyTarget: number, profitTarget: number): Promise<{ message: string }> {
	return await apiFetch<{ message: string }>(`api/staffs/sales/${id}/targets`, {
		method: 'PUT',
		body: JSON.stringify({ monthlyTarget, profitTarget })
	});
}
