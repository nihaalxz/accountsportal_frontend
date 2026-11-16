/**
 * Suppliers Feature Types.
 * Matches backend contracts exactly.
 */

import type { TransactionResponse } from '../financial-transactions/types';

export interface SupplierResponse {
	id: number;
	name: string;
	code: string;
	wallet: number; // Signed balance: >0 surplus/prepaid, <0 credit/debt, =0 settled
	isVerified: boolean;
	categories: string[];
	createdAt: string;
}

export interface CreateSupplierRequest {
	name: string;
	code: string;
	categories?: string[];
}

export interface UpdateSupplierRequest {
	name: string;
	categories?: string[];
}

export interface SupplierPaymentResponse {
	id: number;
	supplierId: number;
	amount: number;
	currency: string;
	paymentMethod: 'cash' | 'bank' | 'credit' | 'wallet' | 'supplier_wallet' | string;
	sourceType: string;
	sourceAccountId: number | null;
	sourceBankId: number | null;
	referenceNumber: string | null;
	externalReference: string | null;
	serviceType: string | null;
	description: string | null;
	status: 'pending' | 'approved' | 'rejected';
	rejectionReason: string | null;
	createdBy: number;
	createdAt: string;
	rowVersion: string;
	documentNumber?: string | null;
	requestedByName?: string | null;
	sourceBankName?: string | null;
	sourceAccountName?: string | null;
}

export interface CreateSupplierPaymentRequest {
	supplierId: number;
	amount: number;
	paymentMethod: string; // 'Cash', 'Bank', or 'Credit'
	sourceAccountId: string | null;
	referenceNumber?: string | null;
	externalReference?: string | null;
	serviceType?: string | null;
	description?: string | null;
	supplierName: string;
}

export interface RejectSupplierPaymentRequest {
	reason: string;
}

export interface GlReconciliationReportResponse {
	missingJournals: MissingJournalItem[];
	unbalancedJournals: UnbalancedJournalItem[];
	duplicatePostings: DuplicatePostingItem[];
	isReconciled: boolean;
}

export interface MissingJournalItem {
	originType: string;
	id: number;
	reference: string;
	amount: number;
	date: string;
	status: string;
}

export interface UnbalancedJournalItem {
	journalId: number;
	journalNumber: string;
	description: string;
	totalDebits: number;
	totalCredits: number;
	entryDate: string;
}

export interface DuplicatePostingItem {
	sourceType: string;
	sourceId: string;
	count: number;
	details: DuplicateJournalDetails[];
}

export interface DuplicateJournalDetails {
	id: number;
	journalNumber: string;
	debitSum: number;
	entryDate: string;
}

export interface PurchaseReturnResponse {
	id: number;
	supplierId: number;
	originalPurchaseReference: string;
	externalReference: string | null;
	serviceType: string | null;
	amount: number;
	currency: string;
	reason: string;
	status: 'pending' | 'approved' | 'rejected';
	rejectionReason: string | null;
	requestedByUserId: number;
	requestedAt: string;
	approvedByUserId: number | null;
	approvedAt: string | null;
	rejectedByUserId: number | null;
	rejectedAt: string | null;
	correlationId: string | null;
	destinationType: string | null;
	createdAt: string;
	updatedAt: string;
	rowVersion: string;
}

export interface CreatePurchaseReturnRequest {
	supplierId: number;
	originalPurchaseReference: string;
	amount: number;
	reason: string;
	destinationType: 'bank' | 'account' | 'supplier_wallet';
	destinationId: string;
	serviceType: string;
	supplierName: string;
}

export interface RejectPurchaseReturnRequest {
	reason: string;
}

export interface SalesReturnResponse {
	id: number;
	recipientType: 'agent' | 'head' | string;
	recipientId: number;
	originalSaleReference: string;
	externalReference: string | null;
	serviceType: string | null;
	amount: number;
	currency: string;
	reason: string;
	status: 'pending' | 'approved' | 'rejected';
	rejectionReason: string | null;
	requestedByUserId: number;
	requestedAt: string;
	approvedByUserId: number | null;
	approvedAt: string | null;
	rejectedByUserId: number | null;
	rejectedAt: string | null;
	correlationId: string | null;
	createdAt: string;
	updatedAt: string;
	rowVersion: string;
}

export interface CreateSalesReturnRequest {
	recipientType: string; // 'Agent' | 'Head'
	recipientId: number;
	serviceId: string;
	amount: number;
	returnReason: string;
	sourceType: string; // 'bank' | 'account'
	sourceId: string;
	serviceType: string;
}

export interface RejectSalesReturnRequest {
	reason: string;
}

export type { TransactionResponse };
