/**
 * Reporting API service.
 * Uses centralized apiFetch client.
 * All 4 reporting endpoints from ReportingController.cs.
 */

import { apiFetch } from '$lib/api/api-client';
import type {
	GeneralLedgerReportResponse,
	TrialBalanceResponse,
	AccountStatementResponse,
	ExpenseReportResponse
} from './types';

/**
 * GET /api/reporting/general-ledger/{accountId}
 * Requires: startDate, endDate (both required by backend)
 */
export async function getGeneralLedgerReport(
	accountId: number,
	startDate: string,
	endDate: string,
	signal?: AbortSignal
): Promise<GeneralLedgerReportResponse> {
	return apiFetch<GeneralLedgerReportResponse>(`/api/reporting/general-ledger/${accountId}`, {
		params: { startDate, endDate },
		signal
	});
}

/**
 * GET /api/reporting/trialbalance
 * asOfDate is optional — backend defaults to today if omitted
 */
export async function getTrialBalance(
	asOfDate?: string,
	signal?: AbortSignal
): Promise<TrialBalanceResponse> {
	return apiFetch<TrialBalanceResponse>('/api/reporting/trialbalance', {
		params: asOfDate ? { asOfDate } : undefined,
		signal
	});
}

/**
 * GET /api/reporting/statement/{accountCode}
 * accountCode is a string (e.g., "1000"). Both startDate and endDate required.
 */
export async function getAccountStatement(
	accountCode: string,
	startDate: string,
	endDate: string,
	signal?: AbortSignal
): Promise<AccountStatementResponse> {
	return apiFetch<AccountStatementResponse>(
		`/api/reporting/statement/${encodeURIComponent(accountCode)}`,
		{
			params: { startDate, endDate },
			signal
		}
	);
}

/**
 * GET /api/reporting/expenses
 * Both startDate and endDate required.
 */
export async function getExpenseReport(
	startDate: string,
	endDate: string,
	signal?: AbortSignal
): Promise<ExpenseReportResponse> {
	return apiFetch<ExpenseReportResponse>('/api/reporting/expenses', {
		params: { startDate, endDate },
		signal
	});
}
