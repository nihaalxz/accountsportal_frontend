/**
 * Statement Transaction Classifier & Badge Config.
 * Classifies approved transactions for Bank Statements and Cash Account Statements
 * identically to backend AccountReportDocumentBuilder.cs.
 */

export type StatementTransactionType =
	| 'RECEIPT'
	| 'DEPOSIT'
	| 'WITHDRAWAL'
	| 'CONTRA'
	| 'EXPENSE'
	| 'SALARY'
	| 'REFUND'
	| 'PAYMENT';

export function resolveStatementTransactionType(
	t: {
		transactionType?: string | null;
		referenceType?: string | null;
		referenceId?: string | null;
		description?: string | null;
		sourceBankId?: number | null;
		destinationBankId?: number | null;
		sourceAccountId?: number | null;
		destinationAccountId?: number | null;
		supplierId?: number | null;
		expenseHeaderId?: number | null;
	},
	isBankStatement: boolean,
	entityId: number
): StatementTransactionType {
	const refType = (t.referenceType ?? '').toLowerCase();
	const txType = (t.transactionType ?? '').toLowerCase();
	const refId = (t.referenceId ?? '').toUpperCase();
	const desc = (t.description ?? '').toLowerCase();

	// 1. Client Receipts / Collections
	if (
		refType === 'receipt' ||
		refType === 'sale' ||
		refId.startsWith('RCP') ||
		refId.startsWith('TXSRCP') ||
		refId.startsWith('CRCPT') ||
		desc.includes('receipt')
	) {
		return 'RECEIPT';
	}

	// 2. Internal Transfers / Contra Movements
	const isTransfer =
		txType === 'contra' ||
		refType === 'transfer' ||
		(t.sourceBankId != null && t.destinationBankId != null) ||
		(t.sourceAccountId != null && t.destinationAccountId != null) ||
		(t.sourceBankId != null && t.destinationAccountId != null) ||
		(t.sourceAccountId != null && t.destinationBankId != null);

	if (isTransfer) {
		if (isBankStatement) {
			// For a Bank:
			// Cash drawer to bank -> DEPOSIT
			if (t.destinationBankId === entityId && t.sourceAccountId != null) return 'DEPOSIT';
			// Bank to cash drawer -> WITHDRAWAL
			if (t.sourceBankId === entityId && t.destinationAccountId != null) return 'WITHDRAWAL';
			// Inter-bank -> CONTRA
			if (t.sourceBankId != null && t.destinationBankId != null) return 'CONTRA';
			return t.destinationBankId === entityId ? 'DEPOSIT' : 'WITHDRAWAL';
		} else {
			// For a Cash Drawer:
			// Drawer to bank -> DEPOSIT
			if (t.sourceAccountId === entityId && t.destinationBankId != null) return 'DEPOSIT';
			// Bank to drawer -> WITHDRAWAL
			if (t.destinationAccountId === entityId && t.sourceBankId != null) return 'WITHDRAWAL';
			// Inter-drawer -> CONTRA
			if (t.sourceAccountId != null && t.destinationAccountId != null) return 'CONTRA';
			return t.sourceAccountId === entityId ? 'DEPOSIT' : 'WITHDRAWAL';
		}
	}

	// 3. Operational Expenses
	if (
		refType === 'expense' ||
		t.expenseHeaderId != null ||
		desc.includes('expense')
	) {
		return 'EXPENSE';
	}

	// 4. Payroll / Salaries
	if (
		refType === 'salary' ||
		refType === 'advance' ||
		refType === 'loan' ||
		desc.includes('salary')
	) {
		return 'SALARY';
	}

	// 5. Refunds & Returns
	if (
		txType === 'purchasereturn' ||
		txType === 'salesreturn' ||
		refType === 'refund'
	) {
		return 'REFUND';
	}

	// 6. Supplier Payments / Settlements / Services
	if (
		refType === 'supplierpayment' ||
		refType === 'supplierwallet' ||
		refType === 'suppliercreditclearance' ||
		t.supplierId != null ||
		['visa', 'flight', 'hotel', 'holiday', 'transport', 'vfs', 'other'].includes(refType)
	) {
		return 'PAYMENT';
	}

	// 7. General Directional Fallback
	if (txType === 'incoming') {
		return isBankStatement ? 'DEPOSIT' : 'RECEIPT';
	}
	if (txType === 'outgoing') {
		return isBankStatement ? 'WITHDRAWAL' : 'PAYMENT';
	}

	return 'CONTRA';
}

export interface StatementTypeBadgeStyle {
	label: string;
	badgeClass: string;
}

export function getStatementTypeBadge(type: string): StatementTypeBadgeStyle {
	switch (type.toUpperCase()) {
		case 'RECEIPT':
			return {
				label: 'RECEIPT',
				badgeClass: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20'
			};
		case 'DEPOSIT':
			return {
				label: 'DEPOSIT',
				badgeClass: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20'
			};
		case 'WITHDRAWAL':
			return {
				label: 'WITHDRAWAL',
				badgeClass: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20'
			};
		case 'CONTRA':
			return {
				label: 'CONTRA',
				badgeClass: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/20'
			};
		case 'EXPENSE':
			return {
				label: 'EXPENSE',
				badgeClass: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20'
			};
		case 'SALARY':
			return {
				label: 'SALARY',
				badgeClass: 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20'
			};
		case 'REFUND':
			return {
				label: 'REFUND',
				badgeClass: 'bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20'
			};
		case 'PAYMENT':
			return {
				label: 'PAYMENT',
				badgeClass: 'bg-slate-500/10 text-slate-700 dark:text-slate-400 border-slate-500/20'
			};
		case 'OPENING':
			return {
				label: 'OPENING',
				badgeClass: 'bg-muted text-muted-foreground border-border'
			};
		default:
			return {
				label: type,
				badgeClass: 'bg-muted text-muted-foreground border-border'
			};
	}
}
