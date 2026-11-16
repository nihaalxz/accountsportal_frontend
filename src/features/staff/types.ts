/**
 * Staff Feature Types.
 * Matches backend contracts exactly.
 */

export interface StaffProfile {
	id: number;
	name: string;
	email: string;
	userType: string;
	isActive: boolean;
	basicSalary: number;
	housingAllowance: number;
	transportAllowance: number;
	rowVersion: string;
	updatedAt: string;
}

export interface StaffCompensationProfileResponse {
	id: number;
	staffId: number;
	effectiveDate: string;
	components: StaffCompensationComponentResponse[];
	rowVersion: string;
}

export interface StaffCompensationComponentResponse {
	id: number;
	salaryComponentId: number;
	salaryComponentCode: string;
	salaryComponentName: string;
	type: string; // 'earning' | 'deduction'
	amount: number;
}

export interface CreateStaffCompensationProfileRequest {
	staffId: number;
	effectiveDate: string; // ISO date string
	components: {
		salaryComponentId: number;
		amount: number;
	}[];
}

export interface SalaryComponentResponse {
	id: number;
	code: string;
	name: string;
	type: 'earning' | 'deduction';
	glAccountCode: string;
	isActive: boolean;
	rowVersion: string;
}

export interface CreateSalaryComponentRequest {
	code: string;
	name: string;
	type: string;
	glAccountCode: string;
}

export interface UpdateSalaryComponentRequest {
	name: string;
	glAccountCode: string;
}

// Sub-elements: Advances, Loans, Reimbursements
export interface StaffAdvanceResponse {
	id: number;
	staffId: number;
	staffName: string;
	amount: number;
	outstandingBalance: number;
	status: string; // 'pending' | 'disbursed' | 'rejected'
	month: number;
	year: number;
	disbursedAt: string | null;
	paymentMethod: string | null;
	referenceNumber: string | null;
}

export interface RequestStaffAdvanceRequest {
	staffId: number;
	amount: number;
	month: number;
	year: number;
	notes: string | null;
}

export interface StaffLoanResponse {
	id: number;
	staffId: number;
	staffName: string;
	principalAmount: number;
	outstandingBalance: number;
	status: string; // 'pending' | 'active' | 'closed' | 'rejected'
	month: number;
	year: number;
	disbursedAt: string | null;
	repaymentSchedules: LoanRepaymentScheduleResponse[];
}

export interface LoanRepaymentScheduleResponse {
	id: number;
	dueDate: string;
	amount: number;
	amountPaid: number;
	status: string; // 'pending' | 'paid' | 'skipped'
}

export interface RequestStaffLoanRequest {
	staffId: number;
	principalAmount: number;
	installments: number;
	month: number;
	year: number;
	notes: string | null;
}

export interface ReimbursementResponse {
	id: number;
	staffId: number;
	staffName: string;
	amount: number;
	description: string;
	status: string; // 'pending' | 'approved' | 'rejected' | 'paid'
	sourceReference: string | null;
	paidAt: string | null;
	paymentMethod: string | null;
	sourceAccountId: number | null;
	sourceBankId: number | null;
}

export interface SubmitReimbursementRequest {
	staffId: number;
	amount: number;
	description: string;
}

export interface PayReimbursementIndependentRequest {
	sourceAccountId: number | null;
	sourceBankId: number | null;
	paymentMethod: string;
	referenceNumber: string | null;
}
