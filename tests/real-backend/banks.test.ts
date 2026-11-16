import { test, expect } from '@playwright/test';

test.describe('Real Backend E2E - Bank Accounts', () => {
	test('should support listing, detail navigation, bank account creation, and status toggles', async ({
		page
	}) => {
		// Log in as Master Accountant
		await page.goto('/login');
		await page.fill('#email', 'admin@texas.com');
		await page.fill('#password', 'S3cure_Acc_999!');
		await page.click('button[type="submit"]');
		await page.waitForURL(/.*dashboard/);

		// Navigate to Bank Accounts
		await page.goto('/banks');
		await page.waitForURL(/.*banks/);

		// Verify listed banks
		await expect(page.locator('table')).toBeVisible({ timeout: 10_000 });
		await expect(
			page.locator('table td', { hasText: 'Primary Operating Bank' }).first()
		).toBeVisible();
		await expect(
			page.locator('table td', { hasText: 'Secondary Savings Bank' }).first()
		).toBeVisible();

		// Create a new bank account
		await page.click('button:has-text("Register Bank Account")');
		await page.waitForURL(/.*banks\/new/);

		const uniqueBankName = `Texas Gulf Bank-${Date.now()}`;
		const uniqueAccNum = `1121${Math.floor(1000 + Math.random() * 9000)}`;

		await page.fill('#bank-name', uniqueBankName);
		await page.fill('#bank-acc', uniqueAccNum);
		await page.fill('#bank-bal', '1500.000');
		await page.click('button[type="submit"]');

		// Redirect back to list
		await page.waitForURL(/.*banks(?!\/new)/, { timeout: 10_000 });
		const row = page.locator(`tr:has-text("${uniqueBankName}")`);
		await expect(row).toBeVisible();

		// Click to view details
		await row.click();
		await page.waitForURL(/.*banks\/\d+/);

		// Perform status toggle
		const toggleBtn = page
			.locator('button:has-text("Deactivate"), button:has-text("Activate")')
			.first();
		await expect(toggleBtn).toBeVisible();
		await toggleBtn.click();
		// Status change toast notification
		await expect(page.locator('text=Bank status updated successfully.')).toBeVisible({
			timeout: 10_000
		});
	});
});
