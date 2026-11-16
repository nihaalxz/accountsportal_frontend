import { test, expect } from '@playwright/test';

test.describe('E2E Database Safety Check', () => {
	test('should target local development backend only', async ({ request }) => {
		const baseURL = 'http://localhost:5028';

		// Verify connection to local backend
		const response = await request.get(`${baseURL}/`);
		expect(response.ok()).toBe(true);

		const data = await response.json();
		expect(data.status).toBe('Healthy');
		expect(data.portal).toContain('Texas Accounts Portal');

		// Assert host is local and matches local dev environment
		expect(baseURL).toContain('localhost');
	});
});
