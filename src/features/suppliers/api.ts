/**
 * Suppliers Feature API client.
 * Calls backend endpoints via centralized apiFetch.
 */

import { apiFetch } from '$lib/api/api-client';
import type {
	SupplierResponse,
	CreateSupplierRequest,
	UpdateSupplierRequest,
	SupplierPaymentResponse,
	CreateSupplierPaymentRequest,
	RejectSupplierPaymentRequest,
	GlReconciliationReportResponse,
	TransactionResponse,
	PurchaseReturnResponse,
	CreatePurchaseReturnRequest,
	SalesReturnResponse,
	CreateSalesReturnRequest
} from './types';

// Supplier CRUD
export async function getSuppliers(signal?: AbortSignal): Promise<SupplierResponse[]> {
	return apiFetch<SupplierResponse[]>('/api/Supplier', { signal });
}

export async function createSupplier(
	data: CreateSupplierRequest,
	signal?: AbortSignal
): Promise<SupplierResponse> {
	return apiFetch<SupplierResponse>('/api/Supplier', {
		method: 'POST',
		body: JSON.stringify(data),
		signal
	});
}

export async function updateSupplier(
	id: number,
	data: UpdateSupplierRequest,
	signal?: AbortSignal
): Promise<void> {
	return apiFetch<void>(`/api/Supplier/${id}`, {
		method: 'PUT',
		body: JSON.stringify(data),
		signal
	});
}

// Supplier Payments
export async function getSupplierPayments(
	options: { status?: string; supplierId?: number } = {},
	signal?: AbortSignal
): Promise<SupplierPaymentResponse[]> {
	return apiFetch<SupplierPaymentResponse[]>('/api/supplier-payments', {
		params: options,
		signal
	});
}

export async function createSupplierPayment(
	data: CreateSupplierPaymentRequest,
	idempotencyKey?: string,
	signal?: AbortSignal
): Promise<SupplierPaymentResponse> {
	return apiFetch<SupplierPaymentResponse>('/api/supplier-payments', {
		method: 'POST',
		body: JSON.stringify(data),
		idempotencyKey,
		signal
	});
}

export async function updateSupplierPayment(
	id: number,
	data: {
		amount: number;
		referenceNumber?: string | null;
		description?: string | null;
		supplierId?: number | null;
		paymentMethod?: string | null;
		sourceAccountId?: string | null;
	},
	signal?: AbortSignal
): Promise<SupplierPaymentResponse> {
	return apiFetch<SupplierPaymentResponse>(`/api/supplier-payments/${id}`, {
		method: 'PUT',
		body: JSON.stringify(data),
		signal
	});
}

export async function approveSupplierPayment(
	id: number,
	rowVersion?: string,
	signal?: AbortSignal
): Promise<SupplierPaymentResponse> {
	const headers: Record<string, string> = {};
	if (rowVersion) {
		headers['Row-Version'] = rowVersion;
	}
	return apiFetch<SupplierPaymentResponse>(`/api/supplier-payments/${id}/approve`, {
		method: 'POST',
		headers,
		signal
	});
}

export async function rejectSupplierPayment(
	id: number,
	reason: string,
	signal?: AbortSignal
): Promise<SupplierPaymentResponse> {
	return apiFetch<SupplierPaymentResponse>(`/api/supplier-payments/${id}/reject`, {
		method: 'POST',
		body: JSON.stringify({ reason }),
		signal
	});
}

export async function getPendingPaymentBookings(signal?: AbortSignal): Promise<any[]> {
	return apiFetch<any[]>('/api/supplier-payments/pending-bookings', { signal });
}

// Purchase Returns
export async function getPurchaseReturns(
	options: { status?: string; supplierId?: number } = {},
	signal?: AbortSignal
): Promise<PurchaseReturnResponse[]> {
	return apiFetch<PurchaseReturnResponse[]>('/api/purchase-returns', {
		params: options,
		signal
	});
}

export async function createPurchaseReturn(
	data: CreatePurchaseReturnRequest,
	idempotencyKey?: string,
	signal?: AbortSignal
): Promise<PurchaseReturnResponse> {
	return apiFetch<PurchaseReturnResponse>('/api/purchase-returns', {
		method: 'POST',
		body: JSON.stringify(data),
		idempotencyKey,
		signal
	});
}

