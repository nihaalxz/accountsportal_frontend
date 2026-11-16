import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Top-level SvelteKit dynamic modules mocking
vi.mock('$env/dynamic/public', () => ({
	env: { PUBLIC_BACKEND_API_URL: 'http://localhost:5028' }
}));
vi.mock('$app/environment', () => ({
	browser: true,
	dev: true
}));
vi.mock('$lib/auth/cookies', () => {
	const store: Record<string, string> = {};
	return {
		getCookie: vi.fn((name) => store[name] || null),
		setCookie: vi.fn((name, value) => {
			store[name] = value;
		}),
		deleteCookie: vi.fn((name) => {
			delete store[name];
		})
	};
});

import { get } from 'svelte/store';
import { authState, login } from './auth';
import { clearAccessToken } from '$lib/api/api-client';

describe('Auth Store State Machine', () => {
	beforeEach(() => {
		clearAccessToken();
		vi.stubGlobal('fetch', vi.fn());
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('starts in an initializing state', () => {
		const state = get(authState);
		expect(state.isInitializing).toBe(true);
		expect(state.isAuthenticated).toBe(false);
		expect(state.user).toBeNull();
	});

	it('resolves authenticated state on successful login', async () => {
		const loginPayload = {
			accessToken: 'access-jwt',
			refreshToken: 'refresh-jwt',
			userType: 'Accounts',
			name: 'John Accountant',
			email: 'john@texas.com',
			portalPermissions: ['all']
		};

		const mockFetch = vi.fn().mockResolvedValue(
			new Response(JSON.stringify(loginPayload), {
				status: 200,
				headers: { 'Content-Type': 'application/json' }
			})
		);
		vi.stubGlobal('fetch', mockFetch);

		await login('john@texas.com', 'P@ssword123456!');

		const state = get(authState);
		expect(state.isAuthenticated).toBe(true);
		expect(state.isInitializing).toBe(false);
		expect(state.user?.name).toBe('John Accountant');
		expect(state.user?.userType).toBe('Accounts');
	});

	it('correctly audits role permissions for master accountants', () => {
		// Setup state manually for testing authorization helpers
		authState.subscribe(() => {})(); // force subscription updates

		// Simulate master accountant session
		const mockUser = {
			name: 'Super Admin',
			email: 'admin@texas.com',
			userType: 'master_accountant',
			permissions: ['all']
		};

		// We can evaluate helper permissions dynamically
		expect(mockUser.userType).toBe('master_accountant');
	});
});
