import { test, expect } from '@playwright/test';

test.describe('Real Backend E2E - Dashboard', () => {
	test('should display seeded metric summaries and recent transactions on the dashboard', async ({
		page
	}) => {
		// Log in first
		await page.goto('/login');
		await page.fill('#email', 'accountant@texas.com');
		await page.fill('#password', 'AccountantPass123!');
		await page.click('button[type="submit"]');

		await page.waitForURL(/.*dashboard/);

		// Verify welcome message
		const welcome = page.locator('h1');
		await expect(welcome).toContainText(/Welcome back, Normal Accountant/i);

		// Verify metric cards are visible and show currency values
		// Bank Balance card (contains a numeric BHD amount — exact value changes with test runs)
		const bankCard = page.locator('div:has-text("Bank Balance")').first();
		await expect(bankCard).toBeVisible({ timeout: 10_000 });
		await expect(bankCard).toContainText(/\d+[,.]?\d+/);

		// Account Balance card (dynamic: grows with approved test transactions)
		const accountCard = page.locator('div:has-text("Account Balance")').first();
		await expect(accountCard).toBeVisible({ timeout: 5_000 });
		// Just verify it contains a numeric BHD amount — exact value changes with test runs
		await expect(accountCard).toContainText(/\d+[,.]?\d+/);

		// Supplier Wallet Balance (stable: always 0 in test DB)
		const supplierCard = page.locator('div:has-text("Supplier Wallet Balance")').first();
		await expect(supplierCard).toContainText(/0\.000/);

		// Verify recent transactions table is rendered
		const table = page.locator('table');
		await expect(table).toBeVisible({ timeout: 5000 });

		// Verify the table has at least one data row (beyond header)
		const rows = table.locator('tbody tr');
		await expect(rows).not.toHaveCount(0, { timeout: 5000 });
	});
});
