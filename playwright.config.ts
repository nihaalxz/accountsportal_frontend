import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E configuration defining test projects:
 * 1. `mocked` - Intercepts API calls to run offline/backendless.
 * 2. `real-backend` - Tests against the running C# API.
 */
export default defineConfig({
	use: {
		baseURL: 'http://localhost:5173',
		trace: 'on-first-retry',
		screenshot: 'only-on-failure',
		ignoreHTTPSErrors: true
	},

	// Retry once to handle transient dev-server cold-start failures
	retries: 1,

	webServer: {
		command: 'npm run dev',
		port: 5173,
		reuseExistingServer: !process.env.CI,
		timeout: 60_000
	},

	projects: [
		{
			name: 'mocked',
			testDir: 'tests/mocked',
			testMatch: /(.+\.)?(test|spec)\.[jt]s/,
			use: {
				...devices['Desktop Chrome']
			}
		},
		{
			name: 'real-backend',
			testDir: 'tests/real-backend',
			testMatch: /(.+\.)?(test|spec)\.[jt]s/,
			use: {
				...devices['Desktop Chrome'],
				actionTimeout: 15_000,
				navigationTimeout: 20_000
			}
		}
	]
});
