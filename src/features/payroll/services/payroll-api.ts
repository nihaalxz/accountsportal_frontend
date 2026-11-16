import { apiFetch } from '$lib/api/api-client';
import type {
	UnifiedStaffUser,
	SalaryProfile,
	SalaryRevision,
	CreateSalaryProfilePayload,
	UpdateSalaryProfilePayload,
	SalaryPayment,
	CreateSalaryPaymentPayload,
	UpdateSalaryPaymentStatusPayload
} from '../types';

export async function getAllStaffUsers(signal?: AbortSignal): Promise<UnifiedStaffUser[]> {
	const userMap = new Map<string, UnifiedStaffUser>();

	const addUser = (u: any, defaultType: 'Account' | 'Sales' | 'Operational') => {
		if (!u) return;
		const rawId = u.portalUserId ?? u.id ?? u.Id;
		if (rawId === undefined || rawId === null) return;
		const id = Number(rawId);
		if (isNaN(id)) return;

		let pType: 'Account' | 'Sales' | 'Operational' = defaultType;
		const rawPortal = String(u.portalType || u.PortalType || '').toLowerCase();
		if (rawPortal.includes('sale')) pType = 'Sales';
		else if (rawPortal.includes('op')) pType = 'Operational';
		else if (rawPortal.includes('account')) pType = 'Account';

		const key = `${pType.toLowerCase()}_${id}`;
		if (!userMap.has(key)) {
			userMap.set(key, {
				portalUserId: id,
				portalType: pType,
				name: u.name || u.Name || `Staff #${id}`,
				email: u.email || u.Email || '',
				userType: u.userType || u.role || u.Role || pType
			});
		}
	};

	try {
		const [accRes, salesRes, opsRes] = await Promise.allSettled([
			apiFetch<any[]>('api/staffs/accounts', { signal }),
			apiFetch<any[]>('api/staffs/sales', { signal }),
			apiFetch<any[]>('api/staffs/operational', { signal })
		]);

		if (accRes.status === 'fulfilled' && Array.isArray(accRes.value)) {
			accRes.value.forEach((u) => addUser(u, 'Account'));
		}
		if (salesRes.status === 'fulfilled' && Array.isArray(salesRes.value)) {
			salesRes.value.forEach((u) => addUser(u, 'Sales'));
		}
		if (opsRes.status === 'fulfilled' && Array.isArray(opsRes.value)) {
			opsRes.value.forEach((u) => addUser(u, 'Operational'));
		}
	} catch (err) {
		console.error('Error fetching staff users:', err);
	}

	return Array.from(userMap.values());
}

export async function getSalaryProfiles(
	portalType?: string,
	status?: string,
	signal?: AbortSignal
): Promise<SalaryProfile[]> {
	const params = new URLSearchParams();
	if (portalType) params.append('portalType', portalType);
	if (status) params.append('status', status);
	const query = params.toString() ? `?${params.toString()}` : '';

	return apiFetch<SalaryProfile[]>(`api/Payroll/profiles${query}`, { signal });
}

export async function createSalaryProfile(
	payload: CreateSalaryProfilePayload,
	signal?: AbortSignal
): Promise<SalaryProfile> {
	return apiFetch<SalaryProfile>('api/Payroll/profiles', {
		method: 'POST',
		body: JSON.stringify(payload),
		signal
	});
}

export async function updateSalaryProfile(
	id: number,
	payload: UpdateSalaryProfilePayload,
	signal?: AbortSignal
): Promise<SalaryProfile> {
	return apiFetch<SalaryProfile>(`api/Payroll/profiles/${id}`, {
		method: 'PUT',
		body: JSON.stringify(payload),
		signal
	});
}

export async function getSalaryRevisions(
	id: number,
	signal?: AbortSignal
): Promise<SalaryRevision[]> {
	return apiFetch<SalaryRevision[]>(`api/Payroll/profiles/${id}/revisions`, { signal });
}

export async function getSalaryPayments(
	status?: string,
	month?: number,
	year?: number,
	portalType?: string,
	signal?: AbortSignal
): Promise<SalaryPayment[]> {
	const params = new URLSearchParams();
	if (status) params.append('status', status);
	if (month) params.append('month', month.toString());
	if (year) params.append('year', year.toString());
	if (portalType) params.append('portalType', portalType);
	const query = params.toString() ? `?${params.toString()}` : '';

	return apiFetch<SalaryPayment[]>(`api/Payroll/payments${query}`, { signal });
}

export async function createSalaryPayment(
	payload: CreateSalaryPaymentPayload,
	signal?: AbortSignal
): Promise<SalaryPayment> {
	return apiFetch<SalaryPayment>('api/Payroll/payments', {
		method: 'POST',
		body: JSON.stringify(payload),
		signal
	});
}

export async function updateSalaryPaymentStatus(
	id: number,
	payload: UpdateSalaryPaymentStatusPayload,
	signal?: AbortSignal
): Promise<SalaryPayment> {
	return apiFetch<SalaryPayment>(`api/Payroll/payments/${id}/status`, {
		method: 'PUT',
		body: JSON.stringify(payload),
		signal
	});
}
