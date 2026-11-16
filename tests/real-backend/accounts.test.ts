import { test, expect } from '@playwright/test';

test.describe('Real Backend E2E - Cash Accounts', () => {
	test('should support listing, detail navigation, status toggles, and balance correction', async ({
		page
	}) => {
		// Log in as Master Accountant
		await page.goto('/login');
		await page.fill('#email', 'admin@texas.com');
		await page.fill('#password', 'S3cure_Acc_999!');
		await page.click('button[type="submit"]');
		await page.waitForURL(/.*dashboard/);

		// Navigate to Cash Accounts
		await page.goto('/accounts');
		await page.waitForURL(/.*accounts/);

		// Verify listed accounts
		await expect(page.locator('table')).toBeVisible({ timeout: 10_000 });
		await expect(
			page.locator('table td', { hasText: 'Office Cash Drawer' }).first()
		).toBeVisible();
		await expect(page.locator('table td', { hasText: 'Petty Cash Box' }).first()).toBeVisible();

		// Create a new cash account
		await page.click('button:has-text("Create Account")');
		await page.waitForURL(/.*accounts\/new/);

		const uniqueName = `Safe Box Cash-${Date.now()}`;
		await page.fill('#acc-name', uniqueName);
		await page.fill('#acc-bal', '50.000');
		await page.click('button[type="submit"]');

		// Redirect back to list
		await page.waitForURL(/.*accounts(?!\/new)/, { timeout: 10_000 });
		const row = page.locator(`tr:has-text("${uniqueName}")`);
		await expect(row).toBeVisible();

		// Click to view details
		await row.click();
		await page.waitForURL(/.*accounts\/\d+/);

		// Verify general ledger report loads and lists entries
		const ledgerReport = page.locator('text=General Ledger Statement');
		await expect(ledgerReport).toBeVisible({ timeout: 10_000 });

		// Perform status toggle
		const toggleBtn = page
			.locator('button:has-text("Deactivate"), button:has-text("Activate")')
			.first();
		await expect(toggleBtn).toBeVisible();
		await toggleBtn.click();
		// Status change toast notification
		const statusToast = page.locator('text=Account status updated.');
		await expect(statusToast).toBeVisible({ timeout: 10_000 });
		await page.locator('button[aria-label="Dismiss alert"]').first().click();
		await expect(statusToast).toBeHidden({ timeout: 5000 });

		// Verify balance correction button
		const balanceCorrectionBtn = page.locator('button:has-text("Correct Balance")').first();
		await expect(balanceCorrectionBtn).toBeVisible();
		await balanceCorrectionBtn.click();

		// Dialog opens
		const amountInput = page.locator('#adj-amt');
		const reasonInput = page.locator('#adj-reason');
		const submitCorrectionBtn = page.locator(
			'div[role="dialog"] button:has-text("Correct Balance")'
		);

		await expect(amountInput).toBeVisible({ timeout: 5000 });
		await amountInput.fill('10.000');
		await reasonInput.fill('Audit correction E2E');
		await submitCorrectionBtn.click();

		// Toast success
		await expect(page.locator('text=Balance correction posted successfully.')).toBeVisible({
			timeout: 10_000
		});
	});
});
