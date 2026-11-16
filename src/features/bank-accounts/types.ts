/**
 * Bank Account feature types.
 * Derived from actual backend BankContracts.cs
 */

/** Response from GET /api/bank */
export interface BankResponse {
	id: number;
	bankName: string;
	accountNumber: string;
	balance: number; // Opening/book balance
	currentBalance: number; // Running balance — authoritative from backend
	isActive: boolean;
	createdAt: string;
}

/** Request body for POST /api/bank */
export interface CreateBankRequest {
	bankName: string;
	accountNumber: string;
	openingBalance: number;
}

/** Request body for PUT /api/bank/{id} */
export interface UpdateBankRequest {
	bankName: string;
	accountNumber: string;
}

/** Response from POST /api/bank/{id}/toggle-status */
export interface BankToggleStatusResponse {
	message: string;
}
