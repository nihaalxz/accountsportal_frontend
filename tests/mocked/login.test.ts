import { test, expect } from '@playwright/test';

test.describe('Authentication and Redirection Flow', () => {
	test('login page is accessible and renders the sign-in form', async ({ page }) => {
		// Mock session bootstrap to ensure unauthenticated state
		await page.route('**/api/auth/refresh', (route) => route.fulfill({ status: 401 }));
		await page.route('**/api/auth/me', (route) => route.fulfill({ status: 401 }));

		// Navigate directly to login — always accessible
		await page.goto('/login');

		// Wait for the login form to be visible (confirms page renders correctly)
		await expect(page.locator('h2')).toBeVisible({ timeout: 10_000 });
		await expect(page.locator('#email')).toBeVisible();
		await expect(page.locator('#password')).toBeVisible();
		await expect(page.locator('button[type="submit"]')).toBeVisible();
		await expect(page).toHaveURL(/.*login/);
	});

	test('submitting invalid credentials displays error banner', async ({ page }) => {
		// Mock login to return 401
		await page.route('**/api/auth/login', (route) =>
			route.fulfill({
				status: 401,
				contentType: 'application/json',
				body: JSON.stringify({ detail: 'Invalid credentials.' })
			})
		);
		// Mock session bootstrap to keep user unauthenticated
		await page.route('**/api/auth/refresh', (route) => route.fulfill({ status: 401 }));
		await page.route('**/api/auth/me', (route) => route.fulfill({ status: 401 }));

		await page.goto('/login');

		// Wait for page to fully render before interacting
		await expect(page.locator('#email')).toBeVisible({ timeout: 10_000 });

		await page.fill('#email', 'wrong@user.com');
		await page.fill('#password', 'WrongPassword123!');
		await page.click('button[type="submit"]');

		const alert = page.locator('[role="alert"]');
		await expect(alert).toBeVisible({ timeout: 8_000 });
		await expect(alert).toContainText('Invalid credentials.');
	});
});
