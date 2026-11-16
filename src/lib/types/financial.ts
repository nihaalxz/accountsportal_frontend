/**
 * Financial domain types derived from actual backend contracts.
 * All enum values match backend lowercase string serialization exactly.
 *
 * DO NOT add status values not present in the backend DomainEnums.cs
 */

// ─── Transaction Status ─────────────────────────────────────────────────────

export type TransactionStatus = 'pending' | 'approved' | 'rejected';

export const TRANSACTION_STATUS_VALUES: TransactionStatus[] = ['pending', 'approved', 'rejected'];

export interface StatusConfig {
	label: string;
	tone: 'neutral' | 'positive' | 'negative' | 'pending' | 'warning';
	/** Tailwind text-color class for the status indicator */
	textClass: string;
	/** Tailwind bg-color class for the status badge */
	bgClass: string;
	borderClass: string;
}

export const TRANSACTION_STATUS_CONFIG: Record<TransactionStatus, StatusConfig> = {
	pending: {
		label: 'Pending',
		tone: 'pending',
		textClass: 'text-amber-700 dark:text-amber-400',
		bgClass: 'bg-amber-50 dark:bg-amber-950/40',
		borderClass: 'border-amber-200 dark:border-amber-800'
	},
	approved: {
		label: 'Approved',
		tone: 'positive',
		textClass: 'text-emerald-700 dark:text-emerald-400',
		bgClass: 'bg-emerald-50 dark:bg-emerald-950/40',
		borderClass: 'border-emerald-200 dark:border-emerald-800'
	},
	rejected: {
		label: 'Rejected',
		tone: 'negative',
		textClass: 'text-red-700 dark:text-red-400',
		bgClass: 'bg-red-50 dark:bg-red-950/40',
		borderClass: 'border-red-200 dark:border-red-800'
	}
};

export function getStatusConfig(status: string): StatusConfig {
	return (
		TRANSACTION_STATUS_CONFIG[status as TransactionStatus] ?? {
			label: status,
			tone: 'neutral',
			textClass: 'text-muted-foreground',
			bgClass: 'bg-muted/50',
			borderClass: 'border-border'
		}
	);
}

// ─── Transaction Type ────────────────────────────────────────────────────────

export type TransactionType =
	| 'incoming'
	| 'outgoing'
	| 'contra'
	| 'purchasereturn'
	| 'salesreturn'
	| 'walletdebit'
	| 'receipt'
	| 'receipts';

export const TRANSACTION_TYPE_VALUES: TransactionType[] = [
	'incoming',
	'outgoing',
	'contra',
	'purchasereturn',
	'salesreturn',
	'walletdebit',
	'receipt'
];

export interface TypeConfig {
	label: string;
	/** Positive = money in, negative = money out, neutral = internal */
	direction: 'in' | 'out' | 'neutral';
	textClass: string;
}

export const TRANSACTION_TYPE_CONFIG: Record<TransactionType, TypeConfig> = {
	incoming: {
		label: 'Incoming',
		direction: 'in',
		textClass: 'text-emerald-600 dark:text-emerald-400'
	},
	outgoing: {
		label: 'Outgoing',
		direction: 'out',
		textClass: 'text-red-600 dark:text-red-400'
	},
	contra: {
		label: 'Contra',
		direction: 'neutral',
		textClass: 'text-blue-600 dark:text-blue-400'
	},
	purchasereturn: {
		label: 'Purchase Return',
		direction: 'in',
		textClass: 'text-emerald-600 dark:text-emerald-400'
	},
	salesreturn: {
		label: 'Sales Return',
		direction: 'out',
		textClass: 'text-orange-600 dark:text-orange-400'
	},
	walletdebit: {
		label: 'Wallet Debit',
		direction: 'out',
		textClass: 'text-purple-600 dark:text-purple-400'
	},
	receipt: {
		label: 'Receipts',
		direction: 'in',
		textClass: 'text-amber-600 dark:text-amber-400'
	},
	receipts: {
		label: 'Receipts',
		direction: 'in',
		textClass: 'text-amber-600 dark:text-amber-400'
	}
};

export function getTypeConfig(type: string): TypeConfig {
	return (
		TRANSACTION_TYPE_CONFIG[type as TransactionType] ?? {
			label: type,
			direction: 'neutral',
			textClass: 'text-muted-foreground'
		}
	);
}

// ─── Payment Method ───────────────────────────────────────────────────────────

export type PaymentMethod = 'cash' | 'bank' | 'credit' | 'banktransfer' | 'wallet';

export const PAYMENT_METHOD_VALUES: PaymentMethod[] = [
	'cash',
	'bank',
	'credit',
	'banktransfer',
	'wallet'
];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
	cash: 'Cash',
	bank: 'Bank',
	credit: 'Credit',
	banktransfer: 'Bank Transfer',
	wallet: 'Wallet'
};

export function getPaymentMethodLabel(method: string): string {
	return PAYMENT_METHOD_LABELS[method as PaymentMethod] ?? method;
}

// ─── Reference Type ───────────────────────────────────────────────────────────

export type ReferenceType =
	| 'sale'
	| 'expense'
	| 'refund'
	| 'supplierpayment'
	| 'openingbalance'
	| 'correction'
	| 'transfer'
	| 'suppliercreditclearance'
	| 'supplierwallet'
	| 'salary'
	| 'advance'
	| 'loan';

export const REFERENCE_TYPE_VALUES: ReferenceType[] = [
	'sale',
	'expense',
	'refund',
	'supplierpayment',
	'openingbalance',
	'correction',
	'transfer',
	'suppliercreditclearance',
	'supplierwallet',
	'salary',
	'advance',
	'loan'
];

export const REFERENCE_TYPE_LABELS: Record<ReferenceType, string> = {
	sale: 'Sale',
	expense: 'Expense',
	refund: 'Refund',
	supplierpayment: 'Supplier Payment',
	openingbalance: 'Opening Balance',
	correction: 'Correction',
	transfer: 'Transfer',
	suppliercreditclearance: 'Supplier Credit Clearance',
	supplierwallet: 'Supplier Wallet',
	salary: 'Salary',
	advance: 'Advance',
	loan: 'Loan'
};

export function getReferenceTypeLabel(refType: string): string {
	return REFERENCE_TYPE_LABELS[refType as ReferenceType] ?? refType;
}

// ─── Account Type ─────────────────────────────────────────────────────────────

export type AccountType = 'cash' | 'bank' | 'credit';

export const ACCOUNT_TYPE_VALUES: AccountType[] = ['cash', 'bank', 'credit'];

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
	cash: 'Cash',
	bank: 'Bank',
	credit: 'Credit'
};

// ─── Ledger Type ─────────────────────────────────────────────────────────────

export type LedgerType = 'asset' | 'liability' | 'capital' | 'income' | 'expense';

export const LEDGER_TYPE_VALUES: LedgerType[] = [
	'asset',
	'liability',
	'capital',
	'income',
	'expense'
];

export const LEDGER_TYPE_LABELS: Record<LedgerType, string> = {
	asset: 'Asset',
	liability: 'Liability',
	capital: 'Capital',
	income: 'Income',
	expense: 'Expense'
};

// ─── Allowed Actions per Transaction Status ───────────────────────────────────

/**
 * Returns the list of actions the BACKEND supports for a given transaction status.
 * Frontend role-gating is applied separately.
 */
export function getAllowedActions(status: TransactionStatus | string): ('approve' | 'reject')[] {
	if (status === 'pending') return ['approve', 'reject'];
	return [];
}
