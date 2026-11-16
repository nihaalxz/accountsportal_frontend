import { test, expect } from '@playwright/test';

test.describe('Real Backend E2E - Transaction Creation', () => {
	test('should support creating a new incoming cash transaction proposal', async ({ page }) => {
		const uniqueRefId = `REF-NEW-${Date.now()}`;

		// Log in standard accountant
		await page.goto('/login');
		await page.fill('#email', 'accountant@texas.com');
		await page.fill('#password', 'AccountantPass123!');
		await page.click('button[type="submit"]');
		await page.waitForURL(/.*dashboard/);

		// Go to creation page
		await page.goto('/transactions/new');
		await page.waitForURL(/.*transactions\/new/);

		// Verify form elements are visible
		await expect(page.locator('#dest-acc')).toBeVisible({ timeout: 10_000 });

		// Select Office Cash Drawer (ID 1)
		await page.selectOption('#dest-acc', '1');

		// Fill amount
		await page.fill('#incoming-amount', '75.500');

		// Select reference type openingbalance
		await page.selectOption('#incoming-ref-type', { value: 'openingbalance' });

		// Fill reference ID (unique per run to avoid strict mode violations)
		await page.fill('#incoming-ref-id', uniqueRefId);

		// Fill description
		await page.fill('#incoming-desc', 'E2E Posted Deposit');

		// Click Post Incoming Flow
		await page.click('button:has-text("Post Incoming Flow")');

		// Wait for redirect to /transactions
		await page.waitForURL(/.*transactions(?!\/new)/, { timeout: 15_000 });

		// Verify new transaction row is visible in the list
		const table = page.locator('table');
		await expect(table).toBeVisible({ timeout: 10_000 });

		const rowNew = table.locator(`tr:has-text("${uniqueRefId}")`);
		await expect(rowNew).toBeVisible();
		await expect(rowNew).toContainText(/75\.500/);
	});
});
