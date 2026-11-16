export interface DisputeResponse {
	id: number;
	documentNumber?: string | null;
	disputableDocumentNumber?: string | null;
	userId: number;
	headId: number | null;
	headName: string | null;
	disputableId: number;
	disputableType: string;
	subject: string;
	description: string;
	status: string;
	resolution: string | null;
	resolutionNote: string | null;
	resolvedBy: string | null;
	resolvedAt: string | null;
	isRefund: boolean;
	refundAmount: number | null;
	approvedRefundAmount: number | null;
	refundProcessed: boolean;
	refundStatus: string | null;
	refundDate: string | null;
	createdAt: string | null;
	salesmanName?: string | null;
	bookingPayableAmount?: number | null;
	bookingSupplierCost?: number | null;
	headWallet?: number | null;
	name?: string | null;
	iban?: string | null;
}

export interface DisputesDashboardResponse {
	total: number;
	pending: number;
	resolved: number;
	rejected: number;
	requestedRefundAmount: number;
	approvedRefundAmount: number;
}

export interface DisputeDecisionRequest {
	decision: 'approve' | 'reject';
	approvedRefundAmount?: number | null;
	resolution?: string | null;
}

export interface DisputesQuery {
	page?: number;
	pageSize?: number;
	status?: string;
	search?: string;
	sort?: string;
}

export interface PagedResponse<T> {
	items: T[];
	totalCount: number;
	page: number;
	pageSize: number;
	totalPages: number;
}