export async function approvePurchaseReturn(
	id: number,
	rowVersion?: string,
	signal?: AbortSignal
): Promise<PurchaseReturnResponse> {
	const headers: Record<string, string> = {};
	if (rowVersion) {
		headers['Row-Version'] = rowVersion;
	}
	return apiFetch<PurchaseReturnResponse>(`/api/purchase-returns/${id}/approve`, {
		method: 'POST',
		headers,
		signal
	});
}

export async function rejectPurchaseReturn(
	id: number,
	reason: string,
	signal?: AbortSignal
): Promise<PurchaseReturnResponse> {
	return apiFetch<PurchaseReturnResponse>(`/api/purchase-returns/${id}/reject`, {
		method: 'POST',
		body: JSON.stringify({ reason }),
		signal
	});
}

// Sales Returns
export async function getSalesReturns(
	options: { status?: string } = {},
	signal?: AbortSignal
): Promise<SalesReturnResponse[]> {
	return apiFetch<SalesReturnResponse[]>('/api/sales-returns', {
		params: options,
		signal
	});
}

export async function createSalesReturn(
	data: CreateSalesReturnRequest,
	idempotencyKey?: string,
	signal?: AbortSignal
): Promise<SalesReturnResponse> {
	return apiFetch<SalesReturnResponse>('/api/sales-returns', {
		method: 'POST',
		body: JSON.stringify(data),
		idempotencyKey,
		signal
	});
}

export async function approveSalesReturn(
	id: number,
	rowVersion?: string,
	signal?: AbortSignal
): Promise<SalesReturnResponse> {
	const headers: Record<string, string> = {};
	if (rowVersion) {
		headers['Row-Version'] = rowVersion;
	}
	return apiFetch<SalesReturnResponse>(`/api/sales-returns/${id}/approve`, {
		method: 'POST',
		headers,
		signal
	});
}

export async function rejectSalesReturn(
	id: number,
	reason: string,
	signal?: AbortSignal
): Promise<SalesReturnResponse> {
	return apiFetch<SalesReturnResponse>(`/api/sales-returns/${id}/reject`, {
		method: 'POST',
		body: JSON.stringify({ reason }),
		signal
	});
}

// Statements
export async function getSupplierStatement(
	supplierId: number,
	options: { startDate?: string; endDate?: string; page?: number; pageSize?: number } = {},
	signal?: AbortSignal
): Promise<TransactionResponse[]> {
	const params: Record<string, string | number> = {
		page: options.page || 1,
		pageSize: options.pageSize || 20
	};
	if (options.startDate) params.startDate = options.startDate;
	if (options.endDate) params.endDate = options.endDate;

	return apiFetch<TransactionResponse[]>(`/api/reconciliation/supplier-statement/${supplierId}`, {
		params,
		signal
	});
}

// Reconciliation summary
export async function getGlReconciliation(
	signal?: AbortSignal
): Promise<GlReconciliationReportResponse> {
	return apiFetch<GlReconciliationReportResponse>('/api/reconciliation/gl-reconciliation', { signal });
}

// Booking processing status (Completion / Unlock)
export async function updateBookingProcessingStatus(
	serviceType: string,
	id: number | string,
	status: string,
	signal?: AbortSignal
): Promise<{ success: boolean; status: string }> {
	return apiFetch<{ success: boolean; status: string }>(`/api/sales-entries/${encodeURIComponent(serviceType)}/${id}/processing-status`, {
		method: 'POST',
		body: JSON.stringify({ status }),
		signal
	});
}

// Booking operation closed (Operational Unlock)
export async function updateBookingOperationClosed(
	serviceType: string,
	id: number | string,
	operationClosed: boolean,
	signal?: AbortSignal
): Promise<{ success: boolean; operationClosed: boolean }> {
	return apiFetch<{ success: boolean; operationClosed: boolean }>(
		`/api/sales-entries/${encodeURIComponent(serviceType)}/${id}/operation-closed`,
		{
			method: 'POST',
			body: JSON.stringify({ operationClosed }),
			signal
		}
	);
}
