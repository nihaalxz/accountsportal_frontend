/**
 * Financial transaction API responses and request types.
 * Derived from actual backend TransactionContracts.cs
 */

export interface PartyDto {
	type: string;
	id: number;
	name: string;
}

export interface GlPostingLineDto {
	accountId: number;
	accountCode: string;
	accountName: string;
	debit: number;
	credit: number;
	entryType: string;
	description?: string | null;
}

/** Response from GET /api/transaction and POST /api/transaction/{type} */
export interface TransactionResponse {
	id: number;
	transactionType: string;
	sourceAccountId: number | null;
	destinationAccountId: number | null;
	sourceBankId: number | null;
	destinationBankId: number | null;
	amount: number;
	balanceAfter: number | null;
	paymentMethod: string;
	referenceType: string | null;
	referenceId: string | null;
	description: string | null;
	status: string;
	approvedBy: number | null;
	approvedAt: string | null;
	rejectedBy: number | null;
	rejectedAt: string | null;
	returnReason: string | null;
	supplierId: number | null;
	supplierName: string | null;
	expenseHeaderId: number | null;
	createdBy: number;
	createdAt: string;
	createdByName?: string | null;
	approvedByName?: string | null;
	rejectedByName?: string | null;
	sourceAccountName?: string | null;
	destinationAccountName?: string | null;
	sourceBankName?: string | null;
	destinationBankName?: string | null;
	direction?: string | null;
	displayNarrative?: string | null;
	sourceParty?: PartyDto | null;
	destinationParty?: PartyDto | null;
	paymentMethodName?: string | null;
	referenceDisplayName?: string | null;
	referenceUrl?: string | null;
	correlationId?: string | null;
	recipientType?: string | null;
	recipientId?: number | null;
	recipientName?: string | null;
	glPostings?: GlPostingLineDto[] | null;
	documentNumber: string;
	displayDescription?: string | null;
	displayRecipientName?: string | null;
}

/** Request body for POST /api/transaction/incoming */
export interface CreateIncomingTransactionRequest {
	destinationAccountId?: number | null;
	destinationBankId?: number | null;
	amount: number;
	paymentMethod: string;
	referenceType?: string | null;
	referenceId?: string | null;
	description?: string | null;
	recipientType?: string | null;
	recipientId?: number | null;
}

/** Request body for POST /api/transaction/outgoing */
export interface CreateOutgoingTransactionRequest {
	sourceAccountId?: number | null;
	sourceBankId?: number | null;
	amount: number;
	paymentMethod: string;
	referenceType?: string | null;
	referenceId?: string | null;
	description?: string | null;
	supplierId?: number | null;
	supplierName?: string | null;
	recipientType?: string | null;
	recipientId?: number | null;
}

/** Request body for POST /api/transaction/contra */
export interface CreateContraTransactionRequest {
	sourceAccountId?: number | null;
	sourceBankId?: number | null;
	destinationAccountId?: number | null;
	destinationBankId?: number | null;
	amount: number;
	description?: string | null;
}

/** Request body for POST /api/transaction/{id}/reject */
export interface RejectTransactionRequest {
	reason: string;
}

/** Query parameters for GET /api/transaction */
export interface TransactionListQuery {
	status?: string | null;
	type?: string | null;
	referenceType?: string | null;
	referenceId?: string | null;
	bankId?: number | null;
	accountId?: number | null;
	search?: string | null;
	startDate?: string | null;
	endDate?: string | null;
	page?: number;
	pageSize?: number;
}
