/**
 * Expenses feature — TypeScript types.
 * Mirrors backend ExpenseContracts.cs exactly.
 */

export type ExpenseStatus =
	'draft' | 'pendingapproval' | 'approved' | 'posted' | 'rejected' | 'cancelled' | 'reversed';

export type ExpensePaymentMethod = 'cash' | 'bank_transfer' | 'bank';

export interface ExpenseHeaderResponse {
	id: number;
	name: string;
	category: string; // Asset, Liability, Income, Capital, Expenses
	description: string | null;
	createdBy: number | null;
	createdAt: string;
}

export interface CreateExpenseHeaderRequest {
	name: string;
	category: string;
	description: string | null;
}

export interface ExpenseCategorySummaryDto {
	count: number;
	totalAmount: number;
}

export interface ExpenseSummaryResponse {
	all: ExpenseCategorySummaryDto;
	asset: ExpenseCategorySummaryDto;
	liability: ExpenseCategorySummaryDto;
	income: ExpenseCategorySummaryDto;
	capital: ExpenseCategorySummaryDto;
	expenses: ExpenseCategorySummaryDto;
}

export interface ExpenseResponse {
	id: number;
	expenseNumber: string;
	expenseCategoryId: number;
	amount: number;
	currency: string;
	description: string;
	paymentMethod: ExpensePaymentMethod;
	sourceAccountId: number | null;
	sourceBankId: number | null;
	expenseDate: string;
	status: ExpenseStatus;
	postedTransactionId: number | null;
	postedJournalEntryId: number | null;
	rejectionReason: string | null;
	notes: string | null;
	correlationId: string;
	createdBy: number;
	approvedBy: number | null;
	approvedAt: string | null;
	rejectedBy: number | null;
	rejectedAt: string | null;
	postedBy: number | null;
	postedAt: string | null;
	createdAt: string;
	rowVersion?: string | null;
}

export interface CreateExpenseRequest {
	expenseCategoryId: number;
	amount: number;
	description: string;
	paymentMethod: ExpensePaymentMethod;
	sourceAccountId: number | null;
	sourceBankId: number | null;
	notes: string | null;
	expenseDate: string; // ISO date string
	supplierId?: number | null;
	supplierPaymentType?: string | null;
	referenceNumber?: string | null;
}

export interface RejectExpenseRequest {
	reason: string;
}

export type FinancialDirection = 'outgoing' | 'incoming';

export function getBucketDirection(categoryBucket: string, supplierPaymentType?: string): FinancialDirection {
	if (supplierPaymentType === 'supplier_refund' || supplierPaymentType === 'refund') return 'incoming';
	const cat = (categoryBucket || '').toLowerCase();
	if (cat === 'income' || cat === 'capital') return 'incoming';
	return 'outgoing';
}

export function getBucketSourceLabel(categoryBucket: string, supplierPaymentType?: string): string {
	const dir = getBucketDirection(categoryBucket, supplierPaymentType);
	const cat = (categoryBucket || '').toLowerCase();
	if (dir === 'incoming') {
		return cat === 'capital' ? 'Deposit Into' : 'Receive Into';
	}
	return 'Pay From';
}

export function getBucketHelpText(categoryBucket: string, supplierPaymentType?: string): string {
	if (supplierPaymentType === 'supplier_wallet' || supplierPaymentType === 'wallet_topup') {
		return 'Funds will be paid from selected account to increase Supplier Wallet balance.';
	}
	if (supplierPaymentType === 'supplier_credit' || supplierPaymentType === 'credit_settlement') {
		return 'Funds will be paid from selected account to settle outstanding Supplier Credit.';
	}
	if (supplierPaymentType === 'supplier_refund' || supplierPaymentType === 'refund') {
		return 'Refund from supplier will be deposited into the selected cash or bank account.';
	}
	const dir = getBucketDirection(categoryBucket, supplierPaymentType);
	const cat = (categoryBucket || '').toLowerCase();
	if (cat === 'income') return 'Income receipt will be credited directly into the selected account.';
	if (cat === 'capital') return 'Capital deposit will be credited directly into the selected account.';
	if (cat === 'asset') return 'Asset acquisition payment will be deducted from the selected account.';
	if (cat === 'liability') return 'Liability settlement payment will be deducted from the selected account.';
	return 'Operating expense payment will be deducted from the selected account.';
}

/** Valid state transitions for expense actions */
export function canSubmitExpense(status: ExpenseStatus): boolean {
	return status === 'draft';
}

export function canApproveExpense(status: ExpenseStatus): boolean {
	return status === 'pendingapproval' || status === 'draft';
}

export function canRejectExpense(status: ExpenseStatus): boolean {
	return status === 'pendingapproval' || status === 'draft';
}

export function canCancelExpense(status: ExpenseStatus): boolean {
	return status === 'draft';
}

export const EXPENSE_STATUS_LABELS: Record<ExpenseStatus, string> = {
	draft: 'Draft',
	pendingapproval: 'Pending Approval',
	approved: 'Approved',
	posted: 'Posted',
	rejected: 'Rejected',
	cancelled: 'Cancelled',
	reversed: 'Reversed'
};

export const PAYMENT_METHOD_LABELS: Record<ExpensePaymentMethod, string> = {
	cash: 'Cash',
	bank_transfer: 'Bank Transfer',
	bank: 'Bank'
};
