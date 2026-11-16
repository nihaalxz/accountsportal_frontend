/**
 * Accounting Periods feature — TypeScript types.
 * Mirrors backend AccountingPeriodContracts.cs exactly.
 */

export type PeriodStatus = 'open' | 'closed';

export interface AccountingPeriodResponse {
	id: number;
	name: string;
	fiscalYear: number;
	periodNumber: number;
	startDate: string;
	endDate: string;
	status: PeriodStatus;
	closedAt: string | null;
	closedByUserId: number | null;
	reopenedAt: string | null;
	reopenedByUserId: number | null;
	reopenReason: string | null;
	createdAt: string;
}

export interface CreateAccountingPeriodRequest {
	name: string;
	fiscalYear: number;
	periodNumber: number;
	startDate: string; // ISO date string
	endDate: string; // ISO date string
}

export interface ReopenAccountingPeriodRequest {
	reason: string;
}
