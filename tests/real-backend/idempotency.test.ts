import { test, expect } from '@playwright/test';

test.describe('Real Backend E2E - Idempotency Keys', () => {
	test('should return cached response and not create duplicate transaction when same idempotency key is sent twice', async ({
		page
	}) => {
		const uniqueRefId = `REF-IDEM-${Date.now()}`;

		// Log in standard accountant
		await page.goto('/login');
		await page.fill('#email', 'accountant@texas.com');
		await page.fill('#password', 'AccountantPass123!');
		await page.click('button[type="submit"]');
		await page.waitForURL(/.*dashboard/);

		// Go to creation page
		await page.goto('/transactions/new');
		await page.waitForURL(/.*transactions\/new/);

		// Capture the request headers, post data, and exact URL
		let interceptedUrl: string = '';
		let interceptedHeaders: any = null;
		let interceptedBody: string = '';

		page.on('request', (request) => {
			if (
				request.url().includes('/api/transaction/incoming') &&
				request.method() === 'POST'
			) {
				interceptedUrl = request.url();
				interceptedHeaders = request.headers();
				interceptedBody = request.postData() || '';
			}
		});

		// Select Office Cash Drawer (ID 1)
		await page.selectOption('#dest-acc', '1');

		// Fill amount
		await page.fill('#incoming-amount', '120.000');

		// Select reference type openingbalance
		await page.selectOption('#incoming-ref-type', { value: 'openingbalance' });

		// Fill reference ID
		await page.fill('#incoming-ref-id', uniqueRefId);

		// Fill description
		await page.fill('#incoming-desc', 'Idempotency test posting');

		// Click Post Incoming Flow
		await page.click('button:has-text("Post Incoming Flow")');

		// Wait for redirect to /transactions
		await page.waitForURL(/.*transactions(?!\/new)/, { timeout: 15_000 });

		// Assert we successfully captured the request
		expect(interceptedUrl).not.toBe('');
		expect(interceptedHeaders).not.toBeNull();
		expect(interceptedHeaders['idempotency-key']).toBeDefined();

		// Verify transaction is in the table
		const table = page.locator('table');
		await expect(table).toBeVisible({ timeout: 10_000 });
		const rowNew = table.locator(`tr:has-text("${uniqueRefId}")`);
		await expect(rowNew).toBeVisible();

		// Re-send the EXACT same request to the actual backend URL with the same headers and body
		const dupResponse = await page.request.post(interceptedUrl, {
			headers: {
				...interceptedHeaders
			},
			data: JSON.parse(interceptedBody)
		});

		// Verify duplicate request returns successfully (200 OK or 201 Created)
		expect(dupResponse.ok()).toBe(true);
		const dupJson = await dupResponse.json();
		expect(dupJson.referenceId).toBe(uniqueRefId);

		// Reload transactions page
		await page.reload();
		await page.waitForURL(/.*transactions/);
		await expect(table).toBeVisible({ timeout: 10_000 });

		// Count transaction rows matching our unique reference ID
		const matchedRowsCount = await table.locator(`tr:has-text("${uniqueRefId}")`).count();

		// It MUST be exactly 1!
		expect(matchedRowsCount).toBe(1);
	});
});
