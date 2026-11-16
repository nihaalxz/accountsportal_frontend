import { apiFetch } from '$lib/api/api-client';

export interface VisaCountryResponse {
	id: number;
	name: string;
	code: string | null;
	isActive: boolean;
	packagesCount: number;
	createdAt: string;
	updatedAt: string | null;
}

export interface CreateVisaCountryRequest {
	name: string;
	code?: string | null;
}

export interface UpdateVisaCountryRequest {
	name: string;
	code?: string | null;
	isActive: boolean;
}

export interface VisaPackageResponse {
	id: number;
	countryId: number;
	countryName: string;
	name: string;
	description: string | null;
	isActive: boolean;
	createdAt: string;
	updatedAt: string | null;
}

export interface CreateVisaPackageRequest {
	countryId: number;
	name: string;
	description?: string | null;
}

export interface UpdateVisaPackageRequest {
	countryId: number;
	name: string;
	description?: string | null;
	isActive: boolean;
}

const BASE = 'api/visa-master';

// ─── Visa Countries ─────────────────────────────────────────────────────────

export async function getVisaCountries(includeInactive = true): Promise<VisaCountryResponse[]> {
	return apiFetch<VisaCountryResponse[]>(`${BASE}/countries?includeInactive=${includeInactive}`);
}

export async function createVisaCountry(data: CreateVisaCountryRequest): Promise<VisaCountryResponse> {
	return apiFetch<VisaCountryResponse>(`${BASE}/countries`, {
		method: 'POST',
		body: JSON.stringify(data)
	});
}

export async function updateVisaCountry(id: number, data: UpdateVisaCountryRequest): Promise<VisaCountryResponse> {
	return apiFetch<VisaCountryResponse>(`${BASE}/countries/${id}`, {
		method: 'PUT',
		body: JSON.stringify(data)
	});
}

export async function deleteVisaCountry(id: number): Promise<void> {
	return apiFetch<void>(`${BASE}/countries/${id}`, {
		method: 'DELETE'
	});
}

// ─── Visa Packages ──────────────────────────────────────────────────────────

export async function getVisaPackages(countryId?: number, includeInactive = true): Promise<VisaPackageResponse[]> {
	let url = `${BASE}/packages?includeInactive=${includeInactive}`;
	if (countryId) {
		url += `&countryId=${countryId}`;
	}
	return apiFetch<VisaPackageResponse[]>(url);
}

export async function createVisaPackage(data: CreateVisaPackageRequest): Promise<VisaPackageResponse> {
	return apiFetch<VisaPackageResponse>(`${BASE}/packages`, {
		method: 'POST',
		body: JSON.stringify(data)
	});
}

export async function updateVisaPackage(id: number, data: UpdateVisaPackageRequest): Promise<VisaPackageResponse> {
	return apiFetch<VisaPackageResponse>(`${BASE}/packages/${id}`, {
		method: 'PUT',
		body: JSON.stringify(data)
	});
}

export async function deleteVisaPackage(id: number): Promise<void> {
	return apiFetch<void>(`${BASE}/packages/${id}`, {
		method: 'DELETE'
	});
}
