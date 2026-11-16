import { test, expect } from '@playwright/test';

test.describe('Real Backend E2E - Transaction Actions (Approve, Reject, Reversal Warning)', () => {
	test('should support approving a pending transaction proposal as master accountant', async ({
		page
	}) => {
		const uniqueRefId = `REF-ACT-APP-${Date.now()}`;

		// --- 1. Create an Outgoing transaction as Standard Accountant ---
		await page.goto('/login');
		await page.fill('#email', 'accountant@texas.com');
		await page.fill('#password', 'AccountantPass123!');
		await page.click('button[type="submit"]');
		await page.waitForURL(/.*dashboard/);

		await page.goto('/transactions/new');
		await page.waitForURL(/.*transactions\/new/);

		// Click Outgoing Flow tab
		await page.click('button:has-text("Outgoing Flow")');

		// Select Office Cash Drawer (ID 1)
		await page.selectOption('#src-acc', '1');

		// Fill amount
		await page.fill('#outgoing-amount', '15.000');

		// Select reference type expense
		await page.selectOption('#outgoing-ref-type', { value: 'expense' });
		await page.fill('#outgoing-ref-id', uniqueRefId);
		await page.fill('#outgoing-desc', 'Approval E2E Test');

		// Click Post Outgoing Flow
		await page.click('button:has-text("Post Outgoing Flow")');

		await page.waitForURL(/.*transactions(?!\/new)/, { timeout: 15_000 });

		// Verify transaction is listed as pending
		const table = page.locator('table');
		await expect(table).toBeVisible({ timeout: 10_000 });
		const row = table.locator(`tr:has-text("${uniqueRefId}")`);
		await expect(row).toBeVisible();
		await expect(row).toContainText(/Pending/i);

		// Log out cleanly by clearing cookies
		await page.context().clearCookies();
		await page.goto('/login');
		await page.waitForURL(/.*login/);

		// --- 2. Log in as Master Accountant ---
		await page.fill('#email', 'admin@texas.com');
		await page.fill('#password', 'S3cure_Acc_999!');
		await page.click('button[type="submit"]');
		await page.waitForURL(/.*dashboard/);

		// Go to transactions list
		await page.goto('/transactions');
		await page.waitForURL(/.*transactions/);

		// Find the row and click it to view details
		const masterRow = table.locator(`tr:has-text("${uniqueRefId}")`);
		await expect(masterRow).toBeVisible({ timeout: 10_000 });
		await masterRow.click();

		// Wait for details page load
		await page.waitForURL(/.*transactions\/\d+/);

		// Actions bar should be visible to master accountant
		const approveBtn = page.locator('button:has-text("Approve Posting")');
		await expect(approveBtn).toBeVisible({ timeout: 10_000 });

		// Click Approve Posting
		await approveBtn.click();

		// Dialog confirmation - Use exact match for dialog Approve button
		const confirmApproveBtn = page.getByRole('button', { name: 'Approve', exact: true });
		await expect(confirmApproveBtn).toBeVisible({ timeout: 5000 });
		await confirmApproveBtn.click();

		// Verify status changes to Approved
		const statusBadge = page
			.locator('[data-testid="status-badge"], span:has-text("Approved")')
			.first();
		await expect(statusBadge).toContainText(/Approved/i, { timeout: 10_000 });

		// Actions bar should disappear
		await expect(approveBtn).not.toBeVisible();

		// Reversal explanation banner should be visible
		const warningBanner = page.getByText('Transaction Reversal is Not Supported').first();
		await expect(warningBanner).toBeVisible();
	});

	test('should support rejecting a pending transaction proposal as master accountant', async ({
		page
	}) => {
		const uniqueRefId = `REF-ACT-REJ-${Date.now()}`;

		// --- 1. Create an Outgoing transaction as Standard Accountant ---
		await page.goto('/login');
		await page.fill('#email', 'accountant@texas.com');
		await page.fill('#password', 'AccountantPass123!');
		await page.click('button[type="submit"]');
		await page.waitForURL(/.*dashboard/);

		await page.goto('/transactions/new');
		await page.waitForURL(/.*transactions\/new/);

		// Click Outgoing Flow tab
		await page.click('button:has-text("Outgoing Flow")');

		// Select Office Cash Drawer (ID 1)
		await page.selectOption('#src-acc', '1');

		// Fill amount
		await page.fill('#outgoing-amount', '45.000');

		// Select reference type expense
		await page.selectOption('#outgoing-ref-type', { value: 'expense' });
		await page.fill('#outgoing-ref-id', uniqueRefId);
		await page.fill('#outgoing-desc', 'Rejection E2E Test');

		// Click Post Outgoing Flow
		await page.click('button:has-text("Post Outgoing Flow")');

		await page.waitForURL(/.*transactions(?!\/new)/, { timeout: 15_000 });

		// Verify transaction is listed as pending
		const table = page.locator('table');
		await expect(table).toBeVisible({ timeout: 10_000 });
		const row = table.locator(`tr:has-text("${uniqueRefId}")`);
		await expect(row).toBeVisible();
		await expect(row).toContainText(/Pending/i);

		// Log out cleanly by clearing cookies
		await page.context().clearCookies();
		await page.goto('/login');
		await page.waitForURL(/.*login/);

		// --- 2. Log in as Master Accountant ---
		await page.fill('#email', 'admin@texas.com');
		await page.fill('#password', 'S3cure_Acc_999!');
		await page.click('button[type="submit"]');
		await page.waitForURL(/.*dashboard/);

		// Go to transactions list
		await page.goto('/transactions');
		await page.waitForURL(/.*transactions/);

		// Find the row and click it to view details
		const masterRow = table.locator(`tr:has-text("${uniqueRefId}")`);
		await expect(masterRow).toBeVisible({ timeout: 10_000 });
		await masterRow.click();

		// Wait for details page load
		await page.waitForURL(/.*transactions\/\d+/);

		// Actions bar should be visible to master accountant
		const rejectBtn = page.locator('button:has-text("Reject Posting")');
		await expect(rejectBtn).toBeVisible({ timeout: 10_000 });

		// Click Reject Posting
		await rejectBtn.click();

		// Dialog confirmation - Fill reason and reject
		const reasonTextarea = page.locator('#reject-reason');
		await expect(reasonTextarea).toBeVisible({ timeout: 5000 });
		await reasonTextarea.fill('Incorrect posting details');

		const confirmRejectBtn = page.locator('button:has-text("Reject Transaction")');
		await confirmRejectBtn.click();

		// Verify status changes to Rejected
		const statusBadge = page
			.locator('[data-testid="status-badge"], span:has-text("Rejected")')
			.first();
		await expect(statusBadge).toContainText(/Rejected/i, { timeout: 10_000 });

		// Actions bar should disappear
		await expect(rejectBtn).not.toBeVisible();

		// Rejection audit log contains reason
		const auditLog = page.getByText('Incorrect posting details').first();
		await expect(auditLog).toBeVisible();
	});
});
