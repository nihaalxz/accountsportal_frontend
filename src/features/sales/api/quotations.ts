import { apiFetch, apiFetchBlob } from '$lib/api/api-client';
import { BACKEND_API_URL } from '$lib/config';

export interface QuotationItem {
  id?: number | string;
  serviceType: string;
  description: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
}

export interface QuotationSummary {
  id: number;
  documentNumber: string;
  userId: number;
  salesmanName: string;
  headId?: number | null;
  clientType: 'customer' | 'agent' | string;
  customerName: string;
  customerContact?: string | null;
  customerEmail?: string | null;
  itemsCount: number;
  totalAmount: number;
  status: string;
  createdAt: string;
}

export interface QuotationDetail {
  id: number;
  documentNumber: string;
  userId: number;
  salesmanName: string;
  headId?: number | null;
  clientType: 'customer' | 'agent' | string;
  customerName: string;
  customerContact?: string | null;
  customerEmail?: string | null;
  totalAmount: number;
  status: string;
  remarks?: string | null;
  createdAt: string;
  items: QuotationItem[];
}

export interface QuotationsFilterQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  clientType?: string;
  status?: string;
  salesmanId?: number;
  startDate?: string;
  endDate?: string;
}

export interface PagedQuotationsResponse {
  items: QuotationSummary[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNextPage?: boolean;
  hasPreviousPage?: boolean;
}

export async function getQuotations(params: QuotationsFilterQuery = {}, signal?: AbortSignal): Promise<PagedQuotationsResponse> {
  const q = new URLSearchParams();
  if (params.page) q.append('page', params.page.toString());
  if (params.pageSize) q.append('pageSize', params.pageSize.toString());
  if (params.search) q.append('search', params.search);
  if (params.clientType && params.clientType !== 'all') q.append('clientType', params.clientType);
  if (params.status && params.status !== 'all') q.append('status', params.status);
  if (params.salesmanId) q.append('salesmanId', params.salesmanId.toString());
  if (params.startDate) q.append('startDate', params.startDate);
  if (params.endDate) q.append('endDate', params.endDate);

  const qs = q.toString();
  return apiFetch<PagedQuotationsResponse>(`api/sales-entries/quotations${qs ? '?' + qs : ''}`, { signal });
}

export async function getQuotationById(idOrDoc: string | number, signal?: AbortSignal): Promise<QuotationDetail> {
  return apiFetch<QuotationDetail>(`api/sales-entries/quotations/${idOrDoc}`, { signal });
}

export async function updateQuotationStatus(idOrDoc: string | number, status: string, note?: string): Promise<{ success: boolean; status: string }> {
  return apiFetch<{ success: boolean; status: string }>(`api/sales-entries/quotations/${idOrDoc}/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status, note })
  });
}

export async function downloadQuotationPdf(idOrDoc: string | number, documentNumber?: string): Promise<void> {
  const blob = await apiFetchBlob(`api/sales-entries/quotations/${idOrDoc}/pdf`, {
    baseUrl: BACKEND_API_URL || 'http://localhost:5028'
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${documentNumber || idOrDoc}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
