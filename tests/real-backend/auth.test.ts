import { test, expect } from '@playwright/test';

test.describe('Real Backend E2E - Authentication', () => {
	// Start each test with fresh state
	test.use({ storageState: { cookies: [], origins: [] } });

	test('should reject invalid credentials with error banner', async ({ page }) => {
		await page.goto('/login');

		await page.fill('#email', 'invalid@texas.com');
		await page.fill('#password', 'WrongPassword123!');
		await page.click('button[type="submit"]');

		const alert = page.locator('[role="alert"]');
		await expect(alert).toBeVisible({ timeout: 10_000 });
		await expect(alert).toContainText(/Invalid credentials/i);
	});

	test('should login successfully with standard accountant role', async ({ page }) => {
		await page.goto('/login');

		await page.fill('#email', 'accountant@texas.com');
		await page.fill('#password', 'AccountantPass123!');
		await page.click('button[type="submit"]');

		await page.waitForURL(/.*dashboard/);
		await expect(page).toHaveURL(/.*dashboard/);

		const welcome = page.locator('h1');
		await expect(welcome).toContainText(/Welcome back/i);

		// Standard accountant should NOT see Create Account button in accounts list
		await page.goto('/accounts');
		await page.waitForTimeout(1000);
		const createButton = page.locator(
			'a:has-text("Create Account"), button:has-text("Create Account")'
		);
		await expect(createButton).not.toBeVisible();
	});

	test('should login successfully with master accountant role and restore session on reload', async ({
		page
	}) => {
		await page.goto('/login');

		await page.fill('#email', 'admin@texas.com');
		await page.fill('#password', 'S3cure_Acc_999!');
		await page.click('button[type="submit"]');

		await page.waitForURL(/.*dashboard/);

		// Reload page and verify session is restored
		await page.reload();
		await page.waitForURL(/.*dashboard/);
		await expect(page).toHaveURL(/.*dashboard/);

		// Master accountant should see Create Account button in accounts list
		await page.goto('/accounts');
		const createButton = page.locator(
			'a:has-text("Create Account"), button:has-text("Create Account")'
		);
		await expect(createButton).toBeVisible({ timeout: 5000 });
	});

	test('should logout successfully and redirect to login', async ({ page }) => {
		// Log in first
		await page.goto('/login');
		await page.fill('#email', 'accountant@texas.com');
		await page.fill('#password', 'AccountantPass123!');
		await page.click('button[type="submit"]');
		await page.waitForURL(/.*dashboard/);

		// Click the sidebar sign-out button (title="Sign out")
		await page.click('button[title="Sign out"]');

		// Should be redirected to /login after logout
		await page.waitForURL(/.*login/, { timeout: 10_000 });
		await expect(page).toHaveURL(/.*login/);

		// Verify route guard: navigating to /dashboard without session redirects to login
		await page.context().clearCookies();
		await page.goto('/dashboard');
		await page.waitForURL(/.*login/, { timeout: 10_000 });
		await expect(page).toHaveURL(/.*login/);
	});
});
