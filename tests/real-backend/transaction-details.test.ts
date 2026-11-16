import { test, expect } from '@playwright/test';

test.describe('Real Backend E2E - Transaction Details', () => {
	test('should display transaction parameters, warnings, and gate action buttons by role', async ({
		page
	}) => {
		// --- 1. View Seeded Approved Transaction #1 as standard accountant ---
		await page.goto('/login');
		await page.fill('#email', 'accountant@texas.com');
		await page.fill('#password', 'AccountantPass123!');
		await page.click('button[type="submit"]');
		await page.waitForURL(/.*dashboard/);

		await page.goto('/transactions/1');
		await page.waitForTimeout(1000); // Wait for API response

		// Verify parameters
		await expect(page.locator('span:has-text("Transaction #1")')).toBeVisible();
		await expect(page.getByLabel('Status: Approved')).toBeVisible();
		await expect(page.locator('span:has-text("150.000")').first()).toBeVisible();

		// Verify reversal disclaimer warning block is visible
		const warningBlock = page.getByText('Transaction Reversal is Not Supported').first();
		await expect(warningBlock).toBeVisible();

		// Verify action buttons are NOT present on approved transaction
		const approveButton = page.locator('button:has-text("Approve Posting")');
		const rejectButton = page.locator('button:has-text("Reject Posting")');
		await expect(approveButton).not.toBeVisible();
		await expect(rejectButton).not.toBeVisible();

		// Logout
		await page.click('button[title="Sign out"]');
		await page.waitForURL(/.*login/);

		// --- 2. View Seeded Pending Transaction #2 as standard accountant ---
		await page.fill('#email', 'accountant@texas.com');
		await page.fill('#password', 'AccountantPass123!');
		await page.click('button[type="submit"]');
		await page.waitForURL(/.*dashboard/);

		await page.goto('/transactions/2');
		await page.waitForTimeout(1000);

		// Verify pending status is visible
		await expect(page.locator('span:has-text("Transaction #2")')).toBeVisible();
		await expect(page.getByLabel('Status: Pending')).toBeVisible();

		// Actions bar should NOT be visible to standard accountant
		await expect(approveButton).not.toBeVisible();
		await expect(rejectButton).not.toBeVisible();

		// Logout
		await page.click('button[title="Sign out"]');
		await page.waitForURL(/.*login/);

		// --- 3. View Seeded Pending Transaction #2 as master accountant ---
		await page.fill('#email', 'admin@texas.com');
		await page.fill('#password', 'S3cure_Acc_999!');
		await page.click('button[type="submit"]');
		await page.waitForURL(/.*dashboard/);

		await page.goto('/transactions/2');
		await page.waitForTimeout(1000);

		// Actions bar SHOULD be visible to master accountant
		await expect(approveButton).toBeVisible();
		await expect(rejectButton).toBeVisible();
	});
});
