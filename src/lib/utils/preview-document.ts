import { BACKEND_API_URL, SALES_PORTAL_API_URL } from '$lib/config';

/**
 * Universal document preview and print helper.
 * Generates a server-side rendered PDF with logo and opens it in a new tab for native preview & printing.
 */
export async function previewDocument(
	category: 'invoice' | 'list' | 'report' | 'receipt',
	type: string,
	idOrFilters?: number | string | Record<string, any>,
	filters?: Record<string, any>
): Promise<void> {
	const rawType = String(type || '').trim();
	const cleanType = rawType.toLowerCase().replace(/_/g, '-');

	let endpoint = '';
	let params: Record<string, any> = {};
	let baseUrl = '';

	if (category === ('quotation' as any) || cleanType.includes('quotation')) {
		baseUrl = BACKEND_API_URL || 'http://localhost:5028';
		const id = typeof idOrFilters === 'number' || typeof idOrFilters === 'string' ? idOrFilters : (filters as any)?.id || '';
		endpoint = `/api/sales-entries/quotations/${id}/pdf`;
	} else if (cleanType.includes('accounts-receipt')) {
		baseUrl = BACKEND_API_URL || 'http://localhost:5028';
		if (category === 'list' || category === 'report') {
			endpoint = `/api/documents/list/accounts-receipt`;
			params = (idOrFilters as Record<string, any>) || filters || {};
		} else {
			const id = typeof idOrFilters === 'number' || typeof idOrFilters === 'string' ? idOrFilters : (filters as any)?.id || '';
			endpoint = `/api/documents/receipt/${id}`;
		}
	} else if (category === 'invoice' || category === 'receipt') {
		baseUrl = SALES_PORTAL_API_URL || 'http://localhost:5003';
		let normalizedType = cleanType;
		if (cleanType.includes('flight')) normalizedType = 'flight';
		else if (cleanType.includes('hotel')) normalizedType = 'hotel';
		else if (cleanType.includes('visa')) normalizedType = 'visa';
		else if (cleanType.includes('vfs')) normalizedType = 'vfs';
		else if (cleanType.includes('holiday')) normalizedType = 'holiday';
		else if (cleanType.includes('transport')) normalizedType = 'transport';
		else if (cleanType.includes('other')) normalizedType = 'other';
		else if (cleanType.includes('receipt')) normalizedType = 'receipt';

		const id = idOrFilters;
		endpoint = `/api/documents/invoice/${normalizedType}/${id}`;
	} else if (category === 'list') {
		baseUrl = SALES_PORTAL_API_URL || 'http://localhost:5003';
		let normalizedType = cleanType;
		if (cleanType.includes('flight')) normalizedType = 'flight';
		else if (cleanType.includes('hotel')) normalizedType = 'hotel';
		else if (cleanType.includes('visa')) normalizedType = 'visa';
		else if (cleanType.includes('vfs')) normalizedType = 'vfs';
		else if (cleanType.includes('holiday')) normalizedType = 'holiday';
		else if (cleanType.includes('transport')) normalizedType = 'transport';
		else if (cleanType.includes('other')) normalizedType = 'other';
		else if (cleanType.includes('receipt')) normalizedType = 'receipt';
		else if (cleanType.includes('ledger')) normalizedType = 'ledger';

		endpoint = `/api/documents/list/${normalizedType}`;
		params = (idOrFilters as Record<string, any>) || filters || {};
	} else {
		// category === 'report'
		baseUrl = BACKEND_API_URL || 'http://localhost:5028';
		let normalizedType = cleanType;
		if (cleanType.includes('bank')) normalizedType = 'bank-statement';
		else if (cleanType.includes('account') && !cleanType.includes('salesman')) normalizedType = 'account-statement';
		else if (cleanType.includes('sales-ledger') || cleanType.includes('customer-ledger') || cleanType === 'ledger') normalizedType = 'sales-ledger';
		else if (cleanType.includes('supplier')) normalizedType = 'supplier-statement';
		else if (cleanType.includes('salesmen-summary') || cleanType.includes('salesman-summary')) normalizedType = 'salesmen-summary';
		else if (cleanType.includes('salesman-detail')) normalizedType = 'salesman-detail';
		else if (cleanType.includes('payment') || cleanType.includes('expense')) normalizedType = 'payments';
		else if (cleanType.includes('transaction') || cleanType.includes('return')) normalizedType = 'transactions';
		else if (cleanType.includes('approval') || cleanType.includes('pending')) normalizedType = 'pending-approvals';
		else if (cleanType.includes('profit') || cleanType.includes('pnl')) normalizedType = 'profit-loss-operational';

		endpoint = `/api/documents/report/${normalizedType}`;
		if (typeof idOrFilters === 'number' || typeof idOrFilters === 'string') {
			params = { entityId: idOrFilters, ...(filters || {}) };
		} else {
			params = (idOrFilters as Record<string, any>) || filters || {};
		}
	}

	// Construct target URL for direct native PDF viewing
	const targetUrl = new URL(
		endpoint.startsWith('/') ? endpoint.slice(1) : endpoint,
		baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
	);
	if (params) {
		Object.entries(params).forEach(([k, v]) => {
			if (v !== undefined && v !== null && v !== '') {
				targetUrl.searchParams.append(k, String(v));
			}
		});
	}

	// Navigate or open directly in the browser's native full-page PDF viewer
	window.open(targetUrl.toString(), '_blank');
}
