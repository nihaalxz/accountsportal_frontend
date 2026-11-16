import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// SvelteKit modules mocking
vi.mock('$env/dynamic/public', () => ({
	env: { PUBLIC_BACKEND_API_URL: 'http://localhost:5028' }
}));
vi.mock('$app/environment', () => ({
	browser: true,
	dev: true
}));

import {
	getActiveCompensationProfile,
	createCompensationProfile,
	getSalaryComponents,
	requestStaffAdvance,
	disburseStaffAdvance
} from './api';
import { apiFetch } from '$lib/api/api-client';

vi.mock('$lib/api/api-client', () => ({
	apiFetch: vi.fn()
}));

describe('Staff API Features', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('should query active compensation profile of a staff member', async () => {
		const mockResponse = { id: 1, staffId: 101, components: [] };
		vi.mocked(apiFetch).mockResolvedValue(mockResponse);

		const result = await getActiveCompensationProfile(101);
		expect(result).toEqual(mockResponse);
		expect(apiFetch).toHaveBeenCalledWith('/api/StaffCompensationProfiles/staff/101', {
			params: undefined,
			signal: undefined
		});
	});

	it('should create new staff compensation profile', async () => {
		const request = {
			staffId: 101,
			effectiveDate: '2026-07-01T00:00:00Z',
			components: [{ salaryComponentId: 1, amount: 250 }]
		};
		vi.mocked(apiFetch).mockResolvedValue({ success: true });

		const result = await createCompensationProfile(request);
		expect(result).toEqual({ success: true });
		expect(apiFetch).toHaveBeenCalledWith('/api/StaffCompensationProfiles', {
			method: 'POST',
			body: JSON.stringify(request),
			signal: undefined
		});
	});

	it('should fetch list of salary components', async () => {
		const mockComponents = [{ id: 1, name: 'Basic' }];
		vi.mocked(apiFetch).mockResolvedValue(mockComponents);

		const result = await getSalaryComponents(1, 20);
		expect(result).toEqual(mockComponents);
		expect(apiFetch).toHaveBeenCalledWith('/api/SalaryComponents', {
			params: { page: 1, pageSize: 20, sortBy: undefined, desc: false },
			signal: undefined
		});
	});

	it('should submit staff advance request', async () => {
		const request = {
			staffId: 102,
			amount: 500,
			month: 7,
			year: 2026,
			notes: 'Emergency advance'
		};
		vi.mocked(apiFetch).mockResolvedValue({ id: 5 });

		const result = await requestStaffAdvance(request);
		expect(result).toEqual({ id: 5 });
		expect(apiFetch).toHaveBeenCalledWith('/api/StaffAdvances', {
			method: 'POST',
			body: JSON.stringify(request),
			signal: undefined
		});
	});

	it('should disburse a staff advance', async () => {
		vi.mocked(apiFetch).mockResolvedValue({ success: true });

		const result = await disburseStaffAdvance(5);
		expect(result).toEqual({ success: true });
		expect(apiFetch).toHaveBeenCalledWith('/api/StaffAdvances/5/disburse', {
			method: 'POST',
			signal: undefined
		});
	});
});
